/* @flow */

import { mergeOptions } from '../util/index'
import { log, O2S }  from 'core/util/log.js'

export function initMixin (Vue: GlobalAPI) {
  //log('Vue增加静态  mixin  方法')
  Vue.mixin = function (mixin: Object) {
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
