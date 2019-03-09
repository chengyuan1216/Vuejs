/* @flow */

import {
  warn,
  nextTick,
  emptyObject,
  handleError,
  defineReactive
} from '../util/index'

import { createElement } from '../vdom/create-element'
import { installRenderHelpers } from './render-helpers/index'
import { resolveSlots } from './render-helpers/resolve-slots'
import VNode, { createEmptyVNode } from '../vdom/vnode'

import { isUpdatingChildComponent } from './lifecycle'
import { log, O2S, debugConfig }  from 'core/util/log.js'

// 主要做了以下几件事情：
// 1、获取parentNode
// 2、获取$slots 和 $scopedSlots
// 3、生成$createElement 方法
// 4、通过$attrs 和 $listeners 代理parentNode 的数据
export function initRender (vm: Component) {
  vm._vnode = null // the root of the child tree
  vm._staticTrees = null // v-once cached trees
  const options = vm.$options
  const parentVnode = vm.$vnode = options._parentVnode // the placeholder node in parent tree
  // 当前组件的渲染是再父组件的上下文开始渲染的
  const renderContext = parentVnode && parentVnode.context
  vm.$slots = resolveSlots(options._renderChildren, renderContext)
  vm.$scopedSlots = emptyObject
  // bind the createElement fn to this instance
  // so that we get proper render context inside it.
  // args order: tag, data, children, normalizationType, alwaysNormalize
  // internal version is used by render functions compiled from templates
  // 模板解析生成的render 函数所使用
  vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
  // normalization is always applied for the public version, used in
  // user-written render functions.
  // 用户手写 render 函数是使用
  vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)

  // $attrs & $listeners are exposed for easier HOC creation.
  // they need to be reactive so that HOCs using them are always updated
  const parentData = parentVnode && parentVnode.data

  /* istanbul ignore else */
  if (process.env.NODE_ENV !== 'production') {
    defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, () => {
      !isUpdatingChildComponent && warn(`$attrs is readonly.`, vm)
    }, true)
    defineReactive(vm, '$listeners', options._parentListeners || emptyObject, () => {
      !isUpdatingChildComponent && warn(`$listeners is readonly.`, vm)
    }, true)
  } else {
    defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, null, true)
    defineReactive(vm, '$listeners', options._parentListeners || emptyObject, null, true)
  }
}

export function renderMixin (Vue: Class<Component>) {
  if (debugConfig['src/stance/render/renderMixin']) debugger

  // install runtime convenience helpers
  // 在原型山加了一些方法
  installRenderHelpers(Vue.prototype)

  //log('Vue原型上添加$nextTick方法')
  Vue.prototype.$nextTick = function (fn: Function) {
    return nextTick(fn, this)
  }

  //log('Vue原型上添加_render方法')
  // 这个方法主要是通过$option.render 方法生成 VNode 对象
  Vue.prototype._render = function (): VNode {
    const vm: Component = this
    // 如果是跟组件， _parentVnode 不存在
    const { render, _parentVnode } = vm.$options

    // reset _rendered flag on slots for duplicate slot check
    if (process.env.NODE_ENV !== 'production') {
      for (const key in vm.$slots) {
        // $flow-disable-line
        vm.$slots[key]._rendered = false
      }
    }

    if (_parentVnode) {
      vm.$scopedSlots = _parentVnode.data.scopedSlots || emptyObject
    }

    // set parent vnode. this allows render functions to have access
    // to the data on the placeholder node.
    // $vnode 指向的时父vnode对象
    vm.$vnode = _parentVnode
    // render self
    let vnode
    debugger
    try {
      // 执行 render 函数时 this 指向的时当前 vm 实例
      vnode = render.call(vm._renderProxy, vm.$createElement)
      // 生成的 vNode 对象
      // {
      //   asyncFactory: undefined
      //   asyncMeta: undefined
      //   children: [
      //     // 这里是子节点
      //   ]
      //   componentInstance: undefined
      //   componentOptions: undefined
      //   context: 这里是 vm 对象
      //   data: {attrs: {id: "test"}}
      //   elm: undefined
      //   fnContext: undefined
      //   fnOptions: undefined
      //   fnScopeId: undefined
      //   isAsyncPlaceholder: false
      //   isCloned: false
      //   isComment: false
      //   isOnce: false
      //   isRootInsert: true
      //   isStatic: false
      //   key: undefined
      //   ns: undefined
      //   parent: undefined
      //   raw: false
      //   tag: "div"
      //   text: undefined
      //   child: undefined
      // }
    } catch (e) {
      handleError(e, vm, `render`)
      // return error render result,
      // or previous vnode to prevent render error causing blank component
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        if (vm.$options.renderError) {
          try {
            vnode = vm.$options.renderError.call(vm._renderProxy, vm.$createElement, e)
          } catch (e) {
            handleError(e, vm, `renderError`)
            vnode = vm._vnode
          }
        } else {
          vnode = vm._vnode
        }
      } else {
        vnode = vm._vnode
      }
    }
    // return empty vnode in case the render function errored out
    if (!(vnode instanceof VNode)) {
      if (process.env.NODE_ENV !== 'production' && Array.isArray(vnode)) {
        warn(
          'Multiple root nodes returned from render function. Render function ' +
          'should return a single root node.',
          vm
        )
      }
      vnode = createEmptyVNode()
    }
    // set parent
    vnode.parent = _parentVnode
    return vnode
  }
}
