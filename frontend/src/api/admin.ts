import { ApiError, getToken, request, type ApiEnvelope } from './client'
import type {
  AdminArticleQuery,
  AdminArticleVO,
  AdminUserVO,
  ArticleSavePayload,
  LoginVO,
  PageResult,
  UploadFileVO,
} from './types'

/** 后台接口（除登录外全部需要 token） */

export const adminLogin = (username: string, password: string) =>
  request<LoginVO>('/api/v1/admin/auth/login', { method: 'POST', body: { username, password } })

export const adminLogout = () =>
  request<void>('/api/v1/admin/auth/logout', { method: 'POST', auth: true })

export const fetchCurrentAdmin = () =>
  request<AdminUserVO>('/api/v1/admin/auth/me', { auth: true })

export const fetchAdminArticles = (query: AdminArticleQuery = {}) =>
  request<PageResult<AdminArticleVO>>('/api/v1/admin/articles', {
    auth: true,
    query: { ...query },
  })

export const fetchAdminArticle = (id: string) =>
  request<AdminArticleVO>(`/api/v1/admin/articles/${id}`, { auth: true })

/** 新建返回新文章 id（后端以字符串下发） */
export const saveAdminArticle = (payload: ArticleSavePayload) =>
  request<string>('/api/v1/admin/articles', { method: 'POST', auth: true, body: payload })

export const updateAdminArticle = (id: string, payload: ArticleSavePayload) =>
  request<void>(`/api/v1/admin/articles/${id}`, { method: 'POST', auth: true, body: payload })

/** status: 1 发布 / 0 撤回 / 2 归档 —— 状态迁移走路径后缀，不换 HTTP 方法 */
export const publishAdminArticle = (id: string, status: number) =>
  request<void>(`/api/v1/admin/articles/${id}/publish`, {
    method: 'POST',
    auth: true,
    query: { status },
  })

export const deleteAdminArticle = (id: string) =>
  request<void>(`/api/v1/admin/articles/${id}/delete`, { method: 'POST', auth: true })

/**
 * 图片上传走 multipart，**不能复用 request() 的 JSON body 分支**，所以单独写一次。
 * 拆信封与错误码处理保持一致。
 */
export async function uploadImage(file: File): Promise<UploadFileVO> {
  const token = getToken()
  if (!token) {
    throw new ApiError(40101, '未登录', 401)
  }
  const form = new FormData()
  form.append('file', file)

  const response = await fetch('/api/v1/admin/upload', {
    method: 'POST',
    headers: { 'jcpress-token': token },
    body: form,
  })
  const payload = (await response.json()) as ApiEnvelope<UploadFileVO>
  if (payload.code !== 0) {
    throw new ApiError(payload.code, payload.message, response.status)
  }
  return payload.data
}
