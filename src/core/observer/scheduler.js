/* @flow */

import type Watcher from './watcher'
import config from '../config'
import {
  warn,
  nextTick,
  devtools
} from '../util/index'

const queue: Array<Watcher> = []
let has: { [key: number]: ?true } = {}
let circular: { [key: number]: number } = {}
let waiting = false
let flushing = false
let index = 0

/**
 * Reset the scheduler's state.
 */
function resetSchedulerState () {
  queue.length = 0
  has = {}
  if (process.env.NODE_ENV !== 'production') {
    circular = {}
  }
  waiting = flushing = false
}

/**
 * Flush both queues and run the watchers.
 */
function flushSchedulerQueue () {
  flushing = true

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
  queue.sort((a, b) => a.id - b.id)

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  for (index = 0; index < queue.length; index++) {
    const watcher = queue[index]
    const id = watcher.id
    has[id] = null
    watcher.run()
    // in dev build, check and stop circular updates.
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > config._maxUpdateCount) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }

  // devtool hook
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }

  resetSchedulerState()
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 * 这里是用来遍历存入更新队列的依赖的方法，vue会异步的，批量的更新&通知观察者修改变化，以此方式最大限量的提升性能
 */
export function queueWatcher (watcher: Watcher) {
  const id = watcher.id//每一个watcher的唯一值
  if (has[id] == null) {
    has[id] = true
    if (!flushing) {
      queue.push(watcher)//待更新数组
    } else {
     /**
      * 
      * flushing 变量是一个标志，我们知道放入队列 queue 中的所有观察者将会在突变完成之后统一执行更新，当更新开始时会将 
      * flushing 变量的值设置为 true，代表着此时正在执行更新，所以根据判断条件 if (!flushing) 
      * 可知只有当队列没有执行更新时才会简单地将观察者追加到队列的尾部，
      * 但是还有典型的例子就是计算属性
      * 
      * 如果只是当队列没有执行更新时才会简单地将观察者追加到队列的尾部
      * 队列执行更新时经常会执行渲染函数观察者的更新，渲染函数中很可能有计算属性的存在，由于计算属性在实现方式上与普通响应式属性有所不同，
      * 所以当触发计算属性的 get 拦截器函数时会有观察者入队的行为，这个时候我们需要特殊处理，也就是 else 分支的代码
      */
      let i = queue.length - 1
      while (i >= 0 && queue[i].id > watcher.id) {
        i--
      }
      queue.splice(Math.max(i, index) + 1, 0, watcher)
      /**
       * 这段代码的作用是为了保证观察者的执行顺序，现在我们只需要知道观察者会被放入 queue 队列中即可，我们后面会详细讨论。
       */
    }
    // queue the flush
    if (!waiting) {
      waiting = true
      nextTick(flushSchedulerQueue)//这里开始对更新队列中的熟悉进行更新，$nextTick 方法是在 renderMixin 函数中挂载到 Vue 原型上的
    }
    //变量 waiting 同样是一个标志，它也定义在 scheduler.js 文件头部，初始值为 false
  }
}
