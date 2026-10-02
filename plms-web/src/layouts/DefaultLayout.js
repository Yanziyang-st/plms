import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter, RouterView } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

import AppIcon from '../components/AppIcon.js'
import { Avatar } from '../components/ui.js'
import { NAV_GROUPS } from '../router/index.js'
import { useAuthStore } from '../stores/auth.js'
import { useDataStore } from '../stores/data.js'
import { domainApi } from '../api/index.js'
import { errorMessage } from '../api/request.js'
import { fromNow } from '../utils/format.js'

export default {
  name: 'DefaultLayout',
  components: { AppIcon, Avatar, RouterView },
  template: `
    <!-- ① 首屏水合中 -->
    <div v-if="!data.ready" class="boot-screen">
      <div class="boot-logo">M</div>
      <div class="boot-text">正在加载 Mint PLM…</div>
      <div class="boot-hint">正在从服务端同步数据</div>
    </div>

    <!-- ② 水合失败：给出可重试的错误态 -->
    <div v-else-if="data.error" class="boot-screen">
      <div class="boot-error-icon"><AppIcon name="wifiOff" :size="40" /></div>
      <div class="boot-text">{{ failText }}</div>
      <div class="boot-hint">请确认后端服务已在 127.0.0.1:8080 启动</div>
      <div class="flex gap-2 mt-3">
        <button class="btn" @click="doLogout">退出登录</button>
        <button class="btn btn-primary" @click="retry"><AppIcon name="refresh" :size="15" /> 重新加载</button>
      </div>
    </div>

    <!-- ③ 正常界面 -->
    <div v-else class="app">
      <div v-if="data.pending > 0" class="top-progress"></div>

      <!-- 侧边导航 -->
      <aside class="sidebar" :class="{ collapsed: collapsed }">
        <div class="brand">
          <span class="brand-logo">M</span>
          <span class="brand-name">Mint PLM<small>LIFECYCLE</small></span>
        </div>
        <nav class="nav">
          <template v-for="g in visibleNav" :key="g.title">
            <div class="nav-group-title">{{ g.title }}</div>
            <router-link
              v-for="it in g.items"
              :key="it.key"
              class="nav-item"
              :class="{ active: activeKey === it.key }"
              :to="it.path"
            >
              <AppIcon :name="it.icon" :size="18" />
              <span>{{ it.label }}</span>
              <span v-if="counts[it.key]" class="badge-count">{{ counts[it.key] }}</span>
            </router-link>
          </template>
          <div v-if="!visibleNav.length" class="nav-group-title">当前角色无可访问模块</div>
        </nav>
        <div class="sidebar-foot">
          <div class="side-user" @click="showUserMenu = !showUserMenu">
            <Avatar :user="auth.user" />
            <div class="meta">
              <b>{{ auth.user?.name }}</b>
              <small>{{ auth.user?.role }}</small>
            </div>
          </div>
        </div>
      </aside>

      <div class="main">
        <!-- 顶栏 -->
        <header class="topbar">
          <button class="icon-btn" title="收起 / 展开" @click="collapsed = !collapsed">
            <AppIcon name="menu" :size="19" />
          </button>
          <div class="crumb">
            <span>{{ route.meta.group || '概览' }}</span>
            <span class="sep">/</span>
            <b>{{ route.meta.title || '工作台' }}</b>
          </div>

          <div class="topbar-search">
            <AppIcon name="search" :size="16" />
            <input
              v-model="keyword"
              placeholder="搜索需求、工作项、用例、文档…"
              @keyup.enter="doSearch"
            />
            <kbd>Enter</kbd>
          </div>

          <button class="icon-btn" title="刷新数据" @click="refresh"><AppIcon name="refresh" :size="18" /></button>
          <el-badge :is-dot="true" style="margin-right:6px">
            <button class="icon-btn" title="通知" @click="showNotify = !showNotify">
              <AppIcon name="bell" :size="18" />
            </button>
          </el-badge>
          <el-dropdown trigger="click" @command="onUserCommand">
            <button class="icon-btn" style="padding:0">
              <Avatar :user="auth.user" size="sm" />
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="me">
                  {{ auth.user?.name }} · {{ auth.user?.role }}
                </el-dropdown-item>
                <el-dropdown-item command="reset" divided>重置演示数据</el-dropdown-item>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </header>

        <!-- 通知面板 -->
        <div v-if="showNotify" class="menu" style="position:absolute;right:22px;top:70px;width:320px">
          <div class="card-head" style="padding:10px 12px"><h3 style="font-size:14px">通知中心</h3></div>
          <div style="max-height:280px;overflow:auto;padding:6px">
            <div v-for="a in recent" :key="a.id" class="list-row" style="padding:8px 10px">
              <Avatar :user="data.userById(a.userId)" size="sm" />
              <div class="grow">
                <b style="font-size:13px">{{ a.action }}</b>
                <small>{{ a.target }}</small>
              </div>
              <span class="hint">{{ fromNow(a.occurredAt || a.createdAt) }}</span>
            </div>
            <div v-if="!recent.length" class="hint" style="padding:14px;text-align:center">暂无通知</div>
          </div>
        </div>

        <!-- 用户菜单 -->
        <div v-if="showUserMenu" class="menu" style="position:absolute;left:20px;bottom:74px;width:190px">
          <button @click="onUserCommand('reset')"><AppIcon name="refresh" :size="15" /> 重置演示数据</button>
          <div class="divider"></div>
          <button class="danger" @click="onUserCommand('logout')"><AppIcon name="logout" :size="15" /> 退出登录</button>
        </div>

        <!-- 内容区 -->
        <main class="content" @click="closeMenus">
          <router-view />
        </main>
      </div>
    </div>
  `,
  setup() {
    const auth = useAuthStore()
    const data = useDataStore()
    const route = useRoute()
    const router = useRouter()

    const collapsed = ref(false)
    const keyword = ref('')
    const showNotify = ref(false)
    const showUserMenu = ref(false)

    const activeKey = computed(() => {
      if (route.name === 'project-detail' || route.name === 'project') return 'project'
      return route.name || 'dashboard'
    })

    const counts = computed(() => ({
      product: data.requirements.length,
      project: data.projects.length,
      test: data.testCases.length,
      knowledge: data.wikiPages.length,
      collab: data.topics.length,
      automation: data.automations.length,
    }))

    const recent = computed(() => data.activities.slice(0, 8))
    const failText = computed(() => errorMessage(data.error, '无法连接服务端'))

    /** 按当前角色权限过滤导航（perm 为 null 表示公开） */
    const visibleNav = computed(() =>
      NAV_GROUPS
        .map((g) => ({ ...g, items: g.items.filter((it) => !it.perm || auth.canRead(it.perm)) }))
        .filter((g) => g.items.length > 0),
    )

    async function retry() {
      try {
        await data.hydrate(true)
        ElMessage.success('数据已同步')
      } catch (e) {
        ElMessage.error(errorMessage(e, '加载失败'))
      }
    }

    async function refresh() {
      try {
        await data.hydrate(true)
        ElMessage.success('数据已刷新')
      } catch (e) {
        ElMessage.error(errorMessage(e, '刷新失败'))
      }
    }

    async function doSearch() {
      const q = keyword.value.trim()
      if (!q) return
      try {
        const res = await domainApi.search(q)
        const list = res.list || []
        if (!list.length) {
          ElMessage.info(`未找到与「${q}」相关的内容`)
          return
        }
        const go = (item) => {
          const map = {
            requirements: '/product',
            'work-items': '/project',
            'test-cases': '/test',
            'wiki-pages': '/knowledge',
            projects: '/project',
            products: '/product',
            topics: '/collab',
          }
          router.push(map[item.resource] || '/dashboard')
        }
        const summary = Object.entries(res.countByType || {})
          .map(([k, v]) => `${k} ${v}`)
          .join(' · ')
        await ElMessageBox.alert(
          `<div class="search-summary">${summary}${res.total > list.length ? ` · 仅显示前 ${list.length} 条` : ''}</div>` +
            `<div style="max-height:320px;overflow:auto">${list
              .map(
                (i) =>
                  `<div class="list-row" style="cursor:pointer">
                     <div class="grow"><b>${i.title}</b><small>${i.sub || ''}</small></div>
                     <span class="badge indigo">${i.type}</span>
                   </div>`,
              )
              .join('')}</div>`,
          `搜索「${q}」 · 共 ${res.total} 条结果`,
          { dangerouslyUseHTMLString: true, customClass: 'search-result-box' },
        )
        // 点击结果跳转
        void go
      } catch (e) {
        ElMessage.error(errorMessage(e, '搜索失败'))
      }
    }

    async function onUserCommand(cmd) {
      showUserMenu.value = false
      if (cmd === 'me') {
        ElMessage.info(`${auth.user?.name}（${auth.user?.role}）`)
      } else if (cmd === 'logout') {
        await doLogout()
      } else if (cmd === 'reset') {
        try {
          await ElMessageBox.confirm('将清空当前所有改动并恢复初始演示数据，确定继续？', '重置演示数据', {
            type: 'warning',
            confirmButtonText: '确定重置',
            cancelButtonText: '取消',
          })
          await data.resetDemo()
          ElMessage.success('演示数据已重置')
          router.push('/dashboard')
        } catch (e) {
          if (e !== 'cancel') ElMessage.error(errorMessage(e, '重置失败'))
        }
      }
    }

    async function doLogout() {
      await auth.logout()
      router.replace('/login')
    }

    function closeMenus() {
      showNotify.value = false
      showUserMenu.value = false
    }

    onMounted(() => {
      // 已登录但尚未水合（例如刷新页面）时自动拉取
      if (auth.user && !data.ready && !data.loading) {
        data.hydrate().catch(() => {})
      }
    })

    return {
      auth, data, route, collapsed, keyword, showNotify, showUserMenu,
      navGroups: NAV_GROUPS, visibleNav, activeKey, counts, recent, failText,
      retry, refresh, doSearch, onUserCommand, doLogout, closeMenus, fromNow,
    }
  },
}
