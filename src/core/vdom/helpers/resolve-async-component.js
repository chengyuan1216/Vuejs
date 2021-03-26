/* @flow */

import {
  warn,
  once,
  isDef,
  isUndef,
  isTrue,
  isObject,
  hasSymbol,
  isPromise,
  remove
} from 'core/util/index'

import { createEmptyVNode } from 'core/vdom/vnode'
import { currentRenderingInstance } from 'core/instance/render'

function ensureCtor (comp: any, base) {
  if (
    comp.__esModule ||
    (hasSymbol && comp[Symbol.toStringTag] === 'Module')
  ) {
    comp = comp.default
  }
  return isObject(comp)
    ? base.extend(comp)
    : comp
}

// 创建异步组件占位符
export function createAsyncPlaceholder (
  factory: Function,
  data: ?VNodeData,
  context: Component,
  children: ?Array<VNode>,
  tag: ?string
): VNode {
  const node = createEmptyVNode()
  node.asyncFactory = factory
  // 将父组件传进来的一些数据保存起来，在组件reslove的时候使用
  node.asyncMeta = { data, context, children, tag }
  return node
}

export function resolveAsyncComponent (
  factory: Function,
  baseCtor: Class<Component>
): Class<Component> | void {
  // 如果异步组件出现错误
  if (isTrue(factory.error) && isDef(factory.errorComp)) {
    return factory.errorComp
  }

  // 异步组件获取的到的options会在resolved属性上
  if (isDef(factory.resolved)) {
    return factory.resolved
  }

  // 当前正在渲染的组件
  const owner = currentRenderingInstance
  if (owner && isDef(factory.owners) && factory.owners.indexOf(owner) === -1) {
    // already pending
    factory.owners.push(owner)
  }

  // loading展示
  if (isTrue(factory.loading) && isDef(factory.loadingComp)) {
    return factory.loadingComp
  }

  // 第一次使用
  if (owner && !isDef(factory.owners)) {
    // owners用来保存那些组件实例用到了这个异步组件
    const owners = factory.owners = [owner]
    let sync = true
    let timerLoading = null
    let timerTimeout = null
    // 当父组件被销毁时，父组件从owners上移除
    ;(owner: any).$on('hook:destroyed', () => remove(owners, owner))

    // 当异步组件请求返回时, 父组件强制更新
    const forceRender = (renderCompleted: boolean) => {
      for (let i = 0, l = owners.length; i < l; i++) {
        (owners[i]: any).$forceUpdate()
      }
      // 渲染完成后清空owners
      if (renderCompleted) {
        owners.length = 0
        if (timerLoading !== null) {
          clearTimeout(timerLoading)
          timerLoading = null
        }
        if (timerTimeout !== null) {
          clearTimeout(timerTimeout)
          timerTimeout = null
        }
      }
    }

    // 当异步组件被rsolve时
    const resolve = once((res: Object | Class<Component>) => {
      // cache resolved
      // 使用extend的到子类构造函数，并且缓存在resolved属性上
      factory.resolved = ensureCtor(res, baseCtor)
      // invoke callbacks only if this is not a synchronous resolve
      // (async resolves are shimmed as synchronous during SSR)
      if (!sync) {
        forceRender(true)
      } else {
        owners.length = 0
      }
    })

    const reject = once(reason => {
      process.env.NODE_ENV !== 'production' && warn(
        `Failed to resolve async component: ${String(factory)}` +
        (reason ? `\nReason: ${reason}` : '')
      )
      if (isDef(factory.errorComp)) {
        factory.error = true
        forceRender(true)
      }
    })

    // 注册时，定义的异步组件是一个函数，直接执行即可
    const res = factory(resolve, reject)

    // 如果factory执行后返回的是一个对象
    if (isObject(res)) {
      // 返回的是一个promise对象
      /**
        function (resolve, reject) {
          setTimeout(function () {
            resolve({
              template: '<div>I am async!</div>'
            })
          }, 1000)
        }
        */
      if (isPromise(res)) {
        // () => Promise
        if (isUndef(factory.resolved)) {
          res.then(resolve, reject)
        }

      /*
        const AsyncComponent = () => ({
          // 需要加载的组件 (应该是一个 `Promise` 对象)
          component: import('./MyComponent.vue'),
          // 异步组件加载时使用的组件
          loading: LoadingComponent,
          // 加载失败时使用的组件
          error: ErrorComponent,
          // 展示加载时组件的延时时间。默认值是 200 (毫秒)
          delay: 200,
          // 如果提供了超时时间且组件加载也超时了，
          // 则使用加载失败时使用的组件。默认值是：`Infinity`
          timeout: 3000
        })
      */
      } else if (isPromise(res.component)) {
        res.component.then(resolve, reject)

        // error组件
        if (isDef(res.error)) {
          factory.errorComp = ensureCtor(res.error, baseCtor)
        }

        // loading组件
        if (isDef(res.loading)) {
          factory.loadingComp = ensureCtor(res.loading, baseCtor)
          if (res.delay === 0) {
            factory.loading = true
          } else {
            timerLoading = setTimeout(() => {
              timerLoading = null
              if (isUndef(factory.resolved) && isUndef(factory.error)) {
                factory.loading = true
                forceRender(false)
              }
            }, res.delay || 200)
          }
        }

        // 请求超时
        if (isDef(res.timeout)) {
          timerTimeout = setTimeout(() => {
            timerTimeout = null
            if (isUndef(factory.resolved)) {
              reject(
                process.env.NODE_ENV !== 'production'
                  ? `timeout (${res.timeout}ms)`
                  : null
              )
            }
          }, res.timeout)
        }
      }
    }

    sync = false
    // return in case resolved synchronously
    return factory.loading
      ? factory.loadingComp
      : factory.resolved
  }
}
