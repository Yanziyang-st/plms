import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus, { ElMessage } from 'element-plus'
// 用 element-plus 官方 exports 映射（./es/*）中的规范路径，
// 保证在 Vite 下可解析；浏览器模式由 index.html 的 importmap 指向同一份产物。
import zhCn from 'element-plus/es/locale/lang/zh-cn'

import App from './App.js'
import router from './router/index.js'
import { setUnauthorizedHandler } from './api/request.js'
import { useAuthStore } from './stores/auth.js'

/* 样式在 index.html 中以 <link> 引入：
   · 原生 ESM 不支持 import '.css'
   · Vite 构建时同样会保留 index.html 中的 link，行为一致
   如需改用 Vite 的 CSS 处理，可在此处 import './styles/theme.css' */

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

/* Element Plus 中文语言包 + 全局注册（模板中直接使用 <el-xxx>） */
app.use(ElementPlus, { locale: zhCn })

/* 全局错误兜底：避免未捕获异常导致白屏 */
app.config.errorHandler = (err, instance, info) => {
  console.error('[Vue error]', info, err)
}

/* ------------------------------------------------------------------
   401 统一处理：清除登录态并跳转登录页
   放在 pinia 初始化之后注册，避免循环依赖
   ------------------------------------------------------------------ */
let redirecting = false
setUnauthorizedHandler((err) => {
  const auth = useAuthStore()
  if (!auth.token) return                      // 本就没有登录态，交由登录页自行提示
  auth.clear()
  if (redirecting) return
  redirecting = true

  // 注意：Element Plus 的默认导出只含 version / install，
  // ElMessage 必须具名导入，否则此处会抛 TypeError 并中断跳转。
  try {
    ElMessage.warning('登录已过期，请重新登录')
  } catch (e) {
    console.warn('提示消息发送失败', e)
  }

  const redirect = router.currentRoute.value.fullPath
  const target = redirect && redirect !== '/login' && redirect !== '/'
    ? { path: '/login', query: { redirect } }
    : { path: '/login' }

  Promise.resolve(router.replace(target))
    .catch((e) => {
      // 导航被中断时兜底：直接改 hash，保证一定能回到登录页
      console.warn('跳转登录页失败，使用兜底方式', e)
      window.location.hash = '#/login'
    })
    .finally(() => { setTimeout(() => { redirecting = false }, 300) })
})

app.mount('#app')
