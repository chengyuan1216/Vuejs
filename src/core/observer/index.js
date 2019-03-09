/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'
import { log, O2S }  from 'core/util/log.js'

//返回一个数组，包括一个对象其自身的可枚举和不可枚举属性的名称被返回。
const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
// 在某些情况下，我们可能想要禁用组件内部的观察。更新计算
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
/* 每个观察到的观察者类对象。一旦附加，观察者转换目标。
 对象的属性键为getter/setter。收集依赖关系和分派更新。*/
export class Observer {
  value: any;
  dep: Dep;
  //将这个对象作为根$data的vm的数量。
  vmCount: number; // number of vms that has this object as root $data

  constructor (value: any) {
    //log('observer','new Observer()')

    this.value = value // ?
    this.dep = new Dep() // ?
    this.vmCount = 0

    // 被观察过的对象都会有一个 __ob__ 属性， 该属性指向 Observe 对象。
    def(value, '__ob__', this) 
    if (Array.isArray(value)) { 
      const augment = hasProto
        ? protoAugment
        : copyAugment
      augment(value, arrayMethods, arrayKeys)

      //log(0,'new Observer()', 'this.observeArray')
      this.observeArray(value)
    } else {
      // 如果不是数组
      //log(0,'new Observer()', 'this.observeArray')
      // 遍历整个对象
      this.walk(value)
    }
  }

  /**
   * Walk through each property and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  // 遍历每个属性并将其转换为getter / setter。这个方法应该只在 值类型是对象 时候调用。
  walk (obj: Object) {
    //log('observer', 'walk')

    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      //log(0, 'walk', 'defineReactive')
      // 定义访问其属性
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  // 观察一个数组
  observeArray (items: Array<any>) {
    //log('observer', 'observeArray')

    for (let i = 0, l = items.length; i < l; i++) {
      //log(0, 'observeArray', 'observe')
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment an target Object or Array by intercepting
 * the prototype chain using __proto__
 */
//该变某个对象的__proto__的指向原型
function protoAugment (target, src: Object, keys: any) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment an target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
//将src对象的指定的一些属性添加到target身上
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
//尝试创建一个值的观察者实例，
//如果成功观察到新的观察者，
//或现有的观察者，如果该值已经有一个。
// 创建一个对象的 watcher 实例， 并将这个实例返回
export function observe (value: any, asRootData: ?boolean): Observer | void {
  //log('observer', 'observe')
  //如果这不是一个对象， 或者是一个VNode 对象
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  //定义一个ob变量， 它的值可能是Observer对象或者？？？？？
  let ob: Observer | void

  // 如果value有__ob__属性，并且这个属性是一个Observer对象
  // 如果某个对象有__ob__属性则表示这个对象已经被观察过了
  // 直接返回这个对象的__ob__的值
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */
 //在对象上定义一个访问器属性。
export function defineReactive (
  obj: Object,  // 某个对象
  key: string,  // 属性名称
  val: any,     //
  customSetter?: ?Function,
  shallow?: boolean
) {
  //log('observer', 'defineReactive')
  const dep = new Dep() // 在闭包内定义一个 Dep 对象， 用于收集依赖当前属性数据的watcher

  // 先获取属性值， 因为当前属性可能已经是反问其属性
  // 所以需要先获取当前属性的描述对象
  const property = Object.getOwnPropertyDescriptor(obj, key) //获取obj对象的key属性的描述信息
  if (property && property.configurable === false) {
    return  //如果这个属性是不可配置的则不执行下面的代码
  }

  // cater for pre-defined getter/setters
  // 获取obj对象的key属性原有的的get 和 set 的方法
  const getter = property && property.get
  const setter = property && property.set
  //因为set和get默认是 undefined
  //如果只有两个参数， 并且setter存在或者getter不存在时
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }
  // shallow 浅的。 如果是深度观测则将遍历整个对象
  let childOb = !shallow && observe(val)

  //  将obj的key属性定义为访问器属性
  // 注意这里是定义同名属性
  Object.defineProperty(obj, key, {
    enumerable: true, //可枚举的
    configurable: true,   //可配置的
    get: function reactiveGetter () {
      //如果原来有getter方法则调用getter方法
      const value = getter ? getter.call(obj) : val

      // 收集依赖的办法是：
      // 在需要使用data 数据时， 先将指定的 watcher 对象挂靠在 Dep.target 上
      // 所以在使用当前数据时， 如果 Dep.target 上有 watcher 对象，
      // 此时将认为这个 watcher 依赖于当前数据
      // 在当前数据变化时， 会在set方法内通知 watcher 的执行
      if (Dep.target) { 
        //加入依赖
        // 内部的逻辑是 Dep.targer.addDep(dep)
        // 即： 会将 dep 对象加入到 watcher 的依赖项， 也可以说
        // 而 addDep 内部的逻辑是 dep.addSub(watcher)
        // 所以 执行 dep.depend() 完时，
        // 当前有一个 dep 对象 来收集订阅当前数据的 watcher 对象
        // 同时 watcher 对象也能知道自己所依赖的数据（持有当前数据的 Dep 对象）
        dep.depend()
        if (childOb) {
          childOb.dep.depend()
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      childOb = !shallow && observe(newVal)
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  //log('observer', 'set')

  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  //log('observer', 'del')
  
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
