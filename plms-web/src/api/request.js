import axios from 'axios'

/**
 * 统一 API 异常。
 * @property {number} code    后端业务码（0 表示成功；-1 表示网络层异常）
 * @property {number} status  HTTP 状态码（0 表示未拿到响应）
 * @property {Array}  errors  字段级校验错误（仅 400 时存在）
 */
export class ApiError extends Error {
  constructor(message, code, status, errors) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.errors = errors || null
  }
  /** 取某字段的校验错误信息 */
  fieldError(field) {
    if (!this.errors) return ''
    const hit = this.errors.find((e) => e.field === field)
    return hit ? hit.message : ''
  }
}

const TOKEN_KEY = 'plms_token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY) || '',
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

/* 401 处理由外部注入，避免 request ↔ store 的循环依赖 */
let unauthorizedHandler = null
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn
}

const service = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json;charset=utf-8' },
})

/* ------------------------- 请求拦截：注入令牌 ------------------------- */
service.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/* ------------------------- 响应拦截：统一拆包与错误归一 ------------------------- */
service.interceptors.response.use(
  (resp) => {
    const body = resp.data
    // 标准信封：{ code, message, data }
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === 0) return body.data
      throw new ApiError(body.message || '请求失败', body.code, resp.status, body.errors)
    }
    return body
  },
  (error) => {
    // 1) 没有响应：超时 / 断网 / 服务未启动
    if (!error.response) {
      const timedOut = error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')
      const msg = timedOut
        ? '请求超时，请稍后重试'
        : '网络异常，请确认后端服务（:8080）已启动'
      const apiErr = new ApiError(msg, -1, 0, null)
      if (!timedOut) unauthorizedHandler && unauthorizedHandler(apiErr, true)
      return Promise.reject(apiErr)
    }

    // 2) 有响应：按 HTTP 状态归一
    const { status, data } = error.response
    const apiErr = new ApiError(
      (data && data.message) || `请求失败（HTTP ${status}）`,
      (data && data.code) || -1,
      status,
      (data && data.errors) || null,
    )
    if (status === 401) unauthorizedHandler && unauthorizedHandler(apiErr, false)
    return Promise.reject(apiErr)
  },
)

/**
 * 统一的错误提示文案。
 * @param {ApiError} err
 * @param {string} fallback
 */
export function errorMessage(err, fallback = '操作失败') {
  if (!err) return fallback
  if (err instanceof ApiError) return err.message || fallback
  return err.message || fallback
}

export default service
