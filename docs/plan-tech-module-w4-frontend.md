# 技术分享模块（三期）实施计划 · W4 前台与后台 UI

> **给执行者**：本文件是 [实施计划索引](plan-tech-module.md) 的第 4 份（最后一份）。执行方式：**内联逐任务执行、每个任务结束后复核并 commit**，用 `- [ ]` 跟踪。
> **前置**：W1/W2/W3+W5 全部完成；后端在 `127.0.0.1:8080` 可跑；dev server 在 `5173` 常驻（二期留下的那个仍可用）。
> **配套**：[设计定稿](design-tech-module.md)（已批准）· [开发日志](dev-journal.md) · [决策记录](decisions.md) · [二期效果矩阵](phase2-effect-matrix.md)

**Goal**：把技术分享做成「能点、能读、好看」的页面 —— 首页与 `/tech` 都能点进文章详情，详情页是护眼的长文阅读版式；后台有可用的写入口（登录 + 列表 + CodeMirror 编辑 + 粘贴上传）。

**Architecture**：`src/api`（唯一网络出口，统一拆信封 + token）→ `src/hooks`（TanStack Query）→ 页面/组件。详情页与 `/admin` 全部**路由级懒加载**，Markdown 渲染与编辑器不进首屏包。

**Tech Stack**：react-markdown 10.1.0 · remark-gfm 4.0.1 · rehype-highlight 7.0.2 · rehype-slug 6.0.0 · highlight.js 11.12.0 · codemirror 6.0.2 + @codemirror/lang-markdown · 现有 React 18 / Vite 6 / TanStack Query 5

---

## 0. 本工作流的三个前置结论（已核对现有代码，不要重复做）

1. **`QueryClientProvider` 已经在了**（`src/main.tsx` 里已配 `staleTime: 5min / retry: 1 / refetchOnWindowFocus: false`）→ **不要改 main.tsx**。
2. **`vite.config.ts` 目前没有 proxy** → 本工作流加 `server.proxy`，让 dev 与生产同为「同源 `/api`」，从根上消掉 CORS 与硬编码 host。
3. **跨工作流修正（写 W4 时才发现，已回写 W3 计划）**：上传图片的 URL 有两个前缀，**不能是同一个值** —— `jcpress.upload.resource-path=/uploads`（服务端映射，相对 context-path）与 `jcpress.upload.public-prefix=/api/uploads`（写进正文与封面、对外可访问的 URL）。因为后端 `context-path=/api`，文件实际服务在 `/api/uploads/...`；若用 `/uploads` 写进正文，**图片会 404**，而这只有在肉眼看图时才暴露。前端**直接使用后端下发的 URL 原值**（它已含 `/api`），不要再拼前缀。

**护眼阅读档位（设计 D7，写死在这里，不要临场发挥）**

| 维度 | 值 |
| --- | --- |
| 正文栏宽 | `68ch`（`max-width: 68ch`，居中） |
| 正文字号 / 行高 | `17px` / `1.9` |
| 段间距 | `1.15em`（段首不缩进） |
| 代码块 | `14px` / 行高 `1.7`、横向滚动、右上角复制按钮 |
| 层级 | h2 带**自动章节号**（`01 / 02`，CSS counter）、h3 不带 |
| TOC | `≥1024px` 右侧 220px 常驻；`<1024px` 折叠进正文顶部（`<details>`） |
| 主题 | 亮/暗双主题同步；对比度纳入 `audit-contrast.cjs` |

---

## 1. Task 1: API 客户端与类型

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/types.ts`
- Create: `frontend/src/api/articles.ts`
- Create: `frontend/src/api/admin.ts`
- Test: `frontend/src/api/client.test.ts`

- [ ] **Step 1: 写失败测试**（拆信封 / 错误码 / token 注入 / 401 清 token 四条）

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, clearToken, getToken, request, setToken } from './client'

describe('api client', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })
  afterEach(() => sessionStorage.clear())

  const mockFetch = (body: unknown, status = 200) =>
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
    )

  it('unwraps the envelope and returns data', async () => {
    mockFetch({ code: 0, message: 'ok', data: { slug: 'a' }, traceId: 't1' })
    await expect(request<{ slug: string }>('/api/v1/articles/a')).resolves.toEqual({ slug: 'a' })
  })

  it('throws ApiError carrying both business code and http status', async () => {
    mockFetch({ code: 40401, message: '文章不存在', data: null, traceId: 't2' }, 404)
    const error = await request('/api/v1/articles/nope').catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe(40401)
    expect(error.httpStatus).toBe(404)
    expect(error.message).toBe('文章不存在')
  })

  it('sends the token header only when auth is requested', async () => {
    const spy = mockFetch({ code: 0, message: 'ok', data: null, traceId: null })
    setToken('token-abc')
    await request('/api/v1/articles', { auth: true })
    const headers = new Headers((spy.mock.calls[0][1] as RequestInit).headers)
    expect(headers.get('jcpress-token')).toBe('token-abc')

    spy.mockClear()
    await request('/api/v1/articles')
    const plain = new Headers((spy.mock.calls[0][1] as RequestInit).headers)
    expect(plain.get('jcpress-token')).toBeNull()
  })

  it('clears the token when the backend reports an auth failure', async () => {
    setToken('stale-token')
    mockFetch({ code: 40102, message: 'token 过期或无效', data: null, traceId: null }, 401)
    await expect(request('/api/v1/admin/auth/me', { auth: true })).rejects.toBeInstanceOf(ApiError)
    expect(getToken()).toBeNull()
  })

  it('refuses to send an authenticated request without a token', async () => {
    clearToken()
    await expect(request('/api/v1/admin/auth/me', { auth: true })).rejects.toMatchObject({ code: 40101 })
  })
})
```

- [ ] **Step 2: 跑测试确认失败**：`cd frontend; node node_modules/vitest/vitest.mjs run src/api/client.test.ts` → 失败（模块不存在）
- [ ] **Step 3: 写 `client.ts`**

```ts
/** 后端统一响应体（规划 §9.1）：{ code, message, data, traceId } */
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
/** 未登录 / token 失效：都要清掉本地 token 并让调用方跳登录页 */
const AUTH_FAILURE_CODES = new Set([40101, 40102, 40103])

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  // 用 sessionStorage 而不是 localStorage：关掉页签即失效，后台场景更合适
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
    // 后端没返回 JSON（网关 502、HTML 错误页等）：不能假装成功，也不能吐原始堆栈
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
```

- [ ] **Step 4: 写 `types.ts`**（**ID 一律 `string`** —— 后端 Gson 把 `Long` 序列化成字符串，前端类型必须跟着走，否则迟早踩精度）

| 类型 | 字段 |
| --- | --- |
| `PageResult<T>` | `list: T[]`、`page: number`、`size: number`、`total: number`、`pages: number` |
| `TagVO` | `id?: string`、`name: string`、`slug: string`、`articleCount?: number` |
| `ArticleCardVO` | `id: string`、`title`、`slug`、`summary: string \| null`、`coverUrl: string \| null`、`categoryName: string \| null`、`categorySlug: string \| null`、`tags: TagVO[]`、`readingMinutes: number`、`viewCount: number`、`top: number`、`publishTime: string` |
| `ArticleAdjacentVO` | `title`、`slug`、`publishTime` |
| `ArticleDetailVO` | `ArticleCardVO` 全部 + `type: string`、`contentMd: string`、`prev: ArticleAdjacentVO \| null`、`next: ArticleAdjacentVO \| null` |
| `CategoryVO` | `id: string`、`name`、`slug`、`description: string \| null`、`articleCount: number` |
| `AdminArticleVO` | `id: string`、`title`、`slug`、`summary: string \| null`、`categoryId: string \| null`、`categoryName: string \| null`、`tags: string[]`、`status: number`、`wordCount`、`readingMinutes`、`viewCount`、`top`、`publishTime: string \| null`、`gmtModified: string \| null`、`contentMd: string \| null` |
| `LoginVO` | `token: string`、`tokenName: string`、`admin: AdminUserVO` |
| `AdminUserVO` | `id: string`、`username`、`nickname`、`role` |
| `UploadFileVO` | `url: string`、`size: number` |

- [ ] **Step 5: 写 `articles.ts` / `admin.ts`**（薄封装，只声明签名与路径）

```ts
// articles.ts
export interface ArticleListQuery {
  type?: string
  categoryId?: string
  tagSlug?: string
  page?: number
  size?: number
}

export const fetchArticles = (query: ArticleListQuery = {}) =>
  request<PageResult<ArticleCardVO>>('/api/v1/articles', { query: { ...query } })

export const fetchArticleDetail = (slug: string) =>
  request<ArticleDetailVO>(`/api/v1/articles/${encodeURIComponent(slug)}`)

export const reportArticleView = (slug: string) =>
  request<void>(`/api/v1/articles/${encodeURIComponent(slug)}/view`, { method: 'POST' })

export const fetchCategories = (scope = 'TECH') =>
  request<CategoryVO[]>('/api/v1/categories', { query: { scope } })

export const fetchTags = () => request<TagVO[]>('/api/v1/tags')
```

```ts
// admin.ts（全部 auth: true；只有 login 不带）
export const adminLogin = (username: string, password: string) =>
  request<LoginVO>('/api/v1/admin/auth/login', { method: 'POST', body: { username, password } })

export const adminLogout = () => request<void>('/api/v1/admin/auth/logout', { method: 'POST', auth: true })

export const fetchCurrentAdmin = () => request<AdminUserVO>('/api/v1/admin/auth/me', { auth: true })

export const fetchAdminArticles = (query: AdminArticleQuery) =>
  request<PageResult<AdminArticleVO>>('/api/v1/admin/articles', { auth: true, query: { ...query } })

export const fetchAdminArticle = (id: string) =>
  request<AdminArticleVO>(`/api/v1/admin/articles/${id}`, { auth: true })

export const saveAdminArticle = (payload: ArticleSavePayload) =>
  request<string>('/api/v1/admin/articles', { method: 'POST', auth: true, body: payload })

export const updateAdminArticle = (id: string, payload: ArticleSavePayload) =>
  request<void>(`/api/v1/admin/articles/${id}`, { method: 'POST', auth: true, body: payload })

export const publishAdminArticle = (id: string, status: number) =>
  request<void>(`/api/v1/admin/articles/${id}/publish`, { method: 'POST', auth: true, query: { status } })

export const deleteAdminArticle = (id: string) =>
  request<void>(`/api/v1/admin/articles/${id}/delete`, { method: 'POST', auth: true })

export const uploadImage = async (file: File) => {
  const form = new FormData()
  form.append('file', file)
  // 注意：上传走 multipart，不能用 client.request 的 JSON body 分支
  const token = getToken()
  const response = await fetch('/api/v1/admin/upload', {
    method: 'POST',
    headers: token ? { 'jcpress-token': token } : undefined,
    body: form,
  })
  const payload = (await response.json()) as ApiEnvelope<UploadFileVO>
  if (payload.code !== 0) throw new ApiError(payload.code, payload.message, response.status)
  return payload.data
}
```

- [ ] **Step 6: 跑测试**：`node node_modules/vitest/vitest.mjs run src/api/client.test.ts` → PASS（5 个用例）
- [ ] **Step 7: Commit**：`git commit -m "feat(web): API 客户端与类型（统一拆信封、token 走 sessionStorage、401 自动清 token）"`

---

## 2. Task 2: 数据接入（把 mock 换掉）

**Files:**
- Modify: `frontend/src/hooks/useArticles.ts`（改成真接口）
- Delete: `frontend/src/data/articles.ts`、`frontend/src/data/articles.test.ts`
- Create: `frontend/src/hooks/{useArticleDetail,useLatestArticles,useCategories}.ts`
- Modify: `frontend/vite.config.ts`（加 proxy）

- [ ] **Step 1: 加 dev proxy**（**这是"消掉 CORS"的关键一步**：前端与后端同源 `/api`，生产由 Nginx 承担同样角色）

```ts
  server: {
    host: true,
    port: 5173,
    // 前端与后端同源：/api 一把代理过去（后端 context-path 就是 /api，不需要 rewrite）。
    // 上传的图片 URL 是 /api/uploads/... —— 也被这一条覆盖，不需要单独再配一条。
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
```

- [ ] **Step 2: 重写 `useArticles.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { fetchArticles, type ArticleListQuery } from '@/api/articles'

/**
 * 「技术分享」列表的唯一读取入口（三期：从 mock 换成真接口）。
 *
 * 后端就绪后组件侧零改动 —— 这是当初把数据放常量的全部理由。
 * 接口挂了就是错误态，不做假数据降级（Agent.md：依赖缺失应表现为失败）。
 */
export function useArticles(query: ArticleListQuery = {}) {
  return useQuery({
    queryKey: ['articles', query],
    queryFn: () => fetchArticles(query),
  })
}
```

- [ ] **Step 3: 写其余三个 hook**

```ts
// useArticleDetail.ts
export function useArticleDetail(slug: string) {
  return useQuery({
    queryKey: ['article', slug],
    queryFn: () => fetchArticleDetail(slug),
    enabled: slug.length > 0,
  })
}
```

```ts
// useLatestArticles.ts —— 首页区块与 /tech 首页共用
export function useLatestArticles(size = 3) {
  return useQuery({
    queryKey: ['articles', 'latest', size],
    queryFn: () => fetchArticles({ type: 'TECH', page: 1, size }),
  })
}
```

```ts
// useCategories.ts
export function useCategories(scope = 'TECH') {
  return useQuery({ queryKey: ['categories', scope], queryFn: () => fetchCategories(scope) })
}
```

- [ ] **Step 4: 删 mock 与其测试**：`Remove-Item frontend/src/data/articles.ts, frontend/src/data/articles.test.ts`
- [ ] **Step 5: 跑类型检查**：`cd frontend; npx tsc --noEmit` → 此时 `TechListPage.tsx` / `TechListPage.test.tsx` 会红（它们还按数组用 `useArticles()`）—— **这是预期的**，Task 4 重写这一页后转绿
- [ ] **Step 6: Commit**：`git commit -m "feat(web): 技术分享列表改走真接口并加 dev proxy（mock 数据源删除，接口失败即错误态）"`

---

## 3. Task 3: Markdown 渲染管线（正文 + TOC + 代码块）

**Files:**
- Create: `frontend/src/components/markdown/MarkdownBody.tsx`
- Create: `frontend/src/components/markdown/{CodeBlock,Toc}.tsx`
- Create: `frontend/src/components/markdown/{markdown.module.css,toc.module.css}`
- Create: `frontend/src/components/markdown/rehypeCollectHeadings.ts`
- Test: `frontend/src/components/markdown/MarkdownBody.test.tsx`

- [ ] **Step 1: 写 TOC 收集插件**（**不引 `unist-util-visit`** —— 自己写 15 行递归，少一个依赖）

```ts
export interface TocItem {
  id: string
  text: string
  level: 2 | 3
}

interface HastNode {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
  value?: string
}

const textOf = (node: HastNode): string => {
  if (node.type === 'text') return node.value ?? ''
  return (node.children ?? []).map(textOf).join('')
}

/**
 * 收集 h2/h3 作为 TOC 数据源。
 *
 * 必须排在 rehype-slug **之后**：id 是它加的，只有这样 TOC 的锚点才与 DOM 完全一致
 * （自己再算一遍 slug 迟早会与 github-slugger 的规则漂移）。
 *
 * 参数类型写 `unknown` 而不是从 `hast` 引 `Root`：`@types/hast` 只是 react-markdown 的
 * 传递依赖，直接 import 会在没有显式安装它时无法解析；`unknown` 是 `Root` 的超类型，
 * 赋值给 `rehypePlugins`（逆变参数位）同样成立。
 */
export function rehypeCollectHeadings(collect: (items: TocItem[]) => void) {
  return (tree: unknown) => {
    const items: TocItem[] = []
    const walk = (node: HastNode) => {
      if (node.tagName === 'h2' || node.tagName === 'h3') {
        const id = node.properties?.id
        if (typeof id === 'string') {
          items.push({ id, text: textOf(node), level: node.tagName === 'h2' ? 2 : 3 })
        }
      }
      ;(node.children ?? []).forEach(walk)
    }
    walk(tree as HastNode)
    collect(items)
  }
}
```

- [ ] **Step 2: 写 `CodeBlock`**（复制按钮；高亮由 `rehype-highlight` 完成，这里只包一层）

```tsx
import { Check, Copy } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import styles from './markdown.module.css'

/** 包住 <pre>：右上角复制按钮 + 横向滚动容器（详情页最常见的两个需求） */
export default function CodeBlock({ children, ...props }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false)

  const copy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    const pre = event.currentTarget.parentElement?.querySelector('pre')
    const text = pre?.textContent ?? ''
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className={styles.codeWrap}>
      <button type="button" className={styles.copyBtn} onClick={copy}
              aria-label={copied ? '已复制' : '复制代码'}>
        {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
        <span>{copied ? '已复制' : '复制'}</span>
      </button>
      <pre {...props}>{children}</pre>
    </div>
  )
}
```

- [ ] **Step 3: 写 `MarkdownBody`**

```tsx
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'

import CodeBlock from './CodeBlock'
import { rehypeCollectHeadings, type TocItem } from './rehypeCollectHeadings'
import styles from './markdown.module.css'

interface Props {
  markdown: string
  onHeadings?: (items: TocItem[]) => void
}

/** 正文渲染：GFM（表格/任务列表）+ 标题锚点 + 代码高亮 + 复制按钮 */
export default function MarkdownBody({ markdown, onHeadings }: Props) {
  return (
    <div className={styles.prose}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeSlug,
          rehypeHighlight,
          ...(onHeadings ? [rehypeCollectHeadings(onHeadings)] : []),
        ]}
        components={{
          pre: CodeBlock,
          a: ({ children, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
          table: ({ children, ...props }) => (
            <div className={styles.tableWrap}>
              <table {...props}>{children}</table>
            </div>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
```

- [ ] **Step 4: 写 `markdown.module.css`**（**护眼档位的落点**；高亮配色**映射到本站 token**，不引 highlight.js 自带主题）

```css
.prose {
  max-width: 68ch;
  font-size: 17px;
  line-height: 1.9;
  color: var(--ds-fg-1);
  counter-reset: section;
}

.prose p {
  margin: 0 0 1.15em;
}

/* 章节自动编号：h2 前面的 01 / 02 —— 不写死在正文里 */
.prose h2 {
  counter-increment: section;
  margin: 2.4em 0 0.9em;
  font-family: var(--ds-font-article-display);
  font-size: 1.5em;
  line-height: 1.4;
}
.prose h2::before {
  content: counter(section, decimal-leading-zero);
  margin-right: 0.6em;
  font-size: 0.72em;
  color: var(--ds-accent);
  letter-spacing: 0.08em;
}

.prose h3 {
  margin: 1.9em 0 0.7em;
  font-family: var(--ds-font-article-display);
  font-size: 1.18em;
}

/* 标题锚点：悬浮才显形，不干扰阅读 */
.prose :is(h2, h3) > a.anchor { opacity: 0; margin-left: 0.4em; }
.prose :is(h2, h3):hover > a.anchor { opacity: 0.6; }

.prose ul, .prose ol { margin: 0 0 1.15em; padding-left: 1.4em; }
.prose li { margin: 0.35em 0; }
.prose li::marker { color: var(--ds-accent); }

.prose blockquote {
  margin: 1.6em 0;
  padding: 0.2em 0 0.2em 1.1em;
  border-left: 2px solid var(--ds-accent);
  color: var(--ds-fg-2);
  font-style: italic;
}

.prose img { max-width: 100%; height: auto; border-radius: 10px; }

.prose code {
  font-family: var(--ds-font-mono);
  font-size: 0.88em;
  padding: 0.12em 0.36em;
  border-radius: 4px;
  background: var(--ds-bg-sunken);
}

.codeWrap { position: relative; margin: 1.6em 0; }
.codeWrap pre {
  margin: 0;
  padding: 1.05em 1.2em;
  overflow-x: auto;              /* 代码横向滚动，不换行 */
  border-radius: 10px;
  background: var(--ds-bg-sunken);
  border: 1px solid var(--ds-border);
}
.codeWrap pre code {
  background: none;
  padding: 0;
  font-size: 14px;
  line-height: 1.7;
  white-space: pre;
}
.copyBtn {
  position: absolute;
  top: 0.6em;
  right: 0.6em;
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  padding: 0.3em 0.55em;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid var(--ds-border);
  background: var(--ds-bg-elevated);
  color: var(--ds-fg-2);
  cursor: pointer;
  opacity: 0;
  transition: opacity 140ms ease;
}
.codeWrap:hover .copyBtn, .copyBtn:focus-visible { opacity: 1; }

.tableWrap { overflow-x: auto; margin: 1.6em 0; }
.prose table { border-collapse: collapse; width: 100%; font-size: 0.94em; }
.prose :is(th, td) { border: 1px solid var(--ds-border); padding: 0.5em 0.7em; text-align: left; }
.prose th { background: var(--ds-bg-sunken); font-weight: 600; }

/* highlight.js 的 token 类名映射到本站颜色（不引第三方主题，亮暗同一套变量） */
.prose :global(.hljs-comment), .prose :global(.hljs-quote) { color: var(--ds-fg-3); font-style: italic; }
.prose :global(.hljs-keyword), .prose :global(.hljs-selector-tag) { color: var(--ds-syn-keyword); }
.prose :global(.hljs-string), .prose :global(.hljs-attr) { color: var(--ds-syn-string); }
.prose :global(.hljs-number), .prose :global(.hljs-literal) { color: var(--ds-syn-number); }
.prose :global(.hljs-title), .prose :global(.hljs-function) { color: var(--ds-syn-function); }
.prose :global(.hljs-type), .prose :global(.hljs-built_in) { color: var(--ds-syn-type); }

@media (prefers-reduced-motion: reduce) {
  .copyBtn { transition: none; }
}
```

> **需要新增 5 个语法色 token**（`--ds-syn-keyword/string/number/function/type`）+ `--ds-font-article-display` + `--ds-font-article`，**亮暗各一套**，写在 `theme.jcpress.css` 里，取值必须过对比度（Task 9 的审计会验）。

- [ ] **Step 5: 写测试**（渲染形状 + TOC 锚点一致 + 代码块有复制按钮）

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import MarkdownBody from './MarkdownBody'
import type { TocItem } from './rehypeCollectHeadings'

const MARKDOWN = `# 大标题

## 一、模板不是基线

正文里有一个 [链接](https://example.com)。

### 1.1 子节

| 列 A | 列 B |
| --- | --- |
| 1 | 2 |

\`\`\`java
public class Demo {}
\`\`\`
`

describe('MarkdownBody', () => {
  it('renders github flavoured markdown including tables', () => {
    render(<MarkdownBody markdown={MARKDOWN} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('模板不是基线', { exact: false })).toBeInTheDocument()
  })

  it('reports headings whose ids match the rendered anchors', () => {
    const spy = vi.fn()
    const { container } = render(<MarkdownBody markdown={MARKDOWN} onHeadings={spy} />)

    const items = spy.mock.calls[0][0] as TocItem[]
    expect(items.map((item) => item.level)).toEqual([2, 3])
    items.forEach((item) => {
      expect(container.querySelector(`#${item.id}`)).not.toBeNull()
    })
  })

  it('gives every code block a copy button and opens external links safely', () => {
    render(<MarkdownBody markdown={MARKDOWN} />)
    expect(screen.getByRole('button', { name: /复制代码/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '链接' })).toHaveAttribute('rel', 'noreferrer noopener')
  })
})
```

- [ ] **Step 6: 装依赖并跑测试**

```powershell
cd frontend
npm install react-markdown@10.1.0 remark-gfm@4.0.1 rehype-highlight@7.0.2 rehype-slug@6.0.0 highlight.js@11.12.0 --cache ../.tmp/npm-cache
node node_modules/vitest/vitest.mjs run src/components/markdown
```

Expected: PASS（3 个用例）

- [ ] **Step 7: Commit**：`git commit -m "feat(web): Markdown 正文管线（GFM + 锚点 + 高亮 + 复制按钮），高亮配色映射本站 token"`

---

## 4. Task 4: `/tech` 列表页改版（卡片博客风）

**Files:**
- Create: `frontend/src/pages/tech/ArticleCard.tsx` + `ArticleCard.module.css`
- Rewrite: `frontend/src/pages/tech/TechListPage.tsx` + `TechListPage.module.css`
- Rewrite: `frontend/src/pages/tech/TechListPage.test.tsx`

- [ ] **Step 1: 写 `ArticleCard`**（封面缺图时用**品牌渐变 + 衬线首字**，不依赖外部图片）

```tsx
import { Link } from 'react-router-dom'

import type { ArticleCardVO } from '@/api/types'
import styles from './ArticleCard.module.css'

const formatDate = (value: string) => value.slice(0, 10).replace(/-/g, '.')

interface Props {
  article: ArticleCardVO
  featured?: boolean
}

/** 卡片：封面（无图时字体封面）→ 分类胶囊 → 标题 → 摘要 → 档案行 */
export default function ArticleCard({ article, featured = false }: Props) {
  return (
    <Link to={`/tech/${article.slug}`}
          className={`${styles.card} ${featured ? styles.featured : ''}`}>
      <span className={styles.cover} aria-hidden="true">
        {article.coverUrl ? (
          <img src={article.coverUrl} alt="" loading="lazy" />
        ) : (
          <span className={styles.coverGlyph}>{article.title.slice(0, 1)}</span>
        )}
      </span>
      <span className={styles.body}>
        {article.categoryName && <span className={styles.category}>{article.categoryName}</span>}
        <span className={styles.title}>{article.title}</span>
        {article.summary && <span className={styles.summary}>{article.summary}</span>}
        <span className={styles.meta}>
          <span>{formatDate(article.publishTime)}</span>
          <span aria-hidden="true">·</span>
          <span>{article.readingMinutes} 分钟</span>
          {article.tags.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className={styles.tags}>{article.tags.map((tag) => tag.name).join(' / ')}</span>
            </>
          )}
        </span>
      </span>
    </Link>
  )
}
```

- [ ] **Step 2: 写卡片样式**（**视觉纪律破例范围就落在这个文件里**：卡片/圆角/阴影/封面 —— 写一段注释说明为什么这里可以破例、范围到哪里为止）

```css
/* 三期视觉破例（design-tech-module.md D6）：卡片、圆角 >8px、阴影、封面头图
   **只允许出现在 /tech 列表页与文章详情页**；首页其它区块与全站 token 不动。
   理由：用户明确要「现代卡片博客风」，见 decisions.md 的三期修订条目。 */

.card {
  display: grid;
  grid-template-columns: 132px 1fr;
  gap: 1.1rem;
  padding: 1.1rem;
  border: 1px solid var(--ds-border);
  border-radius: 14px;
  background: var(--ds-bg-elevated);
  box-shadow: 0 1px 2px rgb(15 23 42 / 4%);
  text-decoration: none;
  color: inherit;
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
}
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgb(15 23 42 / 10%);
  border-color: var(--ds-accent-soft);
}
.card:focus-visible { outline: 2px solid var(--ds-accent); outline-offset: 2px; }

.cover {
  position: relative;
  overflow: hidden;
  border-radius: 10px;
  aspect-ratio: 4 / 3;
  background: linear-gradient(135deg, var(--ds-accent) 0%, var(--ds-accent-soft) 100%);
  display: grid;
  place-items: center;
}
.cover img { width: 100%; height: 100%; object-fit: cover; }
.coverGlyph {
  font-family: var(--ds-font-article-display);
  font-size: 2.4rem;
  color: #fff;
  opacity: 0.92;
}

.category { font-size: 12px; letter-spacing: 0.06em; color: var(--ds-accent); }
.title { display: block; margin-top: 0.35rem; font-size: 1.12rem; line-height: 1.5; }
.summary {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-top: 0.45rem;
  color: var(--ds-fg-2);
  font-size: 0.94rem;
  line-height: 1.7;
}
.meta { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.7rem; font-size: 12px; color: var(--ds-fg-3); }

@media (max-width: 719px) {
  .card { grid-template-columns: 1fr; }
  .cover { aspect-ratio: 16 / 9; }
}
@media (prefers-reduced-motion: reduce) {
  .card { transition: none; }
  .card:hover { transform: none; }
}
```

- [ ] **Step 3: 重写 `TechListPage.tsx`**（栅格 + 计数 + 空态 + 加载态 + 错误态；**错误态不许伪装成空态**）

```tsx
import { Link } from 'react-router-dom'

import { useArticles } from '@/hooks/useArticles'
import { useSpotlight } from '@/hooks/useSpotlight'
import spot from '@/styles/spotlight.module.css'
import ArticleCard from './ArticleCard'
import styles from './TechListPage.module.css'

const PAGE_SIZE = 20

export default function TechListPage() {
  const { data, isPending, isError, error } = useArticles({ type: 'TECH', page: 1, size: PAGE_SIZE })
  const ref = useSpotlight<HTMLDivElement>()
  const articles = data?.list ?? []
  const latest = articles.reduce((max, item) => (item.publishTime > max ? item.publishTime : max), '')

  return (
    <section className={`container section ${styles.wrap}`} aria-labelledby="tech-title">
      <span className={styles.badge} data-ring="" aria-hidden="true" />
      <h1 id="tech-title" className={styles.title}>技术分享</h1>
      <p className={styles.lead}>把踩过的坑写清楚：Java 后端、AI Agent 工程、数据库与中间件。</p>

      {isPending && <p className={styles.state}>正在取文章…</p>}

      {isError && (
        <div className={styles.empty} role="alert">
          <p>文章列表没取回来：{error instanceof Error ? error.message : '未知错误'}</p>
          <p className={styles.emptyHint}>后端没起来或是接口出错 —— 这里不会拿假数据凑数。</p>
        </div>
      )}

      {!isPending && !isError && articles.length === 0 && (
        <div className={styles.empty}>
          <p>还没有发布的文章。</p>
          <p className={styles.emptyHint}>去后台写第一篇，或先用导入器把 content/ 下的 Markdown 灌进来。</p>
          <Link to="/" className="btn btnSolid">回到首页</Link>
        </div>
      )}

      {articles.length > 0 && (
        <>
          <p className={styles.count}>
            共 {data?.total ?? articles.length} 篇 · 更新至 {latest.slice(0, 10).replace(/-/g, '.')}
          </p>
          <div ref={ref} className={`${spot.host} ${styles.grid}`}>
            {articles.map((article, index) => (
              <ArticleCard key={article.slug} article={article} featured={index === 0} />
            ))}
          </div>
          {(data?.total ?? 0) > PAGE_SIZE && (
            <p className={styles.more}>还有 {data!.total - PAGE_SIZE} 篇 —— 分页与筛选留给下一期。</p>
          )}
        </>
      )}
    </section>
  )
}
```

- [ ] **Step 4: 写栅格样式**（桌面 2 栏、≥1200px 3 栏、≤719px 单栏；首篇跨栏做「头版」）

```css
.grid { display: grid; gap: 1.1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid > :first-child { grid-column: 1 / -1; }          /* 头版通栏 */
@media (min-width: 1200px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 719px) { .grid { grid-template-columns: 1fr; } }
.count { margin: 1.6rem 0 1rem; font-size: 13px; letter-spacing: 0.05em; color: var(--ds-fg-3); }
.state { margin-top: 2rem; color: var(--ds-fg-2); }
```

- [ ] **Step 5: 重写页面测试**（`vi.mock('@/api/articles')`，不碰真后端；覆盖加载/错误/空/正常四态）

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ArticleCardVO } from '@/api/types'
import TechListPage from './TechListPage'

const fetchArticles = vi.fn()
vi.mock('@/api/articles', () => ({
  fetchArticles: (...args: unknown[]) => fetchArticles(...args),
}))

const card = (slug: string, title: string): ArticleCardVO => ({
  id: '1', title, slug, summary: '摘要', coverUrl: null, categoryName: 'Java 后端',
  categorySlug: 'java-backend', tags: [{ name: 'Redis', slug: 'redis' }],
  readingMinutes: 7, viewCount: 3, top: 0, publishTime: '2026-10-02 09:00:00',
})

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><TechListPage /></MemoryRouter>
    </QueryClientProvider>,
  )

describe('TechListPage', () => {
  beforeEach(() => fetchArticles.mockReset())

  it('shows one card per article and links to the detail route', async () => {
    fetchArticles.mockResolvedValue({ list: [card('a', '第一篇'), card('b', '第二篇')], page: 1, size: 20, total: 2, pages: 1 })
    renderPage()

    const link = await screen.findByRole('link', { name: /第一篇/ })
    expect(link).toHaveAttribute('href', '/tech/a')
    expect(screen.getByText(/共 2 篇/)).toBeInTheDocument()
  })

  it('renders an error state instead of pretending the list is empty', async () => {
    fetchArticles.mockRejectedValue(new Error('后端没起来'))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('后端没起来')
    expect(screen.queryByText(/还没有发布的文章/)).toBeNull()
  })

  it('renders the empty state when the backend returns nothing', async () => {
    fetchArticles.mockResolvedValue({ list: [], page: 1, size: 20, total: 0, pages: 0 })
    renderPage()

    await waitFor(() => expect(screen.getByText(/还没有发布的文章/)).toBeInTheDocument())
  })
})
```

- [ ] **Step 6: 跑测试与类型检查**

```powershell
cd frontend
node node_modules/vitest/vitest.mjs run src/pages/tech
npx tsc --noEmit
```

Expected: PASS（3 个用例）+ 类型检查通过

- [ ] **Step 7: 肉眼看一次**（dev server 会自动热更）：打开 `http://127.0.0.1:5173/tech`，应看到 1 张头版卡 + 计数行；hover 有抬升
- [ ] **Step 8: Commit**：`git commit -m "feat(web): /tech 改版为卡片博客风（头版通栏 + 字体封面 + 三态齐全），列表中每一项可点进详情"`

---

## 5. Task 5: `/tech/:slug` 详情页

**Files:**
- Create: `frontend/src/pages/tech/ArticleDetailPage.tsx` + `ArticleDetailPage.module.css`
- Create: `frontend/src/components/markdown/Toc.tsx` + `toc.module.css`
- Modify: `frontend/src/App.tsx`（新增路由，**懒加载**）
- Test: `frontend/src/pages/tech/ArticleDetailPage.test.tsx`

- [ ] **Step 1: 写 `Toc`**

```tsx
import { useEffect, useState } from 'react'

import type { TocItem } from './rehypeCollectHeadings'
import styles from './toc.module.css'

/** 右侧目录：滚动联动高亮当前小节；窄屏时由外部用 <details> 包起来 */
export default function Toc({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null)

  useEffect(() => {
    if (items.length === 0) return
    if (typeof IntersectionObserver === 'undefined') return

    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null)
    if (headings.length === 0) return

    // 与 useActiveScene 同一套机制：只观察「跨过视口中线」这一个事件，不新增滚动监听
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
        if (visible.length > 0) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    )
    headings.forEach((heading) => observer.observe(heading))
    return () => observer.disconnect()
  }, [items])

  if (items.length === 0) return null

  return (
    <nav className={styles.toc} aria-label="文章目录">
      <p className={styles.tocTitle}>目录</p>
      <ul>
        {items.map((item) => (
          <li key={item.id} className={item.level === 3 ? styles.level3 : undefined}>
            <a href={`#${item.id}`}
               className={item.id === activeId ? styles.active : undefined}
               aria-current={item.id === activeId ? 'location' : undefined}>
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
```

- [ ] **Step 2: 写详情页**（**上一页/下一页来自详情响应内联的 `prev`/`next`**，不再多打一次接口）

```tsx
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { reportArticleView } from '@/api/articles'
import MarkdownBody from '@/components/markdown/MarkdownBody'
import Toc from '@/components/markdown/Toc'
import type { TocItem } from '@/components/markdown/rehypeCollectHeadings'
import { useArticleDetail } from '@/hooks/useArticleDetail'
import styles from './ArticleDetailPage.module.css'

const formatDate = (value: string) => value.slice(0, 10).replace(/-/g, '.')

export default function ArticleDetailPage() {
  const { slug = '' } = useParams()
  const { data, isPending, isError, error } = useArticleDetail(slug)
  const [headings, setHeadings] = useState<TocItem[]>([])
  const onHeadings = useCallback((items: TocItem[]) => setHeadings(items), [])

  useEffect(() => {
    if (!data?.slug) return
    // 浏览量：幂等（后端按 ip+ua 按天去重）。失败不打扰读者，也不改页面。
    void reportArticleView(data.slug).catch(() => undefined)
  }, [data?.slug])

  if (isPending) {
    return <section className="container section"><p className={styles.state}>正在取文章…</p></section>
  }
  if (isError || !data) {
    return (
      <section className="container section" role="alert">
        <h1 className={styles.errorTitle}>这篇文章没取回来</h1>
        <p className={styles.state}>{error instanceof Error ? error.message : '未知错误'}</p>
        <Link to="/tech" className="btn btnSolid">回到技术分享</Link>
      </section>
    )
  }

  return (
    <article className={`container section ${styles.wrap}`}>
      <header className={styles.header}>
        <p className={styles.breadcrumb}><Link to="/tech">技术分享</Link></p>
        <h1 className={styles.title}>{data.title}</h1>
        <p className={styles.meta}>
          {data.categoryName && <span className={styles.category}>{data.categoryName}</span>}
          <span>{formatDate(data.publishTime)}</span>
          <span aria-hidden="true">·</span>
          <span>{data.readingMinutes} 分钟</span>
          <span aria-hidden="true">·</span>
          <span>{data.viewCount} 次阅读</span>
          {data.tags.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>{data.tags.map((tag) => tag.name).join(' / ')}</span>
            </>
          )}
        </p>
      </header>

      <div className={styles.layout}>
        <div className={styles.main}>
          <details className={styles.mobileToc}>
            <summary>目录</summary>
            <Toc items={headings} />
          </details>
          <MarkdownBody markdown={data.contentMd} onHeadings={onHeadings} />
        </div>
        <aside className={styles.aside}>
          <Toc items={headings} />
        </aside>
      </div>

      <nav className={styles.adjacent} aria-label="相邻文章">
        {data.prev ? (
          <Link to={`/tech/${data.prev.slug}`} className={styles.adjacentCard}>
            <span className={styles.adjacentLabel}>上一篇</span>
            <span className={styles.adjacentTitle}>{data.prev.title}</span>
          </Link>
        ) : <span />}
        {data.next && (
          <Link to={`/tech/${data.next.slug}`} className={`${styles.adjacentCard} ${styles.adjacentNext}`}>
            <span className={styles.adjacentLabel}>下一篇</span>
            <span className={styles.adjacentTitle}>{data.next.title}</span>
          </Link>
        )}
      </nav>

      <p className={styles.back}><Link to="/tech">← 回到技术分享</Link></p>
    </article>
  )
}
```

- [ ] **Step 3: 写详情页样式**（正文档位在 `markdown.module.css`；这里管版式与 TOC 栏）

```css
.layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2.5rem; }
@media (min-width: 1024px) {
  .layout { grid-template-columns: minmax(0, 68ch) 220px; justify-content: center; }
  .mobileToc { display: none; }
}
@media (max-width: 1023px) {
  .aside { display: none; }
  .mobileToc { margin-bottom: 1.4rem; }
}
.title {
  font-family: var(--ds-font-article-display);
  font-size: clamp(1.7rem, 4vw, 2.5rem);
  line-height: 1.35;
  margin: 0.6rem 0 0.9rem;
}
.meta { display: flex; flex-wrap: wrap; gap: 0.45rem; font-size: 13px; color: var(--ds-fg-3); }
.header { margin-bottom: 2rem; }
.adjacent { display: grid; gap: 0.9rem; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 3rem 0 1.5rem; }
.adjacentCard {
  display: grid; gap: 0.3rem; padding: 0.9rem 1rem;
  border: 1px solid var(--ds-border); border-radius: 12px;
  background: var(--ds-bg-elevated); text-decoration: none; color: inherit;
}
.adjacentNext { text-align: right; }
.adjacentLabel { font-size: 12px; color: var(--ds-accent); letter-spacing: 0.06em; }
@media (max-width: 719px) { .adjacent { grid-template-columns: 1fr; } }
```

- [ ] **Step 4: 接路由（懒加载）**

```tsx
// App.tsx 顶部
import { lazy, Suspense } from 'react'
const ArticleDetailPage = lazy(() => import('@/pages/tech/ArticleDetailPage'))
const AdminLoginPage = lazy(() => import('@/pages/admin/AdminLoginPage'))
const AdminArticleListPage = lazy(() => import('@/pages/admin/AdminArticleListPage'))
const AdminArticleEditPage = lazy(() => import('@/pages/admin/AdminArticleEditPage'))

// Routes 里（包一层 Suspense 兜住懒加载）
<Route path="/tech/:slug" element={
  <Suspense fallback={<p className="container section">正在加载…</p>}>
    <ArticleDetailPage />
  </Suspense>
} />
```

- [ ] **Step 5: 写页面测试**（用 `vi.mock('@/api/articles')` 喂 fixture：断言标题、表格、复制按钮、上下篇链接；错误态断言不显示正文）

- [ ] **Step 6: 跑测试 + 类型检查 + 肉眼**：访问 `/tech/phase-3-backend-retro`，检查正文栏宽、行高、章节号、代码块复制、TOC 高亮、暗色主题
- [ ] **Step 7: Commit**：`git commit -m "feat(web): 文章详情页（护眼正文版式 + 右侧目录 + 代码复制 + 上下篇），路由级懒加载"`

---

## 6. Task 6: 首页「最新技术分享」区块 + **scene 7 停靠返工**

**Files:**
- Create: `frontend/src/components/home/LatestArticles.tsx` + `LatestArticles.module.css`
- Modify: `frontend/src/pages/home/HomePage.tsx`
- Modify: 各首页区块的 `data-rhythm`（**保持 M/m 严格交替**）
- Modify: `frontend/src/components/visual/CelestialField.module.css`（补 `[data-scene='7']`）
- Create: `.tmp/tools/probe-docking.cjs`

- [ ] **Step 1: 写 `LatestArticles`**（复用 `useLatestArticles(3)`）

> ⛔ **不要用卡片。** 写 W4 时读 `openspec/specs/homepage/spec.md` 才发现：`homepage` 有一条硬要求 ——
> 「首页 SHALL 只对**关键数字 / 项目经历 / 技术栈**三类区块使用面板容器（玻璃底色 + 圆角 + 边框）；
> 其余区块 SHALL 保持通栏，SHALL NOT 使用面板底色或投影」。
> 首页新区块若做成卡片，就同时违反这条 spec 与我自己批准的破例范围（**破例只在 `/tech` 与详情页**）。
> 所以首页这一块走**通栏紧凑列表**：每行 = 标题（左）+ 日期 · 阅读时长（右），行间用间距而非色块，
> 整体沿用首页既有的排版层级与 `--ds-font-display`/`--ds-font-sans`，**不引 ArticleCard**。

**三条硬要求，漏了会静默失效**：
1. 区块根节点**必须**带 `aria-labelledby`（`<section aria-labelledby="latest-articles-title">`）—— `useActiveScene` 的选择器就是 `main section[aria-labelledby]`，没有它这个区块**不会被算成一个 scene**，区块数仍是 7，后面所有停靠分析都建立在错误前提上。
2. 根节点带 `data-block="latest-articles"` —— `audit-behavior.cjs` 的三期断言靠它定位（Task 9 #9）。
3. 三行都必须是 `<Link to={\`/tech/${slug}\`}>`；**加载失败显示"没取回来"而不是空态**（错误不许伪装成没内容）。

- [ ] **Step 2: 插进 `HomePage`**（位置：`ProjectShowcase` 之后、`SkillMatrix` 之前）

```tsx
      <HighlightStats metrics={highlights} />
      <ExperienceTimeline experiences={experiences} />
      <ProjectShowcase projects={projects} />
      {/* 三期新增：产出之后、能力清单之前的「最新技术分享」。
          插入它会把首页从 7 个区块变成 8 个 —— 天体停靠表、data-rhythm、
          reveal 错峰、四视口截图与对比度审计都必须一起重验（见本任务 Step 3-5）。 */}
      <LatestArticles />
      <SkillMatrix groups={skillGroups} />
```

- [ ] **Step 3: 重排 `data-rhythm`（严格 M/m 交替）**

| 顺序 | 区块 | 改前 | 改后 |
| --- | --- | --- | --- |
| 1 | HighlightStats | major | major |
| 2 | ExperienceTimeline | minor | minor |
| 3 | ProjectShowcase | major | major |
| 4 | **LatestArticles（新）** | — | **minor** |
| 5 | SkillMatrix | minor | **major** |
| 6 | EducationAwards | major | **minor** |
| 7 | ContactBar | minor | **major** |

- [ ] **Step 4: 写停靠探针 `.tmp/tools/probe-docking.cjs`**（**先量，再写 CSS** —— 不靠感觉挪球）

> **写脚本前先读一眼 `CelestialField.tsx`**：确认天体在 DOM 里到底是哪一个元素、`.field` 下面有几层。
> 下面这版用 `[data-scene] > *` 取天体，**如果实际结构不同就按实际改选择器** —— 选择器取错会让探针一直报"压字 0 处"，那是最危险的假绿。

```js
const { chromium } = require('playwright-core')

/**
 * 天体停靠探针：逐 scene 输出 ① 天体的实际矩形 ② 该区块内所有文字元素的矩形，
 * 并判定两者是否相交。改版式之后必须跑一次（decisions.md #97 / #98）。
 */
;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
  await page.evaluate(() => document.documentElement.removeAttribute('data-reveal'))

  const sceneCount = await page.evaluate(() => document.querySelectorAll('main section[aria-labelledby]').length)
  console.log(`区块数（= scene 数）= ${sceneCount}`)

  for (let scene = 0; scene < sceneCount; scene++) {
    await page.evaluate((index) => {
      const section = document.querySelectorAll('main section[aria-labelledby]')[index]
      section.scrollIntoView({ block: 'center' })
    }, scene)
    await page.waitForTimeout(1600)   // 让停靠 transition（1400ms）走完

    const result = await page.evaluate((index) => {
      const field = document.querySelector('[data-scene]')
      const ball = field?.querySelector(':scope > *')
      const section = document.querySelectorAll('main section[aria-labelledby]')[index]
      const ballRect = ball?.getBoundingClientRect()
      const texts = Array.from(section.querySelectorAll('h1,h2,h3,p,li,span,a,td'))
        .map((el) => ({ text: el.textContent.trim().slice(0, 24), rect: el.getBoundingClientRect() }))
        .filter((item) => item.text.length > 0)
      const overlaps = ballRect
        ? texts.filter((item) =>
            !(item.rect.right < ballRect.left || item.rect.left > ballRect.right ||
              item.rect.bottom < ballRect.top || item.rect.top > ballRect.bottom))
        : []
      return { scene: field?.getAttribute('data-scene'), ball: ballRect, overlaps }
    }, scene)

    console.log(`\nscene ${scene}（当前 data-scene=${result.scene}）`)
    console.log(`  天体矩形: ${result.ball ? JSON.stringify(result.ball) : 'n/a'}`)
    console.log(`  压字 ${result.overlaps.length} 处${result.overlaps.length ? ' ← 必须挪' : ''}`)
    result.overlaps.slice(0, 5).forEach((item) => console.log(`    ✗ "${item.text}"`))
  }
  await browser.close()
})().catch((e) => { console.error('ERR', e.message); process.exit(2) })
```

Run: `node .tmp/tools/probe-docking.cjs`
Expected: **先看到 scene 7 的 `data-scene` 停在 7 但没有任何 CSS 规则**（球退化成基础定位），并且可能压字

- [ ] **Step 5: 量出新区块（scene 4）与末尾（scene 7）的空带，补 CSS 规则**

照 `CelestialField.module.css` 现有 scene 的写法补两条（`scene 4` = 新增区块、`scene 7` = ContactBar 变成最后一块后需要的位置），并在注释里留下**实测矩形**（与 scene 6 的既有做法一致）：

```css
/* scene 4 · 最新技术分享（三期新增）
   实测（1280×900，2026-10-xx）：区块矩形 y 210–640；左侧唯一空带 y 300–520（x < 360），
   球放该带中线 → translate3d(46vw, 41vh) scale(1.1) */
.field[data-scene='4'] { /* …照现有 scene 写法填 translate/scale… */ }
```

- [ ] **Step 6: 复跑探针确认「压字 0 处」**，然后跑完整视觉门

```powershell
node .tmp/tools/probe-docking.cjs        # 每个 scene 都应为 压字 0 处
node .tmp/tools/audit-behavior.cjs       # 见 Task 9 的扩展
node .tmp/tools/audit-contrast.cjs
node .tmp/tools/shot-final.cjs .tmp/shots-p3
```

- [ ] **Step 7: Commit**：`git commit -m "feat(web): 首页新增最新技术分享区块，并连带完成 scene 4/7 停靠与 rhythm 重排"`

---

## 7. Task 7: 后台写入口（登录 / 列表 / 编辑）

**Files:**
- Create: `frontend/src/pages/admin/{AdminLayout,AdminLoginPage,AdminArticleListPage,AdminArticleEditPage}.tsx` + 各自 CSS
- Create: `frontend/src/components/admin/MarkdownEditor.tsx` + `MarkdownEditor.module.css`
- Create: `frontend/src/hooks/{useAdminAuth,useAdminArticles}.ts`
- Modify: `frontend/src/App.tsx`（三条 admin 路由，懒加载）
- Modify: `frontend/public/robots.txt`（禁收录 `/admin`；没有该文件就新建）
- Test: `frontend/src/pages/admin/AdminArticleEditPage.test.tsx`

- [ ] **Step 1: 写 `useAdminAuth`**（token 存在 sessionStorage；`/me` 失败即视为未登录）

```ts
export function useAdminAuth() {
  const queryClient = useQueryClient()
  const me = useQuery({
    queryKey: ['admin', 'me'],
    queryFn: fetchCurrentAdmin,
    enabled: getToken() !== null,
    retry: false,
  })
  const login = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      adminLogin(username, password),
    onSuccess: (data) => {
      setToken(data.token)
      queryClient.setQueryData(['admin', 'me'], data.admin)
    },
  })
  const logout = useMutation({
    mutationFn: adminLogout,
    onSuccess: () => {
      clearToken()
      queryClient.removeQueries({ queryKey: ['admin'] })
    },
  })
  return { me, login, logout }
}
```

- [ ] **Step 2: 写 `MarkdownEditor`**（CodeMirror 6 + 实时预览 + **粘贴上传图片**）

```tsx
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { useEffect, useRef, useState } from 'react'

import { uploadImage } from '@/api/admin'
import MarkdownBody from '@/components/markdown/MarkdownBody'
import styles from './MarkdownEditor.module.css'

interface Props {
  value: string
  onChange: (next: string) => void
}

export default function MarkdownEditor({ value, onChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [uploading, setUploading] = useState(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!hostRef.current) return

    const insertUploadedImage = async (file: File, view: EditorView) => {
      setUploading(true)
      try {
        const uploaded = await uploadImage(file)
        const position = view.state.selection.main.head
        view.dispatch({ changes: { from: position, insert: `\n![${file.name}](${uploaded.url})\n` } })
      } finally {
        setUploading(false)
      }
    }

    const view = new EditorView({
      doc: value,
      parent: hostRef.current,
      extensions: [
        basicSetup,
        markdown(),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString())
        }),
        // 粘贴上传：只截图片，其余粘贴交给编辑器默认行为
        EditorView.domEventHandlers({
          paste: (event: Event, editorView: EditorView) => {
            const clipboard = event as ClipboardEvent
            const file = Array.from(clipboard.clipboardData?.files ?? []).find((item) =>
              item.type.startsWith('image/'),
            )
            if (!file) return false
            event.preventDefault()
            void insertUploadedImage(file, editorView)
            return true
          },
        }),
      ],
    })
    return () => view.destroy()
    // 只在挂载时建一次编辑器：value 的后续变化由外部状态驱动，避免重建时丢光标
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={styles.editor}>
      <div className={styles.pane}>
        <div className={styles.paneHead}>
          Markdown
          {uploading && <span className={styles.hint}>图片上传中…</span>}
        </div>
        <div ref={hostRef} className={styles.cmHost} />
      </div>
      <div className={styles.pane}>
        <div className={styles.paneHead}>预览</div>
        <div className={styles.preview}>
          <MarkdownBody markdown={value} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 写三个页面**（都是**标准管理台样式，与公开站视觉隔离** —— 规划 §10.4；不复用衬线/流线/天体层）

| 页面 | 要点 |
| --- | --- |
| `AdminLoginPage` | 用户名 + 口令 → `login.mutate`；失败把 `ApiError.message` 显示出来；成功后 `navigate('/admin/articles')` |
| `AdminArticleListPage` | 状态筛选（全部/草稿/已发布/归档）· 关键词 · 分类；每行：标题、状态徽标、更新时间、字数、浏览、操作（编辑 / 发布·撤回 / **删除二次确认**） |
| `AdminArticleEditPage` | 标题、slug（留空提示"中文标题请手填"，失焦校验格式与唯一性）、摘要、分类下拉、标签（逗号分隔输入）、封面 URL、`MarkdownEditor`、保存草稿 / 发布；`useParams().id === 'new'` 时走新建 |

- [ ] **Step 4: 路由与守卫**

```tsx
// /admin 三条路由；未登录（/me 401）→ 跳 /admin/login
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { me } = useAdminAuth()
  const location = useLocation()
  if (getToken() === null || me.isError) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }
  if (me.isPending) return <p className="container section">正在校验登录态…</p>
  return <>{children}</>
}
```

- [ ] **Step 5: 写编辑页测试**（`vi.mock('@/api/admin')`：断言"中文标题 + 空 slug → 提交前拦下并给出提示"、"保存调用 updateAdminArticle 且带上 id"）

- [ ] **Step 6: 装编辑器依赖 + 跑测试 + 肉眼走一遍全链路**

```powershell
cd frontend
npm install codemirror@6.0.2 @codemirror/lang-markdown@6.5.2 @codemirror/view@6.43.13 --cache ../.tmp/npm-cache
node node_modules/vitest/vitest.mjs run src/pages/admin
```

肉眼：`/admin/login` 用 `admin / jcpress@2026` 登录 → 列表能看到 5 篇草稿 → 打开一篇改标题保存 → 发布 → 前台 `/tech` 立即可见（TanStack Query 的 `staleTime` 是 5 分钟，验证时**手动刷新页面**）

- [ ] **Step 7: Commit**：`git commit -m "feat(web): 后台写入口（登录守卫 + 文章列表 + CodeMirror 编辑 + 粘贴上传），与公开站视觉隔离"`

---

## 8. Task 8: 文章页字体子集（GB2312 一级字，独立 family）

**Files:**
- Create: `frontend/scripts/gen-article-charset.cjs`
- Create: `frontend/src/styles/fonts-article.css`
- Modify: `frontend/package.json`（加 `fonts:chars:article`、`fonts:build:article` 两个脚本）
- Modify: `frontend/src/pages/tech/ArticleDetailPage.tsx`（import 该 CSS —— 让它只进详情页 chunk）
- Modify: `frontend/scripts/audit-display-font.cjs`（见 Step 5）

- [ ] **Step 1: 写字符表生成脚本**（**零依赖**：Node 自带 full-icu 的 `TextDecoder('gbk')`，下同 —— `0xB0A1–0xD7F9` 就是 GB2312 一级字库 3755 字）

```js
#!/usr/bin/env node
/**
 * 文章页字符表：GB2312 **一级字库**（3755 字）。
 *
 * 为什么需要它：一期那套自托管衬线子集是从**静态 DOM** 收集的 531 字，而文章正文/标题
 * 是后台随时写的 —— 任何表外汉字都会回落到系统宋体，同一段里出现两款字（README 与 #38 写过这个坑）。
 * 动态内容永远追不上字符表，所以文章页改用「一级字库全覆盖」的独立子集。
 *
 * 零依赖：Node 自带 full-icu，TextDecoder('gbk') 能直接解码区位码。
 * 一级字库区位：0xB0A1–0xD7F9（40 个区 × 94 位 = 3760，末尾 5 个未分配 → 3755 字）。
 *
 * 用法：npm run fonts:chars:article → 写 frontend/.tmp/fonts/chars-article.txt
 */
const fs = require('fs')
const path = require('path')

const OUT = path.resolve(__dirname, '../.tmp/fonts/chars-article.txt')
const decoder = new TextDecoder('gbk')

const chars = []
for (let high = 0xb0; high <= 0xd7; high++) {
  for (let low = 0xa1; low <= 0xfe; low++) {
    if (high === 0xd7 && low > 0xf9) continue          // 0xD7FA–0xD7FE 未分配
    const decoded = decoder.decode(new Uint8Array([high, low]))
    if (decoded.length === 1 && decoded !== '\uFFFD') chars.push(decoded)
  }
}

const unique = [...new Set(chars)]
if (unique.length !== 3755) {
  console.error(`✘ 一级字库应为 3755 字，实际 ${unique.length} —— 区位边界写错了`)
  process.exit(1)
}
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, unique.join(''), 'utf8')
console.log(`✔ 写入 ${path.relative(process.cwd(), OUT)}：${unique.length} 字`)
```

- [ ] **Step 2: 加 npm 脚本**（复用现有 `build-font-subset.cjs` 的四个参数，**不改它的代码**）

```json
    "fonts:chars:article": "node scripts/gen-article-charset.cjs",
    "fonts:build:article": "node scripts/gen-article-charset.cjs && node scripts/build-font-subset.cjs --weight=500 --chars=.tmp/fonts/chars-article.txt --collect=none --out=serif-sc-article-500.woff2 && node scripts/build-font-subset.cjs --weight=700 --chars=.tmp/fonts/chars-article.txt --collect=none --out=serif-sc-article-700.woff2"
```

Run: `cd frontend; npm run fonts:build:article`
Expected: 生成 `public/fonts/serif-sc-article-500.woff2`（预计 **1.1–1.4MB**）与 `serif-sc-article-700.woff2`（预计 **0.9–1.2MB**）；脚本会在体积超阈值时告警（现有阈值是给 531 字集定的，这里**预期会告警，属正常**，别被吓到）

- [ ] **Step 3: 写 `fonts-article.css`**（**独立 family 名**，因此不存在 README 警告的「同一字符被两个 face 抢」的问题；`unicode-range` 与静态两档逐字一致）

```css
/* 文章页专用子集（三期，design-tech-module.md D7）
   只有 /tech/:slug 会引用这个 family，所以这份 ~2.3MB 的字体**不会**在首页下载。
   @font-face 本身不触发下载：浏览器只在这些字形真正被用到时才取文件。 */
@font-face {
  font-family: 'JCPress Serif SC Article';
  src: url('/fonts/serif-sc-article-500.woff2') format('woff2');
  font-weight: 500;
  font-display: swap;
  /* 与 theme.jcpress.css 里两个静态 face 的 unicode-range 逐字一致 */
  unicode-range: U+3000-303F, U+4E00-9FFF, U+FF00-FFEF, U+2018-201D, U+2026;
}

@font-face {
  font-family: 'JCPress Serif SC Article';
  src: url('/fonts/serif-sc-article-700.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
  unicode-range: U+3000-303F, U+4E00-9FFF, U+FF00-FFEF, U+2018-201D, U+2026;
}
```

并在 `theme.jcpress.css` 的 token 区加两个变量（**只被文章页引用**）：

```css
  /* 三期：文章页专用衬线（GB2312 一级字全覆盖）。Latin 仍走 Georgia —— 与静态两档同一策略 */
  --ds-font-article: Georgia, 'JCPress Serif SC Article', 'Songti SC', serif;
  --ds-font-article-display: Georgia, 'JCPress Serif SC Article', 'Songti SC', serif;
```

- [ ] **Step 4: 在详情页 import 这份 CSS**（放在 `ArticleDetailPage.tsx` 顶部 → Vite 会把它并进详情页 chunk，首页不加载）

```tsx
import '@/styles/fonts-article.css'
```

验证：`cd frontend; npm run build` 后看 `dist/assets/` 的 chunk 划分 —— 字体 CSS 必须在详情页那个 chunk 里，**首屏 chunk 不得出现 `serif-sc-article`**

- [ ] **Step 5: 扩展 `audit-display-font.cjs`**（原来只断言「展示字 ⊆ 静态 700 子集」；现在文章页的展示字来自**文章子集**，所以判据要变成并集，并且**必须把 `/tech/:slug` 加进访问路由**）

```js
// 判据改为：任一被访问页面上的展示字，必须同时存在于「静态 700 子集」或「文章 700 子集」的 cmap 中
const fontFiles = ['public/fonts/serif-sc-700.woff2', 'public/fonts/serif-sc-article-700.woff2']
const ROUTES = ['/', '/tech', '/tech/phase-3-backend-retro', '/algo', '/projects', '/no-such-page']
```

Run: `node scripts/audit-display-font.cjs`
Expected: 全绿（文章页的展示字落在文章子集里）

- [ ] **Step 6: Commit**：`git commit -m "feat(web): 文章页专用字体子集（GB2312 一级字 3755，独立 family，只在详情页下载）"`

---

## 9. Task 9: 验收评估集与工具扩展

**Files:**
- Create: `docs/phase3-effect-matrix.md`
- Modify: `.tmp/tools/audit-contrast.cjs`（**参数化路由** —— 现在写死了 `goto('/')`）
- Modify: `.tmp/tools/audit-behavior.cjs`（新增三期 section）
- Modify: `.tmp/tools/shot-final.cjs`（新增三条路由）

- [ ] **Step 1: 改 `audit-contrast.cjs` 为多路由**（只改脚本底部驱动部分，`AUDIT` 函数与判定逻辑**一个字都不动**）

```js
const PAGES = [
  { name: 'home', path: '/' },
  { name: 'tech', path: '/tech' },
  { name: 'detail', path: '/tech/phase-3-backend-retro' },
  { name: 'admin-login', path: '/admin/login' },
]

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  let failures = 0
  for (const page of PAGES) {
    for (const scheme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme })
      const tab = await ctx.newPage()
      await tab.goto(`http://127.0.0.1:5173${page.path}`, { waitUntil: 'networkidle', timeout: 60000 })
      await tab.waitForTimeout(600)
      await tab.evaluate(() => document.documentElement.removeAttribute('data-reveal'))
      await tab.waitForTimeout(200)

      const rows = await tab.evaluate(AUDIT)
      const bad = rows.filter((r) => !r.pass)
      failures += bad.length
      console.log(`\n=== ${page.name} · ${scheme} === 检查 ${rows.length} 处，未达标 ${bad.length} 处`)
      bad.forEach((r) => console.log(`  ✗ ${r.ratio}:1 (需 ${r.need}) ${r.size}px [${r.cls}] "${r.text}"`))
      if (bad.length === 0) console.log('  ✔ 全部通过 AA')
      await ctx.close()
    }
  }
  await browser.close()
  console.log(`\n合计未达标：${failures}`)
  process.exit(failures > 0 ? 1 : 0)
})().catch((e) => { console.error('ERR', e.message); process.exit(2) })
```

- [ ] **Step 2: 给 `audit-behavior.cjs` 加三期 section**（照现有 section 的写法追加一个 `auditPhase3()`，并在主流程里调用；**不要改动现有 71 条断言**）

必断言项（每条都要有可判定的选择器）：

| # | 断言 | 判据 |
| --- | --- | --- |
| 1 | `/tech` 每张卡都是链接且指向 `/tech/<slug>` | `a[href^="/tech/"]` 数量 = 卡片数 |
| 2 | 卡片有封面（真图或字体封面） | 每张卡内 `img` 或 `.coverGlyph` 至少一个 |
| 3 | `/tech` 无横向溢出 | `scrollWidth <= clientWidth` |
| 4 | 详情页正文栏宽 ≈ 68ch | `prose.clientWidth / fontSize` 落在 60–72 |
| 5 | 详情页正文行高 = 1.9 | `getComputedStyle(p).lineHeight / fontSize ≈ 1.9` |
| 6 | 详情页 h2 自动编号存在 | `getComputedStyle(h2, '::before').content` 非 `none`/空 |
| 7 | 代码块有复制按钮且可见于 hover | `button[aria-label*="复制"]` 存在 |
| 8 | TOC 锚点与正文标题 id 一一对应 | TOC 内 `a[href^="#"]` 的 id 全部能在正文找到 |
| 9 | 首页新区块存在且 3 张卡都指向详情 | `[data-block="latest-articles"] a[href^="/tech/"]` = 3 |
| 10 | 首页区块数 = 8 | `main section[aria-labelledby]` = 8 |
| 11 | 触摸目标 ≥44px（卡片的可点区域） | 卡片高度 ≥ 44 |
| 12 | `/admin/login` 未登录时不显示后台内容 | 页面上没有文章列表元素 |

- [ ] **Step 3: 给 `shot-final.cjs` 加路由**（四视口 1280/768/390/375 × 四条路由 `/, /tech, /tech/:slug, /admin/login`，输出到 `shots-p3/`，每条都记录 `overflow=yes/no`）

- [ ] **Step 4: 写 `docs/phase3-effect-matrix.md`**（表头与二期一致：判据 / 复核命令 / 实测结果）

```markdown
# 三期效果矩阵（评估集）

> 用途：本期的视觉与交互**不可单测**，用这张表代替 TDD —— 每条效果 = 判据 + 复核命令 + 实测结果。
> 复跑全部：见 §「一键复跑」。任何一条未达标都不算完成。

## 一键复跑

```powershell
cd frontend; npx tsc --noEmit
cd frontend; node node_modules/vitest/vitest.mjs run
node .tmp/tools/audit-behavior.cjs
node .tmp/tools/audit-contrast.cjs
node .tmp/tools/probe-docking.cjs
node .tmp/tools/shot-final.cjs .tmp/shots-p3
cd frontend; npm run build     # 首屏 chunk 不得含 react-markdown / codemirror / serif-sc-article
```

## 效果清单

| # | 效果 | 判据（可判定） | 复核命令 | 实测 |
| --- | --- | --- | --- | --- |
| V1 | 博客感卡片列表 | 每卡有封面/分类/标题/摘要/档案行四项；首卡通栏 | audit-behavior #1–2 | 待填 |
| V2 | 阅读护眼 | 正文 17px / 行高 1.9 / 栏宽 60–72ch | audit-behavior #4–5 | 待填 |
| V3 | 章节自动编号 | h2 的 ::before 有 01/02 | audit-behavior #6 | 待填 |
| V4 | 代码可复制 | 复制按钮存在；点击后文案变"已复制" | audit-behavior #7 | 待填 |
| V5 | 目录可用 | TOC 锚点全部命中；滚动高亮 | audit-behavior #8 + 肉眼 | 待填 |
| V6 | 首页入口 | 新区块 3 卡可点；区块数 8 | audit-behavior #9–10 | 待填 |
| V7 | 双主题对比度 | 四条路由 × 亮暗，未达标 0 | audit-contrast | 待填 |
| V8 | 天体不压字 | 8 个 scene 全部"压字 0 处" | probe-docking | 待填 |
| V9 | 四视口无溢出 | 四条路由 × 四视口 `overflow=no` | shot-final | 待填 |
| V10 | 首屏体积 | 首屏 chunk 不含编辑器/Markdown/文章字体 | 构建产物检查 | 待填 |
| V11 | 字体不混款 | 展示字 ⊆ 静态 700 ∪ 文章 700 | audit-display-font | 待填 |
```

- [ ] **Step 5: 跑一遍全部门禁，把实测结果填回矩阵**（"待填"全部替换成真实数字；**跑不过的条目必须修到过，不允许留"已知问题"**）
- [ ] **Step 6: Commit**：`git commit -m "test(web): 三期效果矩阵（评估集）+ 验收工具扩展（多路由对比度、行为断言、停靠探针）"`

---

## 10. Task 10: W4 出口复核与留痕

- [ ] **Step 1: 过所有门**：上面 §一键复跑 的六条命令全绿
- [ ] **Step 2: 手工验收清单（必须在浏览器里逐条看过）**

| # | 动作 | 期望 |
| --- | --- | --- |
| 1 | 打开 `/` | 8 个区块；新区块 3 张卡；点第 1 张进详情 |
| 2 | 详情页 | 标题用衬线、正文栏宽舒适、章节号 01/02、代码块可复制、TOC 滚动高亮 |
| 3 | 切暗色 | 正文/代码/表格/引用全部可读，无浅色残留 |
| 4 | 375px 宽 | 单栏、无横向溢出、TOC 折叠成可展开 |
| 5 | `/tech` | 卡片刻点；首卡通栏；计数行正确 |
| 6 | `/admin/login` | 错口令有明确提示；对口令进入列表 |
| 7 | 后台编辑 | 改标题+正文 → 保存 → 发布 → 前台刷新可见 |
| 8 | 后台粘贴图片 | 正文里出现 `![...](/uploads/...)`，图片能显示 |
| 9 | 删除 | 二次确认后消失，前台也不可见 |

- [ ] **Step 3: 留痕**：`docs/dev-journal.md` 追加「阶段 35 · W4」四样（含**字体体积的真实数字**、**scene 停靠的实测矩形**、**踩到的坑**）
- [ ] **Step 4: Commit**：`git commit -m "docs(phase-3): W4 完成留痕"`
