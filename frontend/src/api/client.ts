/**
 * 唯一的网络出口。
 *
 * 三件事只在这里做：
 * 1. **拆统一信封** —— 后端回的是 `{code,message,data,traceId}`，业务代码只该拿到 `data`；
 * 2. **token 注入与失效清理** —— 用 sessionStorage（关掉页签即失效，后台场景更合适）；
 * 3. **不做假数据降级** —— 接口挂了就抛错。Agent.md 明确要求"依赖缺失应表现为失败，
 *    不得降级为用户可见文案"，所以这里没有 fallback、没有默认值。
 */

export interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
  traceId: string | null
}

export class ApiError extends Error {
  readonly code: number
  readonly httpStatus: number

  constructor(code: number, message: string, httpStatus: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.httpStatus = httpStatus
  }
}

const TOKEN_KEY = 'jcpress.admin.token'
const TOKEN_HEADER = 'jcpress-token'

/** 未登录 / token 失效 / 失败锁定：都要清掉本地 token 并让调用方跳登录页 */
const AUTH_FAILURE_CODES = new Set([40101, 40102, 40103])

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY)
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  auth?: boolean
  body?: unknown
  query?: Record<string, string | number | undefined | null>
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = false, body, query, ...rest } = options

  const url = new URL(path, window.location.origin)
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    })
  }

  const headers = new Headers(rest.headers)
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  if (auth) {
    const token = getToken()
    if (!token) {
      // 本地就没有凭据：不必发一次注定 401 的请求
      throw new ApiError(40101, '未登录', 401)
    }
    headers.set(TOKEN_HEADER, token)
  }

  const response = await fetch(url, {
    ...rest,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  let payload: ApiEnvelope<T>
  try {
    payload = (await response.json()) as ApiEnvelope<T>
  } catch {
    // 后端没回 JSON（网关 502、HTML 错误页等）：既不能假装成功，也不该把原始响应吐给用户
    throw new ApiError(response.status, `服务暂时不可用（HTTP ${response.status}）`, response.status)
  }

  if (payload.code !== 0) {
    if (auth && AUTH_FAILURE_CODES.has(payload.code)) {
      clearToken()
    }
    throw new ApiError(payload.code, payload.message, response.status)
  }
  return payload.data
}
