import { defineStore } from 'pinia'
import * as api from '../api/index.js'
import { bootstrapApi, domainApi } from '../api/index.js'

/** 资源路径 -> store 中的集合字段名 */
export const RES_TO_KEY = {
  products: 'products',
  requirements: 'requirements',
  projects: 'projects',
  sprints: 'sprints',
  'work-items': 'workItems',
  'test-libraries': 'testLibraries',
  'test-cases': 'testCases',
  'test-plans': 'testPlans',
  'wiki-spaces': 'wikiSpaces',
  'wiki-pages': 'wikiPages',
  topics: 'topics',
  automations: 'automations',
  agents: 'agents',
  users: 'users',
  activities: 'activities',
  links: 'links',
  comments: 'comments',
}

const EMPTY = () => ({
  users: [], products: [], requirements: [], projects: [], sprints: [],
  workItems: [], testLibraries: [], testCases: [], testPlans: [],
  wikiSpaces: [], wikiPages: [], topics: [], automations: [], agents: [], activities: [],
  links: [], comments: [],
})

/**
 * 数据仓库。
 * 读：bootstrap 一次性水合到本地缓存，视图同步读取（用于名称/关联查找）；
 *     列表类数据走 `query()` 调服务端，支持真实的分页 / 筛选 / 排序。
 * 写：一律走接口，成功后同步更新本地缓存（write-through）。
 */
export const useDataStore = defineStore('data', {
  state: () => ({
    ...EMPTY(),
    meta: {},
    /** 首屏水合状态 */
    ready: false,
    loading: false,
    error: null,
    /** 进行中的写请求数量，用于顶部进度条 / 全局 loading */
    pending: 0,
  }),

  getters: {
    userById: (s) => (id) => s.users.find((u) => u.id === id) || { id, name: '未知', color: '#8b93a7' },
    productById: (s) => (id) => s.products.find((p) => p.id === id) || null,
    projectById: (s) => (id) => s.projects.find((p) => p.id === id) || null,
    sprintById: (s) => (id) => s.sprints.find((p) => p.id === id) || null,
    libraryById: (s) => (id) => s.testLibraries.find((p) => p.id === id) || null,
    spaceById: (s) => (id) => s.wikiSpaces.find((p) => p.id === id) || null,
    agentById: (s) => (id) => s.agents.find((p) => p.id === id) || null,
    /** 通用按 ID 查（resource 为后端路径名） */
    byId: (s) => (resource, id) => {
      const key = RES_TO_KEY[resource]
      if (!key) return null
      return s[key].find((x) => x.id === id) || null
    },
  },

  actions: {
    /* ==================== 首屏水合 ==================== */
    async hydrate(force = false) {
      if (this.ready && !force) return
      this.loading = true
      this.error = null
      try {
        const data = await bootstrapApi.load()
        Object.keys(RES_TO_KEY).forEach((res) => {
          const key = RES_TO_KEY[res]
          this[key] = Array.isArray(data[key]) ? data[key] : []
        })
        this.meta = data.meta || {}
        this.ready = true
      } catch (e) {
        this.error = e
        throw e
      } finally {
        this.loading = false
      }
    },

    /** 重置演示数据并重新水合 */
    async resetDemo() {
      await bootstrapApi.reset()
      await this.hydrate(true)
    },

    /* ==================== 查询 ==================== */
    /**
     * 服务端列表查询（分页 / 筛选 / 排序），并把结果合并进缓存。
     * @returns {Promise<{list:Array,total:number,page:number,pageSize:number}>}
     */
    async query(resource, params = {}) {
      const res = await api.list(resource, params)
      this.merge(resource, res.list)
      return res
    },

    /* ==================== 缓存维护 ==================== */
    merge(resource, items) {
      const key = RES_TO_KEY[resource]
      if (!key || !Array.isArray(items)) return
      const map = new Map(this[key].map((x) => [x.id, x]))
      items.forEach((it) => map.set(it.id, it))
      this[key] = Array.from(map.values())
    },

    put(resource, item) {
      const key = RES_TO_KEY[resource]
      if (!key || !item) return
      const idx = this[key].findIndex((x) => x.id === item.id)
      if (idx >= 0) this[key].splice(idx, 1, item)
      else this[key].unshift(item)
    },

    drop(resource, id) {
      const key = RES_TO_KEY[resource]
      if (!key) return
      this[key] = this[key].filter((x) => x.id !== id)
    },

    /** 写操作包装：统计 pending、统一抛出错误给调用方处理 */
    async _write(fn) {
      this.pending++
      try {
        return await fn()
      } finally {
        this.pending--
      }
    },

    /* ==================== 写透（write-through） ==================== */
    /** 新建 */
    async save(resource, payload) {
      return this._write(async () => {
        const created = await api.create(resource, payload)
        this.put(resource, created)
        return created
      })
    },

    /** 更新 */
    async edit(resource, id, patch) {
      return this._write(async () => {
        const updated = await api.update(resource, id, patch)
        this.put(resource, updated)
        return updated
      })
    },

    /** 删除 */
    async destroy(resource, id) {
      return this._write(async () => {
        await api.remove(resource, id)
        this.drop(resource, id)
      })
    },

    /* ==================== 领域业务 ==================== */
    /**
     * 看板：变更工作项状态。乐观更新 + 失败回滚 + 同步项目进度。
     */
    async changeWorkItemStatus(id, status) {
      const prev = this.byId('work-items', id)
      const prevSnapshot = prev ? { ...prev } : null
      if (prev) this.put('work-items', { ...prev, status })   // 乐观更新

      return this._write(async () => {
        try {
          const data = await domainApi.changeWorkItemStatus(id, status)
          this.put('work-items', data.item)
          if (data.project) this.put('projects', data.project)
          return data
        } catch (e) {
          if (prevSnapshot) this.put('work-items', prevSnapshot)  // 回滚
          throw e
        }
      })
    },

    /** 测试：记录用例结果 */
    async recordCaseResult(caseId, result) {
      return this._write(async () => {
        const tc = await domainApi.recordCaseResult(caseId, result)
        this.put('test-cases', tc)
        return tc
      })
    },

    /** 测试：执行测试计划（可能自动创建缺陷） */
    async executeTestPlan(planId, caseId, result) {
      return this._write(async () => {
        const data = await domainApi.executeTestPlan(planId, caseId, result)
        if (data.plan) this.put('test-plans', data.plan)
        if (data.case) this.put('test-cases', data.case)
        if (data.autoCreatedDefect) this.put('work-items', data.autoCreatedDefect)
        return data
      })
    },

    /** 测试计划：追加用例 */
    async planAddCases(planId, caseIds) {
      return this._write(async () => {
        const plan = await domainApi.planAddCases(planId, caseIds)
        this.put('test-plans', plan)
        return plan
      })
    },

    /** 测试计划：移除用例 */
    async planRemoveCase(planId, caseId) {
      return this._write(async () => {
        const plan = await domainApi.planRemoveCase(planId, caseId)
        this.put('test-plans', plan)
        return plan
      })
    },

    /* ==================== 通用评论 ==================== */
    /**
     * 发表评论（工作项 / 需求 / 用例 / 话题通用）。
     * 话题评论同步写回 topics 的内嵌 comments，其余实体刷新 comments 缓存。
     */
    async postComment(targetType, targetId, content) {
      return this._write(async () => {
        const comment = await domainApi.addComment(targetType, targetId, content)
        this.comments.push(comment)
        if (targetType === 'topic') {
          const topic = this.byId('topics', targetId)
          if (topic) {
            const list = Array.isArray(topic.comments) ? topic.comments.slice() : []
            list.push(comment)
            this.put('topics', { ...topic, comments: list })
          }
        }
        return comment
      })
    },

    /** 删除评论 */
    async deleteComment(id) {
      return this._write(async () => {
        await domainApi.deleteComment(id)
        this.comments = this.comments.filter((c) => c.id !== id)
        // 同步话题内嵌评论
        this.topics = this.topics.map((t) =>
          Array.isArray(t.comments) ? { ...t, comments: t.comments.filter((c) => c.id !== id) } : t,
        )
      })
    },

    /** 拉取某对象的评论（不依赖水合缓存，保证最新） */
    async fetchComments(targetType, targetId) {
      const list = await domainApi.comments(targetType, targetId)
      return Array.isArray(list) ? list : []
    },

    /* ==================== 实体关联 / 追溯 ==================== */
    async createLink(payload) {
      return this._write(async () => {
        const link = await domainApi.createLink(payload)
        this.links.push(link)
        return link
      })
    },

    async deleteLink(id) {
      return this._write(async () => {
        await domainApi.deleteLink(id)
        this.links = this.links.filter((l) => l.id !== id)
      })
    },

    async fetchLinks(entityType, entityId) {
      const data = await domainApi.linksOf(entityType, entityId)
      return data.links || []
    },

    async fetchTrace(requirementId) {
      return domainApi.traceRequirement(requirementId)
    },

    async fetchMatrix(productId) {
      return domainApi.traceMatrix(productId)
    },

    /* ==================== 批量操作 ==================== */
    /**
     * 批量删除。返回 { requested, success, failed, failures }；
     * 失败明细会透出，便于前端提示"哪几条因何无法删除"。
     */
    async batchDelete(resource, ids) {
      return this._write(async () => {
        const result = await domainApi.batchDelete(resource, ids)
        const failedIds = new Set((result.failures || []).map((f) => f.id))
        ids.filter((id) => !failedIds.has(id)).forEach((id) => this.drop(resource, id))
        return result
      })
    },

    /** 批量更新 */
    async batchUpdate(resource, ids, patch) {
      return this._write(async () => {
        const result = await domainApi.batchUpdate(resource, ids, patch)
        ;(result.updated || []).forEach((item) => this.put(resource, item))
        return result
      })
    },

    /* ==================== 用户管理 ==================== */
    async createUser(payload) {
      return this._write(async () => {
        const user = await domainApi.createUser(payload)
        this.users.push(user)
        return user
      })
    },

    async toggleUser(id) {
      return this._write(async () => {
        const user = await domainApi.toggleUser(id)
        this.put('users', user)
        return user
      })
    },

    async resetPassword(id, password) {
      return this._write(() => domainApi.resetPassword(id, password))
    },

    /** 自动化：启停 */
    async toggleAutomation(id) {
      return this._write(async () => {
        const rule = await domainApi.toggleAutomation(id)
        this.put('automations', rule)
        return rule
      })
    },

    /** 自动化：立即执行 */
    async runAutomation(id) {
      return this._write(async () => {
        const rule = await domainApi.runAutomation(id)
        this.put('automations', rule)
        return rule
      })
    },

    /** 刷新活动日志 */
    async refreshActivities() {
      const res = await api.list('activities', { pageSize: 20 })
      this.activities = res.list
      return res.list
    },
  },
})
