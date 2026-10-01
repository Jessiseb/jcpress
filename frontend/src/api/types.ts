/**
 * 后端契约的前端镜像。
 *
 * 两条类型规则**必须跟后端保持一致**（见 docs/decisions.md #115）：
 * 1. **ID 一律 `string`** —— 后端把 `Long` 序列化成字符串（防 JS 大整数精度丢失）；
 * 2. **计数与度量一律 `number`** —— 后端用 `int` 承载它们（`long` 也会被字符串化）。
 *
 * 把这两条写错的表现是"页面能跑但数字莫名变成字符串"，加号会变成拼接。
 */

export interface PageResult<T> {
  list: T[]
  page: number
  size: number
  total: number
  pages: number
}

export interface TagVO {
  /** 文章自带的标签不带 id（后端只回 name/slug），标签列表接口才有 */
  id?: string | null
  name: string
  slug: string
  /** 已发布计数；文章卡片里的标签为 0 */
  articleCount?: number
}

export interface ArticleCardVO {
  id: string
  title: string
  slug: string
  summary: string | null
  coverUrl: string | null
  categoryName: string | null
  categorySlug: string | null
  tags: TagVO[]
  readingMinutes: number
  viewCount: number
  top: number
  /** yyyy-MM-dd HH:mm:ss */
  publishTime: string
}

export interface ArticleAdjacentVO {
  title: string
  slug: string
  publishTime: string
}

export interface ArticleDetailVO {
  id: string
  title: string
  slug: string
  summary: string | null
  coverUrl: string | null
  categoryName: string | null
  categorySlug: string | null
  tags: TagVO[]
  readingMinutes: number
  viewCount: number
  top: number
  publishTime: string
  type: string
  /** Markdown 原文（渲染在前端） */
  contentMd: string
  prev: ArticleAdjacentVO | null
  next: ArticleAdjacentVO | null
}

export interface CategoryVO {
  id: string
  name: string
  slug: string
  description: string | null
  articleCount: number
}

export interface AdminUserVO {
  id: string
  username: string
  nickname: string
  role: string
}

export interface LoginVO {
  token: string
  /** 请求头名称由后端下发，前端不写死 */
  tokenName: string
  admin: AdminUserVO
}

export interface AdminArticleVO {
  id: string
  title: string
  slug: string
  summary: string | null
  coverUrl: string | null
  categoryId: string | null
  categoryName: string | null
  /** 后台下发的是标签**名字**，编辑器直接可用 */
  tags: string[]
  /** 0 草稿 1 已发布 2 归档 */
  status: number
  wordCount: number
  readingMinutes: number
  viewCount: number
  top: number
  publishTime: string | null
  gmtModified: string | null
  /** 只有详情接口会填；列表里为 null */
  contentMd: string | null
}

export interface UploadFileVO {
  /** 对外可访问的完整 URL（含 context-path），可直接写进 Markdown */
  url: string
  size: number
}

export interface ArticleListQuery {
  type?: string
  categoryId?: string
  tagSlug?: string
  page?: number
  size?: number
}

export interface AdminArticleQuery {
  type?: string
  status?: number
  categoryId?: string
  keyword?: string
  page?: number
  size?: number
}

export interface ArticleSavePayload {
  title: string
  slug?: string
  summary?: string
  coverUrl?: string
  categoryId: string
  tags?: string[]
  contentMd: string
  status?: number
}
