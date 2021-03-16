/* @flow */

import { remove, isDef } from 'shared/util'

// ref其实也是一个自定义指令
export default {
  create (_: any, vnode: VNodeWithData) {
    registerRef(vnode)
  },
  update (oldVnode: VNodeWithData, vnode: VNodeWithData) {
    // 移除旧的ref, 并且设置新的ref
    if (oldVnode.data.ref !== vnode.data.ref) {
      registerRef(oldVnode, true)
      registerRef(vnode)
    }
  },
  destroy (vnode: VNodeWithData) {
    // vnode销毁时, 将当前的组件从父组件的$refs中移除
    registerRef(vnode, true)
  }
}

// 注册ref
export function registerRef (vnode: VNodeWithData, isRemoval: ?boolean) {
  // 获取ref
  const key = vnode.data.ref
  // 如果ref是空
  if (!isDef(key)) return

  // 创建vnode的上下文，也就是父组件
  const vm = vnode.context
  // vnode的组件实例或者dom元素
  const ref = vnode.componentInstance || vnode.elm
  const refs = vm.$refs
  if (isRemoval) {
    // 删除ref
    // v-for时是一个数组
    if (Array.isArray(refs[key])) {
      remove(refs[key], ref)
    } else if (refs[key] === ref) {
      refs[key] = undefined
    }
  } else {
    // 添加ref
    // for循环中使用ref
    if (vnode.data.refInFor) {
      if (!Array.isArray(refs[key])) {
        refs[key] = [ref]
      } else if (refs[key].indexOf(ref) < 0) {
        // $flow-disable-line
        refs[key].push(ref)
      }
    } else {
      refs[key] = ref
    }
  }
}
