import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ArticleDetailVO } from '@/api/types'
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
  tags: [{ name: 'Redis', slug: 'redis' }],
  readingMinutes: 7,
  viewCount: 12,
  top: 0,
  publishTime: '2026-10-02 09:00:00',
  type: 'TECH',
  contentMd: '## 一、为什么\n\n正文段落。\n\n| 列 A | 列 B |\n| --- | --- |\n| 1 | 2 |\n\n```java\npublic class Demo {}\n```\n',
  prev: { title: '上一篇标题', slug: 'prev-slug', publishTime: '2026-10-01 09:00:00' },
  next: null,
}

const renderPage = (slug = 'phase-3-backend-retro') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/tech/${slug}`]}>
        <Routes>
          <Route path="/tech/:slug" element={<ArticleDetailPage />} />
        </Routes>
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

  it('目录锚点与正文标题 id 一一对应（从渲染后的 DOM 收集）', async () => {
    fetchArticleDetail.mockResolvedValue(detail)
    const { container } = renderPage()

    await screen.findByRole('heading', { level: 1 })
    const heading = container.querySelector('h2[id]')
    expect(heading).not.toBeNull()

    // 目录里的锚点必须真的能在正文里找到
    const anchors = Array.from(container.querySelectorAll('nav[aria-label="文章目录"] a'))
    expect(anchors.length).toBeGreaterThan(0)
    anchors.forEach((anchor) => {
      const id = anchor.getAttribute('href')!.slice(1)
      expect(container.querySelector(`#${CSS.escape(id)}`)).not.toBeNull()
    })
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
})
