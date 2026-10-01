import { request } from './client'
import type {
  ArticleCardVO,
  ArticleDetailVO,
  ArticleListQuery,
  CategoryVO,
  PageResult,
  TagVO,
} from './types'

/** 公开读接口（零鉴权） */

export const fetchArticles = (query: ArticleListQuery = {}) =>
  request<PageResult<ArticleCardVO>>('/api/v1/articles', { query: { ...query } })

export const fetchArticleDetail = (slug: string) =>
  request<ArticleDetailVO>(`/api/v1/articles/${encodeURIComponent(slug)}`)

/** 浏览量上报（后端按 ip + ua 按天去重，幂等） */
export const reportArticleView = (slug: string) =>
  request<void>(`/api/v1/articles/${encodeURIComponent(slug)}/view`, { method: 'POST' })

export const fetchCategories = (scope = 'TECH') =>
  request<CategoryVO[]>('/api/v1/categories', { query: { scope } })

export const fetchTags = () => request<TagVO[]>('/api/v1/tags')
