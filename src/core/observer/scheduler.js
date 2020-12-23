/* @flow */

import type Watcher from './watcher'
import config from '../config'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import {
  warn,
  nextTick,
  devtools,
  inBrowser,
  isIE
} from '../util/index'

export const MAX_UPDATE_COUNT = 100

const queue: Array<Watcher> = [] // 异步任务的所有wathcer
const activatedChildren: Array<Component> = []
let has: { [key: number]: ?true } = {} // 用于保存当前任务队列中所有watcher的id
let circular: { [key: number]: number } = {} // 保存在当前任务中wthcher重复执行的次数，超过100次将会警告
let waiting = false // 是否已开启下轮异步任务
let flushing = false // 异步任务是否已经开始
let index = 0 // 当前执行的watcher的索引

/**
 * Reset the scheduler's state.
 */
/* 重置所有状态 */
function resetSchedulerState () {
  index = queue.length = activatedChildren.length = 0
  has = {}
  if (process.env.NODE_ENV !== 'production') {
    circular = {}
  }
  waiting = flushing = false
}

// Async edge case #6566 requires saving the timestamp when event listeners are
// attached. However, calling performance.now() has a perf overhead especially
// if the page has thousands of event listeners. Instead, we take a timestamp
// every time the scheduler flushes and use that for all event listeners
// attached during that flush.
export let currentFlushTimestamp = 0

// Async edge case fix requires storing an event listener's attach timestamp.
let getNow: () => number = Date.now

// Determine what event timestamp the browser is using. Annoyingly, the
// timestamp can either be hi-res (relative to page load) or low-res
// (relative to UNIX epoch), so in order to compare time we have to use the
// same timestamp type when saving the flush timestamp.
// All IE versions use low-res event timestamps, and have problematic clock
// implementations (#9632)
if (inBrowser && !isIE) {
  const performance = window.performance
  if (
    performance &&
    typeof performance.now === 'function' &&
    getNow() > document.createEvent('Event').timeStamp
  ) {
    // if the event timestamp, although evaluated AFTER the Date.now(), is
    // smaller than it, it means the event is using a hi-res timestamp,
    // and we need to use the hi-res version for event listener timestamps as
    // well.
    getNow = () => performance.now()
  }
}

/**
 * Flush both queues and run the watchers.
 */
// 执行队列所有watcher的update方法
function flushSchedulerQueue () {
  // 当前执行队列的时间戳
  currentFlushTimestamp = getNow()
  // 修改状态，表示当前异步任务已经开始执行
  flushing = true
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
  /*
    排序：将所有的wathcer的id从小到大排序
    1. 父组件比子组件先创建所以父组件wathcer的id会比子组件的watcher的id小,因此会先执行父组件的wathcer
    2. userWathcher会比renderWatcher先执行
    3. 如果组件已经销毁将会跳过
  */
  queue.sort((a, b) => a.id - b.id)

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  // 在执行的过程中queue的长度可能是变化的，所以不能缓存queue的长度
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    // 在renderWatcher中将会执行 beforeUpdate 钩子
    if (watcher.before) {
      watcher.before()
    }
    // 执行过之后将wathcer id从has中移除，以便下一次加入队列
    id = watcher.id
    has[id] = null
    // 执行watcher的run方法
    watcher.run()
    // in dev build, check and stop circular updates.
    // 在执行run方法的过程中因为循环依赖等原因导致重复多次加入队列
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      // 如果重复的次数大于100那很有可能是因为依赖循环导致重复执行
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()

  // 重置所有状态
  resetSchedulerState()

  // call component updated and activated hooks
  // 调用actived钩子
  callActivatedHooks(activatedQueue)
  // 调用updated钩子
  callUpdatedHooks(updatedQueue)

  // devtool hook
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}

// 调用所有watcher对应vm实例的updated钩子
function callUpdatedHooks (queue) {
  let i = queue.length
  // 按照从大到小的顺序调用watcher对应的组件的updated生命周期
  // 排序后的wather保证了一定会先执行子组件的update，再执行父组件的update
  while (i--) {
    const watcher = queue[i]
    const vm = watcher.vm
    if (vm._watcher === watcher && vm._isMounted && !vm._isDestroyed) {
      callHook(vm, 'updated')
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 */
/* keep-alive 组件 */
export function queueActivatedComponent (vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  vm._inactive = false
  activatedChildren.push(vm)
}

function callActivatedHooks (queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    activateChildComponent(queue[i], true /* true */)
  }
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 */
export function queueWatcher (watcher: Watcher) {
  const id = watcher.id
  // 如果wathcer不在当前任务队列中
  if (has[id] == null) {
    has[id] = true

    if (!flushing) {
      // 如果异步任务还未开始执行，则直接加入队列
      // 在执行队列的时候会排序， 所以这里不用关心排序的问题
      queue.push(watcher)
    } else {
      // if already flushing, splice the watcher based on its id
      // if already past its id, it will be run next immediately.
      let i = queue.length - 1
      while (i > index && queue[i].id > watcher.id) {
        i--
      }
      // 找到对应的位置后加入到队列中去, 如果队列执行已经过了wathcer的id, 则直接加入到队列的最后
      queue.splice(i + 1, 0, watcher)
    }
    // queue the flush
    // 如果还没有创建任务队列， 则创建任务队列
    // 注意这里只是通过nextTick开启一个异步任务， 但异步任务还未执行
    if (!waiting) {
      waiting = true

      // 用于测试同步执行队列
      if (process.env.NODE_ENV !== 'production' && !config.async) {
        flushSchedulerQueue()
        return
      }
      // 队列是通过nextTick来执行的
      nextTick(flushSchedulerQueue)
    }
  }
}
