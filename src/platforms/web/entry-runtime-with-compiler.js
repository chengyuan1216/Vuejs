/* @flow */

import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index'
import { query } from './util/index'
import { compileToFunctions } from './compiler/index'
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from './util/compat'
import { log, O2S, debugConfig }  from 'core/util/log.js'

const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})

// 这里保存的是runtime/index下的$mount
// 这个方法是 runtime 版本执行的， 比如 webpck 在打包的时候就已经将template 编译成
// render 函数了， 不需要再次经过下面的模板编译过程
// 实际上在 compiler + runtime 版本中会先执行下面的模板编译过程、
// 再将执行免编译版本的 $mount, 即这里缓存的 $mount 方法

// 这个方法做了 3 件事
// 1、获取模板字符串
// 2、将模板那字符串解析成 render 函数
// 3、执行 runtime 版本的 $mount 方法
const mount = Vue.prototype.$mount   
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  //log('entry-runtime-with-compiler', '执行$mount')
  if (debugConfig['src/platforms/entry-runtime-with-compiler/$mount']) debugger

  // 获取当前挂载的 DOM 元素
  el = el && query(el)    // 获取element
  /* istanbul ignore if */
  // 如果挂载的元素是 html 或者 body 时将会发出警告
  // 因为 vue 最终会将生成的 DOM 替换挂载元素
  // 也就是说 挂载元素仅仅是一个占位元素
  if (el === document.body || el === document.documentElement) { // vm实例不允许绑定html或body元素
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  const options = this.$options
  // resolve template/el and convert to render function
  //编译使用的模板顺序是 render函数 >  template > el
  //如果有 render函数， 就算定义了el 和 template 也不会使用
  //el 和 template 的相比， template的优先级更高
  if (!options.render) {               
    let template = options.template
    if (template) {
      if (typeof template === 'string') {
        if (template.charAt(0) === '#') {   // 通过id获取模板字符串
          template = idToTemplate(template)
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      } else if (template.nodeType) {     // 如果是一个DOM元素则取innerHTML
        template = template.innerHTML
      } else {
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {
      template = getOuterHTML(el)
    }

    // 如果获取到模板字符串后
    if (template) {
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }

      // 在获取到模板字符串后会将字符串编译成render 函数
      // 模板字符串
      //    "<div id="test">
      //      <!-- <input type="input" v-model="c"> -->
      // 			<h1>测试</h1>
      // 			<h1 ref="header">c: {{c}}</h1>
      // 			<!-- <h1>d: {{d}}</h1> -->
      // 			<button v-on:click="clickBtn">按钮</button>
      // 		</div>"
      // 生成的render 函数
      // (function anonymous() {
      //   with(this){return _c('div',{attrs:{"id":"test"}},[_c('h1',[_v("测试")]),_v(" "),_c('h1',{ref:"header"},[_v("c: "+_s(c))]),_v(" "),_c('button',{on:{"click":clickBtn}},[_v("按钮")])])}
      // })
      // 问题： 手写的render函数与 模板编译的render 函数有什么区别？
      // 模板编译的render函数可以解析指令， 手写的render函数需要自己通过js实现指令完成的功能
      const { render, staticRenderFns } = compileToFunctions(template, { // 将template 编译成render函数
        shouldDecodeNewlines,
        shouldDecodeNewlinesForHref,
        delimiters: options.delimiters,
        comments: options.comments
      }, this)

      // 在模板编译成 render 函数后， 配置选项上将会多出render方法
      // 就算再次执行这个方法也不会重新编译
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  return mount.call(this, el, hydrating)  
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML (el: Element): string {   // 获取挂载元素的outerHTML
  if (el.outerHTML) {                           // 如果兼容outerHTML 则直接返回
    return el.outerHTML
  } else {
    const container = document.createElement('div') // 如果不兼容则直接用div包裹
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

Vue.compile = compileToFunctions

export default Vue

/*
  $mount() 函数执行的流程：



  createCompilerCreator(function baseCompile {...})
        ↓  src/compiler/create-compiler
        ↓
        ↓
        ↓
  createCompiler(baseOptions)
        ↓ src/compiler/index
        ↓ 1、编译HTML字符串成ast树
        ↓   parse(template.trim(), options)
        ↓
        ↓ 2、静态优化
        ↓   optimize(ast, options)
        ↓
        ↓ 3、生成render 函数
        ↓   generate(ast, options)
        ↓
  compileToFunctions()
        ↓ src/platforms/web/compiler/index
        ↓
        ↓
        ↓
        ↓
  render, staticRenderFns （render函数）
  
  模板
  <div id="test">
    <h1>测试</h1>
    <h1>c: {{c}}</h1>
  </div>

  ast树
  parse(template.trim(), options)
  {
    attrs: [
      {name: "id", value: ""test""}
    ],
    attrsList: [
      {name: "id", value: "test"}
    ],
    attrsMap: {
      id: "test"
    },
    children: [
      {
        attrsList: [],
        attrsMap: {},
        children: [
          {type: 3, text: "测试", static: true}
        ],
        parent: "指向div的引用",
        plain:true,
        static:true,
        staticInFor:false,
        staticRoot:false,
        tag:"h1",
        type:1
      },
      {
        type: 3,
        text: " ",
        static: true
      },
      {
        attrsList: [],
        attrsMap: {},
        children: [
          {
            expression:"'c: '+_s(c)",
            static:false,
            text:"c: {{c}}",
            tokens: ["c: ", {@binding: "c"}],
            type:2
          }
        ],
        parent: "指向div的引用",
        plain:true,
        static:false,
        staticRoot:false,
        tag:"h1",
        type:1
      }
    ],
    parent: undefined,
    plain: false,
    static: false,
    staticRoot: false,
    tag: "div",
    type: 1
  }

  静态优化
  optimize(ast, options)
  
  生成render字符串
  generate(ast, options)
  {
    render:"with(this){return _c('div',{attrs:{"id":"test"}},[_c('h1',[_v("测试")]),_v(" "),_c('h1',[_v("c: "+_s(c))])])}"
    staticRenderFns:[]
  }

  render函数
  (function() {
    with(this){
      return _c(
        'div',
        {attrs:{"id":"test"}},
        [
          _c('h1',[_v("测试")]),
          _v(" "),
          _c('h1',[_v("c: "+_s(c))])
        ]
      )
    }
  })




  
*/


// 下面的代码是根据上面的流程生成的

// let createCompiler = createCompilerCreator(baseCompile)
// let baseOptions = {}
// let compileToFunctions = createCompiler(baseOptions)
// const { render, staticRenderFns } = compileToFunctions(template, { // 将template 编译成render函数
//   shouldDecodeNewlines,
//   shouldDecodeNewlinesForHref,
//   delimiters: options.delimiters,
//   comments: options.comments
// }, this)

// function baseCompile (
//   template: string,
//   options: CompilerOptions
// ): CompiledResult {
//   const ast = parse(template.trim(), options) // 生成抽象语法树
//   if (options.optimize !== false) {
//     optimize(ast, options)
//   }
//   const code = generate(ast, options)
//   return {
//     ast,
//     render: code.render,
//     staticRenderFns: code.staticRenderFns
//   }
// }

// function createCompilerCreator (baseCompile: Function): Function {
//   return function createCompiler (baseOptions: CompilerOptions) {
//     function compile (
//       template: string,
//       options?: CompilerOptions
//     ): CompiledResult {
//       const finalOptions = Object.create(baseOptions)
//       const errors = []
//       const tips = []
//       finalOptions.warn = (msg, tip) => {
//         (tip ? tips : errors).push(msg)
//       }

//       if (options) {
//         // merge custom modules
//         if (options.modules) {
//           finalOptions.modules =
//             (baseOptions.modules || []).concat(options.modules)
//         }
//         // merge custom directives
//         if (options.directives) {
//           finalOptions.directives = extend(
//             Object.create(baseOptions.directives || null),
//             options.directives
//           )
//         }
//         // copy other options
//         for (const key in options) {
//           if (key !== 'modules' && key !== 'directives') {
//             finalOptions[key] = options[key]
//           }
//         }
//       }

//       const compiled = baseCompile(template, finalOptions)
//       if (process.env.NODE_ENV !== 'production') {
//         errors.push.apply(errors, detectErrors(compiled.ast))
//       }
//       compiled.errors = errors
//       compiled.tips = tips
//       return compiled
//     }

//     return {
//       compile,
//       compileToFunctions: createCompileToFunctionFn(compile)
//     }
//   }
// }