/* @flow */

import { toArray } from '../util/index'
import { log, O2S }  from 'core/util/log.js'

export function initUse (Vue: GlobalAPI) {
  // log({
  //   title: '执行 initUse()',
  //   module: 'use'
  // })
  
  // log('Vue增加静态  use  方法')
  Vue.use = function (plugin: Function | Object) {
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    const args = toArray(arguments, 1)
    args.unshift(this)
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      plugin.apply(null, args)
    }
    installedPlugins.push(plugin)
    return this
  }
}
