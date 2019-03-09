/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'
import { log, O2S, debugConfig}  from 'core/util/log.js'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute
} from '../util/index'

const sharedPropertyDefinition = {
  enumerable: true, // 可遍历
  configurable: true, // 可配置
  get: noop, 
  set: noop
}

export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

export function initState (vm: Component) {
  // log({
  //   title: '执行 initState()',
  //   module: 'state',
  //   desc: '初始化配置props、methods、computed、watch',
  // })
  vm._watchers = []
  const opts = vm.$options
  if (opts.props) initProps(vm, opts.props)
  if (opts.methods) initMethods(vm, opts.methods)
  // 有 data 和没有data 的区别在于： 有 data 会进行属性名称的验证
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  if (opts.computed) initComputed(vm, opts.computed)
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}

function initProps (vm: Component, propsOptions: Object) {
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent
  // root instance props should be converted
  if (!isRoot) {
    toggleObserving(false)
  }
  for (const key in propsOptions) {
    keys.push(key)
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      const hyphenatedKey = hyphenate(key)
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        if (vm.$parent && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
}

function initData (vm: Component) {
  let data = vm.$options.data
  // vm._data 将做为 vm.$data 的get方法的返回值
  // $data 是定义在原型上面的访问其属性， 所以尽管是在原型上定义的属性， 但是不同的实例访问时 执行get 方法时
  // this 指向当前vm实例， 所以访问的并不是同一份数据。
  data = vm._data = typeof data === 'function' // 如果data是一个function, 则执行这个函数，将这个函数的返回值赋值给 data
    ? getData(data, vm)
    : data || {}
  
  // 验证 data , 如果不是一个对象将会提出警告
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  // 在vm 实例上代理 data
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  // 先判断methods 和 props 上是否有同名属性
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
      // 在vm对象上通过定义同名的访问器属性来代理 _data
      // 比如： 
      //  Object.defineProperty(vm, 'a', {
      //    get() {
      //      return vm._data['a']
      //    }
      //  })
      // 在上面已经知道 vm.$data === vm._data
      // 所以在 vm.$data 上可以访问所有的 data 属性。
      proxy(vm, `_data`, key) 
    }
  }
  // observe data
  // 在经过上面的代理后， 将data 对象也就是 _data 对象转换成访问器属性。
  // 在定义访问器属性的过程中通过 get 方法来收集所有使用过data数据的watcher
  // 在 set 方法中，通知所有watcher
  observe(data, true /* asRootData */)
}

export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  pushTarget()
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

const computedWatcherOptions = { computed: true }

// 初始化计算属性
// 做了以下几件事情
// 1、所有的计算属性watcher 均在 _computedWatchers 对象上
// 2、
function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()

  // 遍历用于定义的 computed 属性
  for (const key in computed) {
    // 获取用户定义的 get set 方法
    const userDef = computed[key]
    // 如果是一个函数则默认是 getter 方法， set方法为空
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // create internal watcher for the computed property.
      // 创建一个 Watcher 对象用于收集 计算属性的依赖
      // 其实大体上与 renderWatcher 相似， 都是通过数据源的set方法来通知watcher
      watchers[key] = new Watcher(
        vm, // 上下文
        getter || noop, // 回调
        noop,
        computedWatcherOptions // 用于标识computed 属性的watcher
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    // 同样的必须先判断vm是否已存在同名属性
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}

export function defineComputed (
  target: any, // vm
  key: string, // 计算属性名
  userDef: Object | Function // 用户定义的get set 方法
) {
  // 当且仅浏览器环境下才会缓存值
  const shouldCache = !isServerRendering() 
  if (typeof userDef === 'function') { // 只有get方法时
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : userDef
    sharedPropertyDefinition.set = noop // 默认设置的是一个空函数
  } else {  // 
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false // 用户可以设置不缓存
        ? createComputedGetter(key)
        : userDef.get // 不缓存时每次都是执行get方法
      : noop
    sharedPropertyDefinition.set = userDef.set
      ? userDef.set
      : noop
  }
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }

  // Object.defineProperty(vm, 'c', {get(){return this.a}, set(){}})
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

// 如果需要缓存computed 属性，则第二次以后访问的都是缓存的值
function createComputedGetter (key) {
  return function computedGetter () {
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      watcher.depend()
      return watcher.evaluate()
    }
  }
}

function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      if (methods[key] == null) {
        warn(
          `Method "${key}" has an undefined value in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }

    // 实际上 vm 会代理 methods 对象上的方法， 同时将方法this 指向 vm 
    // 如果属性值为 null 则会赋值一个空函数
    vm[key] = methods[key] == null ? noop : bind(methods[key], vm)
  }
}

function initWatch (vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

function createWatcher (
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  if (debugConfig['src/stance/state/stateMixin']) debugger
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.

  const dataDef = {}
  dataDef.get = function () { return this._data }

  const propsDef = {}
  propsDef.get = function () { return this._props }

  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function (newData: Object) {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }

  //给原型添加连个属性
  //log('Vue原型增加了$data属性, 该属性是一个访问器属性，get()返回 this._data')
  Object.defineProperty(Vue.prototype, '$data', dataDef)

  //log('Vue原型增加了$props属性, 该属性是一个访问器属性，get()返回 this._props')
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  //log('Vue原型增加了$set属性')
  Vue.prototype.$set = set

  //log('Vue原型增加了$delete属性')
  Vue.prototype.$delete = del


  //$wacth方法
  //log('Vue原型增加了$watch属性')
  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    options.user = true
    const watcher = new Watcher(vm, expOrFn, cb, options)
    if (options.immediate) { // 如果 immediate 的值为 true, 将会立即执行回调 cb
      cb.call(vm, watcher.value)
    }
    return function unwatchFn () { // $watch 的返回值是一个函数，用于取消 watch
      watcher.teardown()
    }
  }
}
