import { defineStore } from 'pinia'
import { authApi } from '../api/index.js'
import { tokenStore } from '../api/request.js'

/**
 * 认证状态：令牌 + 当前用户。
 */
export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: tokenStore.get(),
    user: null,
    /** 是否已完成一次身份校验（用于路由守卫） */
    resolved: false,
    /** 当前角色的权限点，如 ["product:read","product:write"] */
    permissions: [],
    /** 全量角色权限矩阵（后台管理页渲染用） */
    matrix: [],
    /** 模块定义 [{key,label}] */
    modules: [],
    permissionsLoaded: false,
  }),

  getters: {
    isLoggedIn: (s) => !!s.token && !!s.user,
    userId: (s) => (s.user ? s.user.id : ''),
    isAdmin: (s) => s.user && s.user.role === '管理员',
    /** 能否查看某模块 */
    canRead: (s) => (module) => s.isAdmin || s.permissions.includes(module + ':read'),
    /** 能否操作某模块 */
    canWrite: (s) => (module) => s.isAdmin || s.permissions.includes(module + ':write'),
  },

  actions: {
    async login(username, password) {
      const data = await authApi.login(username, password)
      this.token = data.token
      this.user = data.user
      this.permissions = data.permissions || []
      this.resolved = true
      tokenStore.set(data.token)
      return data.user
    },

    /** 校验本地令牌是否仍然有效 */
    async restore() {
      if (!this.token) {
        this.resolved = true
        return null
      }
      try {
        this.user = await authApi.me()
        await this.loadPermissions()
      } catch (e) {
        this.clear()
      } finally {
        this.resolved = true
      }
      return this.user
    },

    /** 拉取权限点与角色矩阵 */
    async loadPermissions() {
      try {
        const data = await authApi.permissions()
        this.permissions = data.permissions || []
        this.matrix = data.matrix || []
        this.modules = data.modules || []
        this.permissionsLoaded = true
      } catch (e) {
        // 权限接口失败不阻塞主流程，回落到「仅管理员」
        this.permissions = []
      }
      return this.permissions
    },

    async logout() {
      try {
        if (this.token) await authApi.logout()
      } catch (e) {
        /* 登出失败不阻塞本地清理 */
      }
      this.clear()
    },

    clear() {
      this.token = ''
      this.user = null
      this.permissions = []
      this.matrix = []
      this.modules = []
      this.permissionsLoaded = false
      tokenStore.clear()
    },
  },
})
