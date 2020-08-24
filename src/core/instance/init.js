/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

export function initMixin (Vue: Class<Component>) {
  // 在构造函数内部会执行
  /**
  如果是vue内部通过vnode创建vm, 传入的options是这样的数据结构
  const options: InternalComponentOptions = {
    _isComponent: true, // 是否是自定义组件
    _parentVnode: vnode, // 父Vnode
    parent // 父组件实例
  }
   */
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // a uid
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    vm._isVue = true
    // merge options
    // 组件
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      // 初始化内部调用创建组件的参数
      initInternalComponent(vm, options)
    } else {
      // 通过合并策略得到最终的options
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor), /**从构造函数上获得的options */
        options || {}, /**用户传入的options */
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      // 测试环境使用，检查数据属性命名不能以_开头等问题
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    // 初始化生命周期
    initLifecycle(vm)
    // 初始化事件
    initEvents(vm)
    initRender(vm)
    /* 在初始化完成后调用 beforeCreate 钩子 */
    callHook(vm, 'beforeCreate')
    /* 获取从父组件注入的数据 */
    initInjections(vm) // resolve injections before data/props
    // 初始化组件的数据包括 data、computed、methods
    initState(vm)
    // 初始化要注入到子组件的数据
    initProvide(vm) // resolve provide after data/props
    /* 调用 beforeCreate 钩子 */
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

// vue内部调用构造函数创建vm对象时， 初始化options
export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  // 继承自构造函数上的options，这是避免创建多个vm实例时相互干扰
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  // 父组件实例
  opts.parent = options.parent
  // 当前组件的$vnode
  opts._parentVnode = parentVnode

  // 创建当前组件时的options
  const vnodeComponentOptions = parentVnode.componentOptions
  // 用于测试props的数据
  opts.propsData = vnodeComponentOptions.propsData
  // 当前组件在父组件模板上注册的事件
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  // 获取render方法
  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

// 获取构造函数上的options
export function resolveConstructorOptions (Ctor: Class<Component>) {
  /**
   获取当前构造函数上的options
    {
      "components": {
        "KeepAlive": {},
        "Transition": {},
        "TransitionGroup": {}
      },
      "directives": {
        "model": {},
        "show": {}
      },
      "filters": {}
    }
   */
  let options = Ctor.options

  /* 如果当前构造函数有父级 */
  if (Ctor.super) {
    /* 先从父级获取options */
    const superOptions = resolveConstructorOptions(Ctor.super)
    /* 获取缓存在Ctor上 super option */
    /*
      为什么在Vue.extend已经合并过一次，这里会再一次合并？
      因为Vue.extend的时候会缓存上一次的合并的结果, 所以这里会判断父类的options是否发生变化，
      如果变化了就重新合并
    */
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
