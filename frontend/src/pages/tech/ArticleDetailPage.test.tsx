import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ArticleDetailVO } from '@/api/types'
import type { TocItem } from '@/components/markdown/rehypeCollectHeadings'
import { PageTocContext } from '@/components/tech/pageTocContext'
import ArticleDetailPage from './ArticleDetailPage'

const fetchArticleDetail = vi.fn()
const reportArticleView = vi.fn()
vi.mock('@/api/articles', () => ({
  fetchArticleDetail: (...args: unknown[]) => fetchArticleDetail(...args),
  reportArticleView: (...args: unknown[]) => reportArticleView(...args),
}))

const detail: ArticleDetailVO = {
  id: '1',
  title: '把后台写清楚：三期技术分享模块复盘',
  slug: 'phase-3-backend-retro',
  summary: '摘要',
  coverUrl: null,
  categoryName: 'Java 后端',
  categorySlug: 'java-backend',
  // 两个标签：用来验证「只高亮命中的那一个」，整篇都亮等于没高亮
  tags: [
    { name: 'Redis', slug: 'redis' },
    { name: '架构', slug: 'architecture' },
  ],
  readingMinutes: 7,
  viewCount: 12,
  top: 0,
  publishTime: '2026-10-02 09:00:00',
  type: 'TECH',
  contentMd: '## 一、为什么\n\n正文段落。\n\n| 列 A | 列 B |\n| --- | --- |\n| 1 | 2 |\n\n```java\npublic class Demo {}\n```\n',
  prev: { title: '上一篇标题', slug: 'prev-slug', publishTime: '2026-10-01 09:00:00' },
  next: null,
}

/**
 * 详情页单独渲染（不带外壳）。2026-10-20 起页内目录不在本页的 DOM 里 ——
 * 它把收集到的小节通过 `PageTocContext` 推给外壳左栏，所以这里用一个假的
 * 收集器顶替外壳，`onPublish` 传 undefined 时就是「没有外壳」的常态。
 */
const renderPage = (
  slug = 'phase-3-backend-retro',
  onPublish?: (items: TocItem[]) => void,
  search = '',
) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/tech/${slug}${search}`]}>
        <PageTocContext.Provider value={onPublish ?? null}>
          <Routes>
            <Route path="/tech/:slug" element={<ArticleDetailPage />} />
          </Routes>
        </PageTocContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  )

describe('ArticleDetailPage', () => {
  beforeEach(() => {
    fetchArticleDetail.mockReset()
    reportArticleView.mockReset().mockResolvedValue(undefined)
  })

  it('渲染标题、正文表格与代码复制按钮', async () => {
    fetchArticleDetail.mockResolvedValue(detail)
    renderPage()

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('三期技术分享模块复盘')
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '复制代码' })).toBeInTheDocument()
  })

  it('把正文里的小节推给左栏目录，id 与正文标题一一对应', async () => {
    fetchArticleDetail.mockResolvedValue(detail)
    const published: TocItem[][] = []
    const { container } = renderPage('phase-3-backend-retro', (items) => published.push(items))

    await screen.findByRole('heading', { level: 1 })
    expect(container.querySelector('h2[id]')).not.toBeNull()

    // 目录数据是从渲染后的 DOM 里读的，所以推出去之后应当与正文 id 顺序一致
    await waitFor(() => expect(published.at(-1)?.length ?? 0).toBeGreaterThan(0))
    const items = published.at(-1)!
    const bodyIds = Array.from(container.querySelectorAll('h2[id], h3[id]')).map((el) => el.id)
    expect(items.map((item) => item.id)).toEqual(bodyIds)

    // 每个锚点都真的能在正文里落到地方
    items.forEach((item) => {
      expect(container.querySelector(`#${CSS.escape(item.id)}`)).not.toBeNull()
    })
  })

  it('正文里不再渲染目录（目录归外壳左栏）', async () => {
    fetchArticleDetail.mockResolvedValue(detail)
    const { container } = renderPage()

    await screen.findByRole('heading', { level: 1 })
    // 「相邻文章」那条 nav 还在，这里只盯目录
    expect(container.querySelector('nav[aria-label*="目录"]')).toBeNull()
  })

  it('上下篇使用详情响应内联的 prev/next，不再多打一次接口', async () => {
    fetchArticleDetail.mockResolvedValue(detail)
    renderPage()

    const prev = await screen.findByRole('link', { name: /上一篇标题/ })
    expect(prev).toHaveAttribute('href', '/tech/prev-slug')
    // next 为 null → 不渲染「下一篇」卡片
    expect(screen.queryByText('下一篇')).toBeNull()
  })

  it('上报浏览量（幂等，失败不打扰读者）', async () => {
    fetchArticleDetail.mockResolvedValue(detail)
    renderPage()

    await screen.findByRole('heading', { level: 1 })
    expect(reportArticleView).toHaveBeenCalledWith('phase-3-backend-retro')
  })

  it('取不到文章时显示错误态，且不渲染正文', async () => {
    fetchArticleDetail.mockRejectedValue(new Error('文章不存在'))
    renderPage('nope')

    expect(await screen.findByRole('alert')).toHaveTextContent('文章不存在')
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('标签渲染成可点的胶囊，点一下回到列表页按该标签搜索', async () => {
    fetchArticleDetail.mockResolvedValue(detail)
    renderPage()

    await screen.findByText('Redis')
    const tagLink = screen.getByText('Redis').closest('a')
    expect(tagLink?.getAttribute('href')).toBe('/tech?q=Redis')
    // 没有搜索词进来时一个都不高亮
    expect(tagLink?.getAttribute('data-active')).toBeNull()
  })

  it('从搜索结果点进来时，命中的那个标签高亮', async () => {
    fetchArticleDetail.mockResolvedValue(detail)
    renderPage('phase-3-backend-retro', undefined, '?q=redis')

    await screen.findByText('Redis')
    // 用文本定位再取最近的 a：标签上带了 title，可访问名不一定是纯文本
    const redisTag = screen.getByText('Redis').closest('a')
    const archTag = screen.getByText('架构').closest('a')
    expect(redisTag?.getAttribute('data-active')).toBe('true')
    // 只亮命中的那个：整篇文章的标签都亮等于没高亮
    expect(archTag?.getAttribute('data-active')).toBeNull()
  })
})
