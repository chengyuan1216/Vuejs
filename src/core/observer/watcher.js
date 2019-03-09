/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'
import { log, O2S }  from 'core/util/log.js'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
// 观察者解析表达式，收集依赖项，
// 当表达式值发生变化时触发回调。
// 这用于$watch() api和指令。
export default class Watcher {
  vm: Component; //组件对象
  expression: string; 
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  computed: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  dep: Dep;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor (
    vm: Component,  
    expOrFn: string | Function,
    cb: Function,
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
                                                                
    //初始化vm
    this.vm = vm
    //如果是渲染检测
    if (isRenderWatcher) {
      vm._watcher = this
    }
    vm._watchers.push(this)
    // options 如果有options
    if (options) {
      this.deep = !!options.deep //转换成布尔值
      this.user = !!options.user
      this.computed = !!options.computed
      this.sync = !!options.sync
      this.before = options.before
    } else {
      this.deep = this.user = this.computed = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching 批处理
    this.active = true
    this.dirty = this.computed // for computed watchers
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()

    // 如果是 renderWatcher 那么 expOrFn 是 updateComponent 方法。
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    //解析表达式, getter
    if (typeof expOrFn === 'function') {
      // 如果是 renderWatcher 那么 expOrFn 是 updateComponent 方法。
      // 如果是 计算属性 则是 get 方法
      // 不管是哪一种情况都会在执行的过程中收集所有的依赖， 当依赖变化时
      // 重新执行函数得到新的vNode 或者新的值
      this.getter = expOrFn 
    } else { 
      this.getter = parsePath(expOrFn) //解析对象路径
      if (!this.getter) {
        this.getter = function () {}
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    if (this.computed) {
      this.value = undefined // 如果是计算属性则将赋值为 undefined ?
      this.dep = new Dep()
    } else {
      this.value = this.get()
    }
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  //评估getter并重新收集依赖项。
  get () {
    // 这里实际上是将当前 Watcher 挂在 Dep.target 上
    // 便于在执行getter 方法时收集依赖
    pushTarget(this) 
    let value
    const vm = this.vm
    try {
      // 实际上是执行的下面这个方法
      // updateComponent = () => {
      //   vm._update(vm._render(), hydrating)
      // }
      // 由此可知， 执行vm._render()是， 会使用data的数据
      // 此时 Dep.target 是当前 Watcher, 所以就会在执行render()时自动收集依赖
      // 当下次data有变动时将会再次提醒 renderWarcher 更新视图
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      // 如果是深度观察， 则将会通过遍历的方式来触发子属性的get方法
      // 从而获取对象的深度依赖
      if (this.deep) {
        traverse(value)
      }

      // 将当前 watcher 从 Dep.target 上移除
      popTarget()
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  addDep (dep: Dep) {
    const id = dep.id
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  update () {
    /* istanbul ignore else */
    if (this.computed) {
      // A computed property watcher has two modes: lazy and activated.
      // It initializes as lazy by default, and only becomes activated when
      // it is depended on by at least one subscriber, which is typically
      // another computed property or a component's render function.
      if (this.dep.subs.length === 0) {
        // In lazy mode, we don't want to perform computations until necessary,
        // so we simply mark the watcher as dirty. The actual computation is
        // performed just-in-time in this.evaluate() when the computed property
        // is accessed.
        this.dirty = true
      } else {
        // In activated mode, we want to proactively perform the computation
        // but only notify our subscribers when the value has indeed changed.
        this.getAndInvoke(() => {
          this.dep.notify()
        })
      }
    } else if (this.sync) {
      this.run()
    } else {
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run () {
    if (this.active) {
      this.getAndInvoke(this.cb)
    }
  }

  getAndInvoke (cb: Function) {
    const value = this.get()
    if (
      value !== this.value ||
      // Deep watchers and watchers on Object/Arrays should fire even
      // when the value is the same, because the value may
      // have mutated.
      isObject(value) ||
      this.deep
    ) {
      // set new value
      const oldValue = this.value
      this.value = value
      this.dirty = false
      if (this.user) {
        try {
          cb.call(this.vm, value, oldValue)
        } catch (e) {
          handleError(e, this.vm, `callback for watcher "${this.expression}"`)
        }
      } else {
        cb.call(this.vm, value, oldValue)
      }
    }
  }

  /**
   * Evaluate and return the value of the watcher.
   * This only gets called for computed property watchers.
   */
  evaluate () {
    // 计算属性的watcher 初始化时 dirty 的值是 true
    // 因此这里会计算一次get()方法， 在执行过程中收集依赖
    // 从第二次以后， 将会使用缓存在 watcher 上的值。
    if (this.dirty) { 
      this.value = this.get()
      this.dirty = false
    }
    return this.value
  }

  /**
   * Depend on this watcher. Only for computed property watchers.
   */
  depend () {
    if (this.dep && Dep.target) {
      this.dep.depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}
