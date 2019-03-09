import Vue from './instance/index'
import { initGlobalAPI } from './global-api/index'
import { isServerRendering } from 'core/util/env'
import { FunctionalRenderContext } from 'core/vdom/create-functional-component'
import { log, O2S }  from 'core/util/log.js'

//log('Vue', '开始执行')
initGlobalAPI(Vue)

Object.defineProperty(Vue.prototype, '$isServer', {
  get: isServerRendering
})

Object.defineProperty(Vue.prototype, '$ssrContext', {
  get () {
    /* istanbul ignore next */
    return this.$vnode && this.$vnode.ssrContext
  }
})

// expose FunctionalRenderContext for ssr runtime helper installation
Object.defineProperty(Vue, 'FunctionalRenderContext', {
  value: FunctionalRenderContext
})

Vue.version = '__VERSION__'

export default Vue
/*

	这模块对Vue进行了继续扩展。
	
	initGlobalAPI(Vue)
		这里与core模块里不同的是这里扩展的都是静态属性。
		Object.defineProperty(Vue, 'config', configDef)
	  Vue.util = {
	    warn,
	    extend,
	    mergeOptions,
	    defineReactive
	  }
	  Vue.set = set
	  Vue.delete = del
	  Vue.nextTick = nextTick
	  Vue.options = Object.create(null)
	    用于存储全局的component， directive， filter
	  Vue.options._base = Vue
	  initUse(Vue)
	  	给Vue定义了use方法， 该方法定义了定义和使用Vue插件的规则。
  		
	  initMixin(Vue)
	  initExtend(Vue)
	  initAssetRegisters(Vue)

*/