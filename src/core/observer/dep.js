/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'
import { log, O2S }  from 'core/util/log.js'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
// 一个dep是可观察到的， 可以有多个。
// 指令订阅它。
export default class Dep {
  static target: ?Watcher; //静态属性
  id: number;
  subs: Array<Watcher>; //用于收集依赖

  constructor () {
    //log('dep', 'new Dep()')
    this.id = uid++
    this.subs = []
  }

  addSub (sub: Watcher) {
    //log('dep', 'addSub') 
    this.subs.push(sub)
  }

  removeSub (sub: Watcher) {
    //log('dep', 'addSub') 
    remove(this.subs, sub)
  }

  depend () {
    //log('dep', 'addSub') 
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }

  notify () {
    //log('dep', 'notify') 
    // stabilize the subscriber list first
    //首先获取subs列表。复制subs数组
    const subs = this.subs.slice()
    for (let i = 0, l = subs.length; i < l; i++) {
      //?????????????????????????????????????????????????????????????
      subs[i].update()
    }
  }
}

// the current target watcher being evaluated.
// this is globally unique because there could be only one
// watcher being evaluated at any time.
//当前的目标观察者正在被评估。
//这是全局独一无二的，因为只可能有一个。
//在任何时候都要进行评估。
Dep.target = null
const targetStack = []

export function pushTarget (_target: ?Watcher) {
  //log('dep', 'pushTarget') 
  if (Dep.target) targetStack.push(Dep.target)
  Dep.target = _target
}

export function popTarget () {
  //log('dep', 'popTarget') 
  Dep.target = targetStack.pop()
}
