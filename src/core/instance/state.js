/* @flow */

import Watcher from '../observer/watcher'
import Dep from '../observer/dep'

import {
  set,
  del,
  observe,
  defineReactive,
  observerState
} from '../observer/index'

import {
  warn,
  hasOwn,
  isReserved,
  isPlainObject,
  bind,
  validateProp,
  noop
} from '../util/index'

export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  if (opts.props) initProps(vm, opts.props)
  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  if (opts.computed) initComputed(vm, opts.computed)//计算属性
  if (opts.watch) initWatch(vm, opts.watch)//watch侦听器
}

const isReservedProp = { key: 1, ref: 1, slot: 1 }

function initProps (vm: Component, props: Object) {
  const propsData = vm.$options.propsData || {}
  const keys = vm.$options._propKeys = Object.keys(props)
  const isRoot = !vm.$parent
  // root instance props should be converted
  observerState.shouldConvert = isRoot
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      if (isReservedProp[key]) {
        warn(
          `"${key}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(vm, key, validateProp(key, props, propsData, vm), () => {
        if (vm.$parent && !observerState.isSettingProps) {
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
      defineReactive(vm, key, validateProp(key, props, propsData, vm))
    }
  }
  observerState.shouldConvert = true
}

function initData (vm: Component) {
  let data = vm.$options.data
  data = vm._data = typeof data === 'function'
    ? data.call(vm)
    : data || {}
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  let i = keys.length
  while (i--) {
    if (props && hasOwn(props, keys[i])) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${keys[i]}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else {
      proxy(vm, keys[i])
    }
  }
  // observe data
  observe(data, true /* asRootData */)
}

const computedSharedDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}
/**
 * 拿到用户定义的computed属性，遍历，拿到每个属性get和set 走makeComputedGetter函数
 * 
 */

function initComputed (vm: Component, computed: Object) {
  // 遍历 computed 选项对象
  for (const key in computed) {
    const userDef = computed[key] //它的值是计算属性对象中相应的属性值
    if (typeof userDef === 'function') {
      computedSharedDefinition.get = makeComputedGetter(userDef, vm)
      computedSharedDefinition.set = noop
    } else {
      computedSharedDefinition.get = userDef.get
        ? userDef.cache !== false
          ? makeComputedGetter(userDef.get, vm)
          : bind(userDef.get, vm)
        : noop
      computedSharedDefinition.set = userDef.set
        ? bind(userDef.set, vm)
        : noop
    }
    Object.defineProperty(vm, key, computedSharedDefinition)
  }
}
/**
 * 
 * @param {*} getter 
 * @param {*} owner 
 * makeComputedGetter函数中 每个computed属性实例化一个watcher，
 */
function makeComputedGetter (getter: Function, owner: Component): Function {
  const watcher = new Watcher(owner, getter, noop, {
    lazy: true// 计算属性惰性求值特性
  })
  return function computedGetter () {
    if (watcher.dirty) {
      watcher.evaluate()//触发get属性，将dirty设置为false
    }
    if (Dep.target) {
      watcher.depend()
    }
    return watcher.value
  }
}

function initMethods (vm: Component, methods: Object) {
  for (const key in methods) {
    vm[key] = methods[key] == null ? noop : bind(methods[key], vm)
    if (process.env.NODE_ENV !== 'production' && methods[key] == null) {
      warn(
        `method "${key}" has an undefined value in the component definition. ` +
        `Did you reference the function correctly?`,
        vm
      )
    }
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

function createWatcher (vm: Component, key: string, handler: any) {
  let options
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  vm.$watch(key, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () {
    return this._data
  }
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function (newData: Object) {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
  }
  Object.defineProperty(Vue.prototype, '$data', dataDef)

  Vue.prototype.$set = set
  Vue.prototype.$delete = del



//原型方法$watch方法

  Vue.prototype.$watch = function (
    expOrFn: string | Function,//需要侦听的属性
    cb: Function,//需要执行的回调函数
    options?: Object//watch 可选参数（immediate 或 deep。）
  ): Function {
    const vm: Component = this//定义当前组件的实例
    options = options || {}
    options.user = true// 表该观察者实例是用户创建的
    const watcher = new Watcher(vm, expOrFn, cb, options)
    if (options.immediate) {
      cb.call(vm, watcher.value)
    }
    return function unwatchFn () {
      watcher.teardown()
    }
    /**
     * 返回的是一个函数unwatchFn,这个函数的执行会解除当前观察者对属性的观察
     * console.log(e.target)//触发事件的元素，current是绑定的元素
     */
  }
}

function proxy (vm: Component, key: string) {
  if (!isReserved(key)) {
    Object.defineProperty(vm, key, {
      configurable: true,
      enumerable: true,
      get: function proxyGetter () {
        return vm._data[key]
      },
      set: function proxySetter (val) {
        vm._data[key] = val
      }
    })
  }
}
