/* @flow */

import { extend, warn, isObject } from 'core/util/index'

/**
 * Runtime helper for rendering <slot>
 */
// 渲染slot
export function renderSlot (
  name: string, // slot名称
  fallback: ?Array<VNode>, // <slot name="header"></slot> 标签里定义的默认内容
  props: ?Object,
  bindObject: ?Object
): ?Array<VNode> {
  // 这会挂载到原型上面，所以能访问到实例上的属性
  const scopedSlotFn = this.$scopedSlots[name]
  let nodes

  // 作用域插槽
  if (scopedSlotFn) { // scoped slot
    props = props || {}
    if (bindObject) {
      if (process.env.NODE_ENV !== 'production' && !isObject(bindObject)) {
        warn(
          'slot v-bind without argument expects an Object',
          this
        )
      }
      props = extend(extend({}, bindObject), props)
    }
    // 将绑定的对象传入到scopedSlotFn
    nodes = scopedSlotFn(props) || fallback
  } else {
    // 费作用域插槽
    nodes = this.$slots[name] || fallback
  }

  // <slot name="a" slot="b"></slot>
  // slot的传递，即孙子组件传到爷爷组件哪里去了， 父组件只是中转了一下
  const target = props && props.slot
  if (target) {
    return this.$createElement('template', { slot: target }, nodes)
  } else {
    return nodes
  }
}
