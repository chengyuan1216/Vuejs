/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor (
    vm: Component, // 组件实例
    expOrFn: string | Function, // watcher的get方法
    cb: Function, // get方法返回值变化后执行的回调
    options?: ?Object, // 配置对象
    isRenderWatcher?: boolean // 是否是renderWatcher
  ) {
    // 保存watcher的上下文
    this.vm = vm

    // 如果是renderWatcher
    if (isRenderWatcher) {
      vm._watcher = this
    }

    // _watchers保存了所有的watcher对象
    vm._watchers.push(this)
    // options
    if (options) {
      this.deep = !!options.deep // 在监听一个对象的时候是否深度监听
      this.user = !!options.user // 是否是用户定义的watcher
      this.lazy = !!options.lazy // 是否是延迟执行get方法，在需要使用get的返回值时才执行get方法
      this.sync = !!options.sync // 是否是同步执行get方法，computed和userWatcher都是同步执行，renderWatcher是异步执行
      this.before = options.before
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb  // 回调
    this.id = ++uid // uid for batching 
    this.active = true // 当前watcher是否处于激活状态
    this.dirty = this.lazy // for lazy watchers
    this.deps = []  // 在执行get方法时收集的依赖
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    if (typeof expOrFn === 'function') {
      // 可能是userWatcher
      // 可能是renderWatcher
      // 可能是computedWatcher
      this.getter = expOrFn 
    } else {
      // 是userWatcher
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = noop
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }

    // 如果lazy的值为true,将不会立即执行get方法， 而是在需要用到的时候执行
    // 在定义computed属性的时候lazy的值为true
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  get () {
    // 将当前wathcer对象挂在Dep.target上
    // 当访问Observer数据时，会自动手收集依赖
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      // 执行getter方法时会使用到vm对象上的数据，同时收集依赖
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
      // 如果是深度监听则递归遍历这个对象所有的属性，收集依赖
      if (this.deep) {
        traverse(value)
      }
      // 将当前wathcer对象从Dep.target上移除
      popTarget()
      // 处理当前收集的依赖遇上一次执行get收集的依赖的差异
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  addDep (dep: Dep) {
    const id = dep.id
    // 如果当前执行get时没有被收集过
    if (!this.newDepIds.has(id)) {
      // 将dep对象收集到新的依赖集合中
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      // 如果上一次没有订阅这个依赖， 则订阅
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

    // 遍历上一次的依赖集合
    while (i--) {
      const dep = this.deps[i]
      // 如果在这一次收集的依赖中没有这个Dep对象, 则表示当前不再需要订阅这个Dep对象了
      // 所有移除wathcer对这个Dep对象的订阅
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    // 将newDepIds赋值给depIs，并且清空depIds
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()

    // 将newDeps赋值给deps，并且清空newDeps
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  // 当依赖的数据变化时就会通过dep对象调用update方法
  update () {
    /* istanbul ignore else */
    if (this.lazy) { // 如果是computed属性则改变dirty的值， 当再次访问computed的值得时候就会重新求值
      this.dirty = true
    } else if (this.sync) { // 同步执行
      this.run()
    } else { // 通过异步队列的方式执行
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run () {
    if (this.active) {
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
        if (this.user) {
          try {
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  evaluate () {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
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
