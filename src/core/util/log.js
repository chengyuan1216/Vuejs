/* @flow */
let logId = 1
let _debug = console.debug
let isTrace = 0
let modules = {
  'global-api': true,//core/global-api
  'assets': true,
  'extend': true,
  'mixin': true,
  'use': true,

  'Vue': true, //core/instance
  'events':true,
  'init':true,
  'inject':true,
  'lifecycle':true,
  'proxy':true,
  'render':true,
  'state':true,  

  'array':true,//core/observer
  'dep':true,
  'observer':true,
  'scheduler':true,
  'traverse':true,
  'watcher':true,

  'entry-compiler':true, //platforms/web
  'entry-runtime-with-compiler':true,
  'entry-runtime':true,
}
let fun = {
  '0': true,
}
let msg = {
  '1': true
}
export let log = (function(){

  let log = function(config) {
    if (typeof config == 'string') {
      console.log('%c' + config, 'color: #999; font-size:12px;')
    } else {
      if (modules[config.module]) {
        config.title && config.module && console.log('%c' + logId++ + ':' + config.title + '@' + config.module, 'color: red; font-size:20px;')
        config.desc && console.log('%c' + config.desc, 'color: #999; font-size:12px;')
        config.printO && console.log(config.printO)
        config.printS && console.log('%c' + O2S(config.printS), 'color: #999; font-size:12px;')
      }
    }
  }

  return log
})()

let isToString = true
export let O2S = function(obj){
  if(isToString){
    return JSON.stringify(obj, null, 2)
  }
  return ''
}

export let debugConfig = {
  // 扩展构造函数
  'src/stance/init/initMixin': 0
  ,'src/stance/state/stateMixin':0
  ,'src/stance/events/eventsMixin':0
  ,'src/stance/render/renderMixin':0
  ,'src/stance/lifecycle/lifecycleMixin':0

  // 执行构造函数
  ,'src/stance/index/Vue': 1

  // render
  ,'src/platforms/entry-runtime-with-compiler/$mount':0// 编译环境下
  ,'src/platforms/web/runtime/index/$mount':0// 运行环境下
}

export let $debug = function(flag) {
  if (flag) {
    return 'debugger'
  }
}