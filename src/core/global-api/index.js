/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

import { log, O2S }  from 'core/util/log.js'
export function initGlobalAPI (Vue: GlobalAPI) {
  // log({
  //   title: '执行 initGlobalAPI()',
  //   module: 'global-api'
  // })
  // config
  const configDef = {}
  //定义get方法
  configDef.get = () => config 
  //
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }

  //log('Vue增加静态  config  对象属性')
  //给vue添加一个config属性
  Object.defineProperty(Vue, 'config', configDef)

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.

  //log('Vue增加静态  util  对象属性')
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  //log('Vue增加静态  set  方法')
  Vue.set = set

  //log('Vue增加静态  del  方法')
  Vue.delete = del

  //log('Vue增加静态  nextTick  方法')
  Vue.nextTick = nextTick

  //options是什么？？？
  //Object.create(null) 返回的是一个以null为原型的对象，他没有继承Object()所有的方法
  //log('Vue增加静态  options  属性')
  Vue.options = Object.create(null)

  // 'component',
  // 'directive',
  // 'filter'
  //  给options添加三个属性
  ASSET_TYPES.forEach(type => {
    //log('Vue静态  options  属性，增加 '+ type+'  属性')
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  Vue.options._base = Vue
  //vue.options对象
  // {components: {…}, directives: {…}, filters: {…}, _base: ƒ}
  // components : KeepAlive: {…}, Transition: {…}, TransitionGroup: {…}}
  // directives : {model: {…}, show: {…}}
  // filters : {}
  // _base : ƒ Vue(options)

  //将builtInComponents所有的属性都复制一份给tions.components
  extend(Vue.options.components, builtInComponents)

  //给Vue添加静态方法 Vue.use()
  initUse(Vue)
  //Vue.mixin()
  initMixin(Vue)
  //Vue.extend()
  initExtend(Vue)
  //
  initAssetRegisters(Vue)
}
