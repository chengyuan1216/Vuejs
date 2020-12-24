/* @flow */

// 判断是否是异步组件占位节点
export function isAsyncPlaceholder (node: VNode): boolean {
  return node.isComment && node.asyncFactory
}
