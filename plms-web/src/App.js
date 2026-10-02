import { h } from 'vue'
import { RouterView } from 'vue-router'
import { useDataStore } from './stores/data.js'

/**
 * 应用根组件。
 * 负责：首屏水合（加载态 / 失败重试态）与路由出口。
 */
export default {
  name: 'App',
  setup() {
    const data = useDataStore()
    return { data }
  },
  render() {
    // 未登录时由路由守卫直接进 /login，这里只处理已登录后的水合状态
    return h(RouterView)
  },
}
