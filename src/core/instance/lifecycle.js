/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import { mark, measure } from '../util/perf'
import { createEmptyVNode } from '../vdom/vnode'
import { updateComponentListeners } from './events'
import { resolveSlots } from './render-helpers/resolve-slots'
import { toggleObserving } from '../observer/index'
import { pushTarget, popTarget } from '../observer/dep'

import {
  warn,
  noop,
  remove,
  emptyObject,
  validateProp,
  invokeWithErrorHandling
} from '../util/index'

export let activeInstance: any = null // 当前vm实例
export let isUpdatingChildComponent: boolean = false

export function setActiveInstance(vm: Component) {
  const prevActiveInstance = activeInstance
  activeInstance = vm
  return () => {
    activeInstance = prevActiveInstance
  }
}

export function initLifecycle (vm: Component) {
  const options = vm.$options

  // locate first non-abstract parent
  // 找到最近的不是抽象组件的父级， 将vm对象加入到这个父级的$children数组中
  // 将父子组件实例之间建立双向引用
  let parent = options.parent
  if (parent && !options.abstract) {
    while (parent.$options.abstract && parent.$parent) {
      parent = parent.$parent
    }
    // $children 保存所有子组件
    parent.$children.push(vm)
  }

  // 定义$parent 和 $root
  vm.$parent = parent
  vm.$root = parent ? parent.$root : vm

  // 定义$children $refs
  vm.$children = []
  vm.$refs = {}

  vm._watcher = null // 保存 render watcher
  vm._inactive = null
  vm._directInactive = false
  vm._isMounted = false // 标识是否已执行mounted
  vm._isDestroyed = false // 标识是否已执行 destroyed
  vm._isBeingDestroyed = false // 标识是否已执行 beforeDestroy
}

// 与组件生命周期相关
export function lifecycleMixin (Vue: Class<Component>) {
  // 组件更新
  Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
    debugger
    const vm: Component = this
    const prevEl = vm.$el
    // 上一次生成的vnode
    const prevVnode = vm._vnode
    // 设置当前vm对象
    const restoreActiveInstance = setActiveInstance(vm)
    // 将新的vnode对象保存在_vnode上
    vm._vnode = vnode
    // Vue.prototype.__patch__ is injected in entry points
    // based on the rendering backend used.
    // 如果组件是第一次渲染
    if (!prevVnode) {
      // initial render
      vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */)
    } else {
      // updates
      vm.$el = vm.__patch__(prevVnode, vnode)
    }
    // 在当前组件patch完成后, 将activeInstance恢复为上一个
    restoreActiveInstance()

    // 根dom节点有一个属性 __vue__指向vm
    // update __vue__ reference
    // 将上一个dom.__vue__清空， 避免循环引用
    if (prevEl) {
      prevEl.__vue__ = null
    }
    // 新的dom.__vue__将会指向当前节点
    if (vm.$el) {
      vm.$el.__vue__ = vm
    }
    // if parent is an HOC, update its $el as well
    // 高阶组件, 更新父组件的$el
    if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
      vm.$parent.$el = vm.$el
    }
    // updated hook is called by the scheduler to ensure that children are
    // updated in a parent's updated hook.
  }

  // 强制重新渲染
  Vue.prototype.$forceUpdate = function () {
    const vm: Component = this
    if (vm._watcher) {
      vm._watcher.update()
    }
  }

  // 销毁组件
  Vue.prototype.$destroy = function () {
    const vm: Component = this
    if (vm._isBeingDestroyed) {
      return
    }
    callHook(vm, 'beforeDestroy')
    vm._isBeingDestroyed = true
    // remove self from parent
    const parent = vm.$parent
    if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
      remove(parent.$children, vm)
    }
    // teardown watchers
    if (vm._watcher) {
      vm._watcher.teardown()
    }
    let i = vm._watchers.length
    while (i--) {
      vm._watchers[i].teardown()
    }
    // remove reference from data ob
    // frozen object may not have observer.
    if (vm._data.__ob__) {
      vm._data.__ob__.vmCount--
    }
    // call the last hook...
    vm._isDestroyed = true
    // invoke destroy hooks on current rendered tree
    vm.__patch__(vm._vnode, null)
    // fire destroyed hook
    callHook(vm, 'destroyed')
    // turn off all instance listeners.
    vm.$off()
    // remove __vue__ reference
    if (vm.$el) {
      vm.$el.__vue__ = null
    }
    // release circular reference (#6759)
    if (vm.$vnode) {
      vm.$vnode.parent = null
    }
  }
}

/*
  挂载组件
 */
export function mountComponent (
  vm: Component,
  el: ?Element,
  hydrating?: boolean
): Component {
  // $el可以访问dom，在执行$mount时传进来的
  vm.$el = el

  // 如果render方法不存在则赋值一个返回空vnode节点的方法
  if (!vm.$options.render) {
    vm.$options.render = createEmptyVNode
    if (process.env.NODE_ENV !== 'production') {
      /* istanbul ignore if */
      if ((vm.$options.template && vm.$options.template.charAt(0) !== '#') ||
        vm.$options.el || el) {
        warn(
          'You are using the runtime-only build of Vue where the template ' +
          'compiler is not available. Either pre-compile the templates into ' +
          'render functions, or use the compiler-included build.',
          vm
        )
      } else {
        warn(
          'Failed to mount component: template or render function not defined.',
          vm
        )
      }
    }
  }
  /* 执行 beforeMount 钩子*/
  callHook(vm, 'beforeMount')

  let updateComponent
  /* istanbul ignore if */
  if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
    updateComponent = () => {
      const name = vm._name
      const id = vm._uid
      const startTag = `vue-perf-start:${id}`
      const endTag = `vue-perf-end:${id}`

      mark(startTag)
      const vnode = vm._render()
      mark(endTag)
      measure(`vue ${name} render`, startTag, endTag)

      mark(startTag)
      vm._update(vnode, hydrating)
      mark(endTag)
      measure(`vue ${name} patch`, startTag, endTag)
    }
  } else {
    updateComponent = () => {
      debugger
      vm._update(vm._render(), hydrating)
    }
  }

  // we set this to vm._watcher inside the watcher's constructor
  // since the watcher's initial patch may call $forceUpdate (e.g. inside child
  // component's mounted hook), which relies on vm._watcher being already defined
  // 创建 renderWatcher
  new Watcher(vm, updateComponent, noop, {
    before () {
      if (vm._isMounted && !vm._isDestroyed) {
        callHook(vm, 'beforeUpdate')
      }
    }
  }, true /* isRenderWatcher */)
  hydrating = false

  // manually mounted instance, call mounted on self
  // mounted is called for render-created child components in its inserted hook
  // 页面跟组件才会在patch的逻辑执行完后触发mounted钩子
  // 内部调用的子组件是通过调用vnode的insert hook来调用的。
  // 只有页面的根组件vm.$vnode才会为null
  if (vm.$vnode == null) {
    vm._isMounted = true
    callHook(vm, 'mounted')
  }
  return vm
}

export function updateChildComponent (
  vm: Component,
  propsData: ?Object,
  listeners: ?Object,
  parentVnode: MountedComponentVNode,
  renderChildren: ?Array<VNode>
) {
    if (process.env.NODE_ENV !== 'production') {
        isUpdatingChildComponent = true;
    }

    // determine whether component has slot children
    // we need to do this before overwriting $options._renderChildren.

    // check if there are dynamic scopedSlots (hand-written or compiled but with
    // dynamic slot names). Static scoped slots compiled from template has the
    // "$stable" marker.
    // data.scopedSlots可能是以jsx的方式传进来的
    const newScopedSlots = parentVnode.data.scopedSlots; // 获取新的slot
    const oldScopedSlots = vm.$scopedSlots; // 老的slot
    // 判断是否是动态的slot
    const hasDynamicScopedSlot = !!(
        (
            (newScopedSlots && !newScopedSlots.$stable) || // newScopedSlots是不稳定的
            (oldScopedSlots !== emptyObject && !oldScopedSlots.$stable) || // oldScopedSlots是不稳定的
            (newScopedSlots && vm.$scopedSlots.$key !== newScopedSlots.$key)
        ) // $key不一样
    );

    // Any static slot children from the parent may have changed during parent's
    // update. Dynamic scoped slots may also have changed. In such cases, a forced
    // update is necessary to ensure correctness.
    // 当chilen或者动态scoped变化时需要强制update
    const needsForceUpdate = !!(
        renderChildren || // has new static slots
        vm.$options._renderChildren || // has old static slots
        hasDynamicScopedSlot
    );

    // 当前组件节点
    vm.$options._parentVnode = parentVnode;
    vm.$vnode = parentVnode; // update vm's placeholder node without re-render

    // 内部根节点
    if (vm._vnode) {
        // update child tree's parent
        vm._vnode.parent = parentVnode;
    }

    // 在tempalate中开标签和闭标签之间传入的chuilren
    vm.$options._renderChildren = renderChildren;

    // update $attrs and $listeners hash
    // these are also reactive so they may trigger child update if the child
    // used them during render
    // patch 子组件的时候修改$atrrs和$listeners将会触发子组件的renderWatcher
    // $attrs 每次都是赋值一个新的对象
    vm.$attrs = parentVnode.data.attrs || emptyObject;
    vm.$listeners = listeners || emptyObject;

    // update props
    // 更新组件属性
    // vm._props上的属性都是reactive属性
    // 所以当prop改变重新赋值时会触发子组件的renderWacther
    if (propsData && vm.$options.props) {
        toggleObserving(false);
        const props = vm._props;
        const propKeys = vm.$options._propKeys || [];
        for (let i = 0; i < propKeys.length; i++) {
            const key = propKeys[i];
            const propOptions: any = vm.$options.props; // wtf flow?
            props[key] = validateProp(key, propOptions, propsData, vm);
        }
        toggleObserving(true);
        // keep a copy of raw propsData
        vm.$options.propsData = propsData;
    }

    // update listeners
    // 更新组件在父组件定义的事件
    listeners = listeners || emptyObject;
    const oldListeners = vm.$options._parentListeners;
    vm.$options._parentListeners = listeners;
    updateComponentListeners(vm, listeners, oldListeners);

    // resolve slots + force update if has children
    // 虽然修改$ttrs和$listeners的时候可能会触发renderWatcher，但是不排除不触发或者根本没有定义$attrs和$listeners的组件
    // 此时需要强制更新
    if (needsForceUpdate) {
        vm.$slots = resolveSlots(renderChildren, parentVnode.context);
        // 本质是在修改组件的状态后调用$forceUpdate强制更新组件
        vm.$forceUpdate();
    }

    if (process.env.NODE_ENV !== 'production') {
        isUpdatingChildComponent = false;
    }
}

function isInInactiveTree (vm) {
  while (vm && (vm = vm.$parent)) {
    if (vm._inactive) return true
  }
  return false
}

export function activateChildComponent (vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = false
    if (isInInactiveTree(vm)) {
      return
    }
  } else if (vm._directInactive) {
    return
  }
  if (vm._inactive || vm._inactive === null) {
    vm._inactive = false
    for (let i = 0; i < vm.$children.length; i++) {
      activateChildComponent(vm.$children[i])
    }
    callHook(vm, 'activated')
  }
}

// keep-alive 组件
export function deactivateChildComponent (vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = true
    if (isInInactiveTree(vm)) {
      return
    }
  }
  if (!vm._inactive) {
    vm._inactive = true
    for (let i = 0; i < vm.$children.length; i++) {
      deactivateChildComponent(vm.$children[i])
    }
    callHook(vm, 'deactivated')
  }
}

export function callHook (vm: Component, hook: string) {
  // #7573 disable dep collection when invoking lifecycle hooks
  // 调用生命周期函数时， 不进行依赖收集
  pushTarget()
  const handlers = vm.$options[hook]
  const info = `${hook} hook`
  // 调用通过options定义的hook
  if (handlers) {
    for (let i = 0, j = handlers.length; i < j; i++) {
      invokeWithErrorHandling(handlers[i], vm, null, vm, info)
    }
  }
  // 通过触发事件的方式调用， eg: hook:beforeCreate
  if (vm._hasHookEvent) {
    vm.$emit('hook:' + hook)
  }
  popTarget()
}
