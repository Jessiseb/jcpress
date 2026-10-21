import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ArticleCardVO, PageResult } from '@/api/types'
import TechListPage from './TechListPage'

const fetchArticles = vi.fn()
vi.mock('@/api/articles', () => ({
  fetchArticles: (...args: unknown[]) => fetchArticles(...args),
}))

const card = (slug: string, title: string): ArticleCardVO => ({
  id: '1',
  title,
  slug,
  summary: '摘要',
  coverUrl: null,
  categoryName: 'Java 后端',
  categorySlug: 'java-backend',
  tags: [{ name: 'Redis', slug: 'redis' }],
  readingMinutes: 7,
  viewCount: 3,
  top: 0,
  publishTime: '2026-10-02 09:00:00',
})

const page = (list: ArticleCardVO[]): PageResult<ArticleCardVO> => ({
  list,
  page: 1,
  size: 20,
  total: list.length,
  pages: list.length > 0 ? 1 : 0,
})

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <TechListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )

describe('TechListPage', () => {
  // ⚠️ 必须用大括号：`() => fetchArticles.mockReset()` 会把 mock 本身**当返回值**，
  // 而 vitest 把 beforeEach 的返回值当作 teardown 回调，于是每个用例结束后会
  // 「调用」一次 fetchArticles —— 用 mockRejectedValue 的那些用例会因此多出一个
  // 没人接的拒绝 promise，报的错还是原始 Error，看不出跟 beforeEach 有关系。
  beforeEach(() => {
    fetchArticles.mockReset()
  })

  it('每篇文章一张卡，且卡片指向详情路由', async () => {
    fetchArticles.mockResolvedValue(page([card('a', '第一篇'), card('b', '第二篇')]))
    renderPage()

    const link = await screen.findByRole('link', { name: /第一篇/ })
    expect(link).toHaveAttribute('href', '/tech/a')
    // 计数取自接口的 total，不是数据长度
    expect(screen.getByText(/共 2 篇/)).toBeInTheDocument()
  })

  it('接口失败时显示错误态与重试入口，而不是伪装成空态', async () => {
    fetchArticles.mockRejectedValue(new Error('后端没起来'))
    renderPage()

    const alert = await screen.findByRole('alert')
    // 说清发生了什么
    expect(alert).toHaveTextContent('文章列表暂时打不开')
    // 原因照旧给出（spec：错误态必须带失败原因）
    expect(alert).toHaveTextContent('后端没起来')
    // 给一条真能点的退路
    expect(screen.getByRole('button', { name: /再试一次/ })).toBeInTheDocument()
    expect(screen.queryByText(/还没有发布的文章/)).toBeNull()
  })

  it('错误态不说工程内部话：不出现「假数据」这类写给评审看的措辞', async () => {
    fetchArticles.mockRejectedValue(new TypeError('Failed to fetch'))
    renderPage()

    const alert = await screen.findByRole('alert')
    // 浏览器的原始英文不能端给访客
    expect(alert).not.toHaveTextContent('Failed to fetch')
    // 更不能把「不做假数据降级」这条工程约束念给访客听（2026-10-21 用户指出「太人机」）
    expect(alert).not.toHaveTextContent('假数据')
    expect(alert).toHaveTextContent('网络好像不通')
  })

  it('后端返回空列表时显示空态', async () => {
    fetchArticles.mockResolvedValue(page([]))
    renderPage()

    await waitFor(() => expect(screen.getByText(/还没有发布的文章/)).toBeInTheDocument())
  })

  it('按分类分组：同分类归到一组，组标题带篇数', async () => {
    fetchArticles.mockResolvedValue(
      page([
        card('a', '第一篇'),
        card('b', '第二篇'),
        { ...card('c', '第三篇'), categoryName: 'AI Agent', categorySlug: 'ai-agent' },
      ]),
    )
    renderPage()

    // 两个分组标题（层级为 h2，h1 只有一个留给页面标题）
    expect(await screen.findByRole('heading', { level: 2, name: /Java 后端/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /AI Agent/ })).toBeInTheDocument()
    // 三篇各一行，每行一个可点链接
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })
})
