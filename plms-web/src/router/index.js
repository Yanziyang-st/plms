import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

/* 视图懒加载：浏览器原生动态 import，与 Vite 行为一致 */
const DefaultLayout = () => import('../layouts/DefaultLayout.js')
const Login = () => import('../views/Login.js')
const Dashboard = () => import('../views/Dashboard.js')
const Product = () => import('../views/Product.js')
const Project = () => import('../views/Project.js')
const Test = () => import('../views/Test.js')
const Knowledge = () => import('../views/Knowledge.js')
const Metrics = () => import('../views/Metrics.js')
const Collab = () => import('../views/Collab.js')
const Automation = () => import('../views/Automation.js')
const Ai = () => import('../views/Ai.js')
const Settings = () => import('../views/Settings.js')

/** 侧边导航与面包屑的元信息（perm 为所需模块读权限） */
export const NAV_GROUPS = [
  {
    title: '概览',
    items: [{ key: 'dashboard', label: '工作台', icon: 'dashboard', path: '/dashboard', perm: null }],
  },
  {
    title: '研发管理',
    items: [
      { key: 'product', label: '产品管理', icon: 'product', path: '/product', perm: 'product' },
      { key: 'project', label: '项目管理', icon: 'project', path: '/project', perm: 'project' },
      { key: 'test', label: '测试管理', icon: 'test', path: '/test', perm: 'test' },
      { key: 'knowledge', label: '知识管理', icon: 'knowledge', path: '/knowledge', perm: 'knowledge' },
      { key: 'metrics', label: '效能度量', icon: 'metrics', path: '/metrics', perm: 'metrics' },
      { key: 'collab', label: '协作空间', icon: 'collab', path: '/collab', perm: 'collab' },
    ],
  },
  {
    title: '效率与智能',
    items: [
      { key: 'automation', label: '自动化', icon: 'automation', path: '/automation', perm: 'automation' },
      { key: 'ai', label: '智能协同', icon: 'ai', path: '/ai', perm: 'ai' },
      { key: 'settings', label: '后台管理', icon: 'settings', path: '/settings', perm: 'admin' },
    ],
  },
]

const routes = [
  { path: '/login', name: 'login', component: Login, meta: { public: true, title: '登录' } },
  {
    path: '/',
    component: DefaultLayout,
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', name: 'dashboard', component: Dashboard, meta: { title: '工作台', group: '概览', icon: 'dashboard', perm: null } },
      { path: 'product', name: 'product', component: Product, meta: { title: '产品管理', group: '研发管理', icon: 'product', perm: 'product' } },
      { path: 'project', name: 'project', component: Project, meta: { title: '项目管理', group: '研发管理', icon: 'project', perm: 'project' } },
      { path: 'project/:id', name: 'project-detail', component: Project, meta: { title: '项目详情', group: '研发管理', icon: 'project', perm: 'project' } },
      { path: 'test', name: 'test', component: Test, meta: { title: '测试管理', group: '研发管理', icon: 'test', perm: 'test' } },
      { path: 'knowledge', name: 'knowledge', component: Knowledge, meta: { title: '知识管理', group: '研发管理', icon: 'knowledge', perm: 'knowledge' } },
      { path: 'metrics', name: 'metrics', component: Metrics, meta: { title: '效能度量', group: '研发管理', icon: 'metrics', perm: 'metrics' } },
      { path: 'collab', name: 'collab', component: Collab, meta: { title: '协作空间', group: '研发管理', icon: 'collab', perm: 'collab' } },
      { path: 'automation', name: 'automation', component: Automation, meta: { title: '自动化', group: '效率与智能', icon: 'automation', perm: 'automation' } },
      { path: 'ai', name: 'ai', component: Ai, meta: { title: '智能协同', group: '效率与智能', icon: 'ai', perm: 'ai' } },
      { path: 'settings', name: 'settings', component: Settings, meta: { title: '后台管理', group: '效率与智能', icon: 'settings', perm: 'admin' } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

/* ------------------------- 全局路由守卫 ------------------------- */
router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // 已登录用户访问登录页 → 回到首页
  if (to.meta.public) {
    if (auth.token && auth.user) return { path: '/dashboard' }
    return true
  }

  // 未持有令牌 → 去登录页并记录回跳地址
  if (!auth.token) {
    return { path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }
  }

  // 有令牌但尚未校验 → 调用 /auth/me 校验
  if (!auth.resolved) {
    const user = await auth.restore()
    if (!user) {
      return { path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }
    }
  }
  return true
})

export default router
