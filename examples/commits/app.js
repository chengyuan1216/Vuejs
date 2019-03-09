var apiURL = 'https://api.github.com/repos/vuejs/vue/commits?per_page=3&sha='

/**
 * Actual demo
 */

var demo = new Vue({

  el: '#demo',

  data: {
    branches: ['master', 'dev'],
    currentBranch: 'master',
    commits: null
  },

  created: function () {
    this.fetchData()
  },

  watch: {
    currentBranch: 'fetchData'
  },

  filters: {
    truncate: function (v) {
      var newline = v.indexOf('\n')
      return newline > 0 ? v.slice(0, newline) : v
    },
    formatDate: function (v) {
      return v.replace(/T|Z/g, ' ')
    }
  },

  methods: {
    fetchData: function () {
      var xhr = new XMLHttpRequest()
      var self = this
      xhr.open('GET', apiURL + self.currentBranch)
      xhr.onload = function () {
        self.commits = JSON.parse(xhr.responseText)
        console.log(self.commits[0].html_url)
      }
      xhr.send()
    }
  }
})

function toRawType (value){
  console.trace()
  return Object.prototype.toString.call(value).slice(8, -1)
}
var o = {
  a:1,
  b:{
    c:'2',
    d:3
  },
  e:[1,2,3]
}
var s = JSON.stringify(o, function(k, v){
  console.log(k)
  //console.log(v)
  return ["a"];
})
console.log(s)
