import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'
import { log, O2S, debugConfig, $debug }  from 'core/util/log.js'

//定义Vue的构造函数
function Vue (options) {
  if (debugConfig['src/stance/index/Vue']) debugger
  //$debug(true)
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  //_init在哪里定义的？？？？
  this._init(options)
}

//定义了_init() 用于初始化option
initMixin(Vue)
//Vue原型 添加了$data $props $set $delete $watch
stateMixin(Vue)
//Vue原型 添加了$on $watch $off $once
eventsMixin(Vue)
//
lifecycleMixin(Vue)
//
renderMixin(Vue)

export default Vue

/*
  这个模块只做了一件事， 输出构造函数 Vue。
  在初始化构造函数的是通过模块组装的方式来扩展 Vue 的构造方法的。

  1、initMixin(Vue)
  定义了一个 Vue.prototype._init 方法。 这个方法会在构造方法中会调用到。

  2、stateMixin(Vue)
    Object.defineProperty(Vue.prototype, '$data', dataDef)     
    Object.defineProperty(Vue.prototype, '$props', propsDef)   
    Vue.prototype.$set = set
    Vue.prototype.$delete = del
    Vue.prototype.$watch
    在这个函数中做了上面5件事。
    dataDef 和 propsDef 是什么呢？
    如果你熟悉defineProperty的话不难猜出， dataDef 和 propsDef都是一个用于描述定义的字段的信息的对象（数据属性和访问器属性）。
    const dataDef = {}
    dataDef.get = function () { return this._data }
    但这里只有get属性。

  3、eventsMixin(Vue)
    Vue.prototype.$on
    Vue.prototype.$once
    Vue.prototype.$off
    Vue.prototype.$emit
    定义了一套Vue 自己的事件处理系统。

  4、lifecycleMixin(Vue)
    Vue.prototype._update
    Vue.prototype.$forceUpdate
    Vue.prototype.$destroy

  5、renderMixin(Vue)
    Vue.prototype.$nextTick
    Vue.prototype._render


*/

/*
  而且在构造函数构造一个Vue实例时，也只调用了一个方法 this._init(options),
  这个方法是在原型上定义的。

  那么， 来看看这个方法到底做了哪些事情吧！

  Vue.prototype._init = function (options?: Object) {

    initLifecycle(vm)
    初始化生命周期。
    这里定义了vm的一些属性$parent, $children, $root, $refs, 等。。。

    initEvents(vm)
    初始化事件。

    initRender(vm)
    初始化渲染。

    callHook(vm, 'beforeCreate')
    执行beforeCreate钩子函数。
    在这个钩子函数内部是访问不到任何data, props, inject数据的。

    initInjections(vm) // resolve injections before data/props
    获取父组件注入的数据。

    initState(vm)
    初始化props, methods, data, computed, watch


    initProvide(vm) // resolve provide after data/props
    初始化注入到子组件的数据。

    callHook(vm, 'created')
    当所有的初始化都完成后，将执行created钩子函数。这个时候并没又开始模板的编译工作。
 
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
    如果在配置中配置了el选项， 则执行$mount()函数。
    当然， 你也可以手动调用这个函数。
    你一定好奇在$mount()函数, Vue做了一些什么事情吧？ 这将是另一个话题了。
  }

*/

/*
  那么$mount 是在哪里定义的呢？

  定义$mount() 的模块并不是在core目录下， 而是在platforms的目录下。

  找到platforms下的entry-runtime-with-compiler.js模块。
  整个项目打包成Vue.js文件时就是从这个文件开始的。

  那么打开这个文件看看都发生了什么吧！
  Vue.prototype.$mount
  Vue.compile = compileToFunctions


*/