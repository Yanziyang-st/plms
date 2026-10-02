import service from './request.js'

/* ==========================================================================
   资源集合的标准 CRUD
   资源名与后端路径一一对应，例如 'work-items' -> /api/work-items
   ========================================================================== */
export const RESOURCES = [
  'products', 'requirements', 'projects', 'sprints', 'work-items',
  'test-libraries', 'test-cases', 'test-plans', 'wiki-spaces', 'wiki-pages',
  'topics', 'automations', 'agents', 'users', 'activities',
]

export const list = (resource, params) => service.get(`/${resource}`, { params })
export const getById = (resource, id) => service.get(`/${resource}/${id}`)
export const create = (resource, data) => service.post(`/${resource}`, data)
export const update = (resource, id, data) => service.patch(`/${resource}/${id}`, data)
export const remove = (resource, id) => service.delete(`/${resource}/${id}`)

/* ==========================================================================
   认证
   ========================================================================== */
export const authApi = {
  login: (username, password) => service.post('/auth/login', { username, password }),
  me: () => service.get('/auth/me'),
  logout: () => service.post('/auth/logout'),
  permissions: () => service.get('/auth/permissions'),
}

/* ==========================================================================
   首屏水合 & 系统
   ========================================================================== */
export const bootstrapApi = {
  load: () => service.get('/bootstrap'),
  reset: () => service.post('/system/reset'),
  health: () => service.get('/system/health'),
}

/* ==========================================================================
   领域业务接口
   ========================================================================== */
export const domainApi = {
  /* ---------- 看板：状态流转 ---------- */
  changeWorkItemStatus: (id, status) => service.patch(`/work-items/${id}/status`, { status }),
  transitions: (id) => service.get(`/work-items/${id}/transitions`),

  /* ---------- 测试 ---------- */
  recordCaseResult: (id, result) => service.post(`/test-cases/${id}/result`, { result }),
  executeTestPlan: (planId, caseId, result) =>
    service.post(`/test-plans/${planId}/execute`, { caseId, result }),
  planAddCases: (planId, caseIds) => service.post(`/test-plans/${planId}/cases`, { caseIds }),
  planRemoveCase: (planId, caseId) => service.delete(`/test-plans/${planId}/cases/${caseId}`),

  /* ---------- 通用评论 ---------- */
  comments: (targetType, targetId) => service.get('/comments', { params: { targetType, targetId } }),
  addComment: (targetType, targetId, content) => service.post('/comments', { targetType, targetId, content }),
  deleteComment: (id) => service.delete(`/comments/${id}`),

  /* ---------- 实体关联 / 需求追溯 ---------- */
  linksOf: (entityType, entityId) => service.get('/links', { params: { entityType, entityId } }),
  createLink: (payload) => service.post('/links', payload),
  deleteLink: (id) => service.delete(`/links/${id}`),
  traceRequirement: (id) => service.get(`/trace/requirement/${id}`),
  traceMatrix: (productId) => service.get('/trace/matrix', { params: productId ? { productId } : {} }),

  /* ---------- 自动化 ---------- */
  toggleAutomation: (id) => service.post(`/automations/${id}/toggle`),
  runAutomation: (id) => service.post(`/automations/${id}/run`),

  /* ---------- 效能度量 ---------- */
  metricsOverview: () => service.get('/metrics/overview'),
  metricsMembers: () => service.get('/metrics/members'),

  /* ---------- 全局搜索 ---------- */
  search: (q, types, limit) =>
    service.get('/search', { params: { q, ...(types ? { types } : {}), ...(limit ? { limit } : {}) } }),

  /* ---------- 批量操作 ---------- */
  batchDelete: (resource, ids) => service.post(`/${resource}/batch-delete`, { ids }),
  batchUpdate: (resource, ids, patch) => service.post(`/${resource}/batch-update`, { ids, patch }),

  /* ---------- 用户管理 ---------- */
  createUser: (payload) => service.post('/users', payload),
  toggleUser: (id) => service.post(`/users/${id}/toggle`),
  resetPassword: (id, password) => service.post(`/users/${id}/reset-password`, { password }),
  permissions: () => service.get('/auth/permissions'),
}

/* ==========================================================================
   导出：拼出可直接用于 <a download> 的 URL（携带筛选参数）
   ========================================================================== */
export function exportUrl(resource, params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ).toString()
  return `/api/export/${resource}${qs ? '?' + qs : ''}`
}
