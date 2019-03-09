/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { defineComputed, proxy } from '../instance/state'
import { extend, mergeOptions, validateComponentName } from '../util/index'
import { log, O2S }  from 'core/util/log.js'

export function initExtend (Vue: GlobalAPI) {
  /**
   * Each instance constructor, including Vue, has a unique
   * cid. This enables us to create wrapped "child
   * constructors" for prototypal inheritance and cache them.
   */
  Vue.cid = 0
  let cid = 1

  /**
   * Class inheritance
   */
  Vue.extend = function (extendOptions: Object): Function {
    extendOptions = extendOptions || {} // 默认是空
    const Super = this  // super类是vue
    const SuperId = Super.cid
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {}) //会将
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }

    const name = extendOptions.name || Super.options.name
    if (process.env.NODE_ENV !== 'production' && name) {
      validateComponentName(name) // 验证组件的名称
    }

    const Sub = function VueComponent (options) {
      this._init(options)  //内部执行的代码和 Vue 构造函数一样
    }
    Sub.prototype = Object.create(Super.prototype) // 创建子类组建的构造方法
    Sub.prototype.constructor = Sub // 
    Sub.cid = cid++
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    )
    Sub['super'] = Super

    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.
    if (Sub.options.props) {
      initProps(Sub)
    }
    if (Sub.options.computed) {
      initComputed(Sub)
    }

    // allow further extension/mixin/plugin usage
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // create asset registers, so extended classes
    // can have their private assets too.
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })
    // enable recursive self-lookup 默认自己在组件选项中，在递归调用自己可以用到
    if (name) {
      Sub.options.components[name] = Sub
    }

    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.
    Sub.superOptions = Super.options
    Sub.extendOptions = extendOptions
    Sub.sealedOptions = extend({}, Sub.options)

    // cache constructor
    cachedCtors[SuperId] = Sub // 将 option 得到的构造函数缓存起来
    return Sub
  }
}

/*

initProps 最终的目的就是在原型上定义 prop 的访问器属性
Object.defineProperty(Sub.prototype, 'a', {
  enumerable: true, // 可遍历
  configurable: true, // 可配置
  get: function proxyGetter () {
    return this['_props']['a']
  }, 
  set: function proxySetter (val) {
    this['_props']['a'] = val
  }
})


*/
function initProps (Comp) {
  const props = Comp.options.props
  console.log('props', props)
  for (const key in props) {
    proxy(Comp.prototype, `_props`, key)
  }
}


/*
在定义 计算属性时， set 和 get 方法均由用户指定
会在原型上生成对应的访问器属性
为什么要在原型上定义？？？
1、访问器属性的本质就是通过get方法获取该属性的值， 也就是说在实例中访问属性a 时都要执行
相同的get 方法， 共同的方法放在原型上才合适
2、既然时访问原型上的方法， 那么在实例访问时this也是指向的当前实例。
Object.defineProperty(Sub.prototype, 'a', {
  enumerable: true, // 可遍历
  configurable: true, // 可配置
  get: noop,
  set: noop
})

*/
function initComputed (Comp) {
  const computed = Comp.options.computed
  for (const key in computed) {
    defineComputed(Comp.prototype, key, computed[key])
  }
}


/**
 * option._Ctor[0] == myComponent 的值为true
 * 在使用 option 继承过一次后将会缓存得到的子类构造器
 * 
 * Vue.extend() 的原理无非是通过合并策略扩展了一些Vue的配置选项， 得到的子类构造器的使用方式一样，
 * 无非是构造函数更加具体。
 * 
 * 
 * 例子：
 * 	  var option = {
				data() {
					return {
						c: 1
					}
				}
			}

      // 通过 option 扩展得到自定义的组件构造函数
      // 在自定义组件实例中都有 c 属性
			var myComponent = Vue.extend(option)

      // 在实际的使用过程中又增加了自己的属性
      // 从开始到使用经过了两次 option 的合并
			new myComponent({
				data() {
					return {d: 2}
				}
			}).$mount('#test')

			new myComponent().$mount('#test1')
 * 
 * 
 */