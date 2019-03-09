/* @flow */
/* globals MessageChannel */

import { noop } from 'shared/util'
import { handleError } from './error'
import { isIOS, isNative } from './env'

const callbacks = [] // 缓存所有任务
let pending = false

// 执行所有的回调函数
function flushCallbacks () {
  pending = false                           // 将状态变为false
  const copies = callbacks.slice(0)         // 复制
  callbacks.length = 0                      // 将数组清空
  for (let i = 0; i < copies.length; i++) { // 执行所有的回调函数
    copies[i]()
  }
}

// Here we have async deferring wrappers using both microtasks and (macro) tasks.
// In < 2.4 we used microtasks everywhere, but there are some scenarios where
// microtasks have too high a priority and fire in between supposedly
// sequential events (e.g. #4521, #6690) or even between bubbling of the same
// event (#6566). However, using (macro) tasks everywhere also has subtle problems
// when state is changed right before repaint (e.g. #6813, out-in transitions).
// Here we use microtask by default, but expose a way to force (macro) task when
// needed (e.g. in event handlers attached by v-on).
let microTimerFunc //微任务， 在主线程执行完或者执行完一个宏任务时都会清空所有的微任务
let macroTimerFunc //宏任务
let useMacroTask = false

// Determine (macro) task defer implementation.
// Technically setImmediate should be the ideal choice, but it's only available
// in IE. The only polyfill that consistently queues the callback after all DOM
// events triggered in the same loop is by using MessageChannel.
/*
  let ID = window.setImmediate()
  window.clearImmediate(ID)
  目前只有 Internet Explorer 10实现了该方法。
  该方法用来把一些需要长时间运行的操作放在一个回调函数里,
  在浏览器完成后面的其他语句后,就立刻执行这个回调函数。

  作用：
  该方法可以用来替代 setTimeout(0) 方法来滞后完成一些需要占用大量cpu时间的操作。
  下面的JavaScript可以用来兼容那些不支持setImmediate方法的浏览器:
  if (!window.setImmediate) {
    window.setImmediate = function(func, args){
      return window.setTimeout(func, 0, args);
    };
    window.clearImmediate = window.clearTimeout;
  }

*/
/* istanbul ignore if */

/*
  macro task   与   micro task 的区别？？？？
  下面的代码 定义了一个macroTimerFunc函数
*/
if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {  // 如果window.setImmediate存在， 并且这是一个原生方法
  macroTimerFunc = () => {
    setImmediate(flushCallbacks)
  }
} else if (typeof MessageChannel !== 'undefined' && ( // 如果宿主环境支持MessageChannel(利用两个端口来实现消息的传递)
  isNative(MessageChannel) ||
  // PhantomJS
  MessageChannel.toString() === '[object MessageChannelConstructor]'
)) {
  const channel = new MessageChannel()      // 这里利用MessageChannel来实现异步执行flushCallbacks
  const port = channel.port2
  channel.port1.onmessage = flushCallbacks
  macroTimerFunc = () => {
    port.postMessage(1)                     // 由port2 向port1 发送消息， 将会触发port1的onmessage事件
  }
} else {
  /* istanbul ignore next */
  macroTimerFunc = () => {
    setTimeout(flushCallbacks, 0)
  }
}

// Determine microtask defer implementation.
/* istanbul ignore next, $flow-disable-line */
/*

  下面的代码 定义了一个 microTimerFunc 函数
*/
if (typeof Promise !== 'undefined' && isNative(Promise)) {    // 如果宿主环境有promise对象
  const p = Promise.resolve()
  microTimerFunc = () => {
    p.then(flushCallbacks)
    // in problematic UIWebViews, Promise.then doesn't completely break, but
    // it can get stuck in a weird state where callbacks are pushed into the
    // microtask queue but the queue isn't being flushed, until the browser
    // needs to do some other work, e.g. handle a timer. Therefore we can
    // "force" the microtask queue to be flushed by adding an empty timer.
    if (isIOS) setTimeout(noop)
  }
} else {
  // fallback to macro
  microTimerFunc = macroTimerFunc
}

/**
 * Wrap a function so that if any code inside triggers state change,
 * the changes are queued using a (macro) task instead of a microtask.
 */
export function withMacroTask (fn: Function): Function { // 参数是一个函数， 返回值也是一个函数
  return fn._withTask || (fn._withTask = function () {   // 给函数定义一个_withTask属性， 这个属性的值是一个函数
    useMacroTask = true                                  // _withTask函数
    const res = fn.apply(null, arguments)
    useMacroTask = false
    return res
  })
}

export function nextTick (cb?: Function, ctx?: Object) { // 参数1是一个回调函数，参数2是回调函数执行的上下文。
  let _resolve

  // callbacks数组用于保存回调函数
  callbacks.push(() => {                // 将回调函数加入callbacks栈
    if (cb) {
      try {
        cb.call(ctx)
      } catch (e) {
        handleError(e, ctx, 'nextTick')
      }
    } else if (_resolve) {
      _resolve(ctx)
    }
  })
  if (!pending) {                       // 如果pengding 的状态是false， 将直接执行回调
    pending = true
    if (useMacroTask) {                 // 否则
      macroTimerFunc()
    } else {
      microTimerFunc()
    }
  }
  // $flow-disable-line
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      _resolve = resolve
    })
  }
}


/*
  这个模块主要是定义了  nextTick  方法， 用于异步调用回调函数。
  该方法的核心是 
  callbacks： 缓存所有需要执行的函数, 当开启一个异步任务时将会遍历执行所有回调函数
  pending: 状态为 true 时表示已经开启了一个异步任务但是还未执行， 当开始执行callbacks的所有回调时 pending
  的状态将会变为 false 。

  在pending 为true时，表示已开启一个异步任务， 而在执行这个异步任务之前， 这期间所有的nextTick回调都会
  加入当前的callbacks。在执行异步任务时将会清空 callbacks， 并且pending的状态变为 false。
*/