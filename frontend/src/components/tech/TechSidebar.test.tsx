/**
 * 左栏目录的单测：分组渲染、当前项高亮。
 *
 * 「当前项高亮」是这条栏存在的意义（位置感），所以它必须有断言守着 ——
 * 光靠肉眼看截图证明不了「恰好只有一项被标成当前」。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ArticleCardVO, PageResult } from '@/api/types'
import TechSidebar from './TechSidebar'

const fetchArticles = vi.fn()
vi.mock('@/api/articles', () => ({
  fetchArticles: (...args: unknown[]) => fetchArticles(...args),
}))

const card = (slug: string, title: string, categoryName = 'Java 后端'): ArticleCardVO => ({
  id: slug,
  title,
  slug,
  summary: '摘要',
  coverUrl: null,
  categoryName,
  categorySlug: 'x',
  tags: [],
  readingMinutes: 7,
  viewCount: 3,
  top: 0,
  publishTime: '2026-10-02 09:00:00',
})

const page = (list: ArticleCardVO[]): PageResult<ArticleCardVO> => ({
  list,
  page: 1,
  size: 200,
  total: list.length,
  pages: 1,
})

const renderRail = (activeSlug: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <TechSidebar activeSlug={activeSlug} />
      </MemoryRouter>
    </QueryClientProvider>,
  )

describe('TechSidebar', () => {
  // ⚠️ 必须用大括号：`() => fetchArticles.mockReset()` 会把 mock 本身**当返回值**，
  // 而 vitest 把 beforeEach 的返回值当作 teardown 回调，于是每个用例结束后会
  // 「调用」一次 fetchArticles —— 用 mockRejectedValue 的那些用例会因此多出一个
  // 没人接的拒绝 promise，报的错还是原始 Error，看不出跟 beforeEach 有关系。
  beforeEach(() => {
    fetchArticles.mockReset()
  })

  it('按分类分组列出全部文章', async () => {
    fetchArticles.mockResolvedValue(
      page([card('a', '第一篇'), card('b', '第二篇'), card('c', '第三篇', 'AI Agent')]),
    )
    renderRail('a')

    // 注意：nav 在数据到达前就已渲染（里面有 loading 文案），所以这里必须用 findBy*
    // 等数据 —— 用 getByText 会抢在请求完成之前跑，看起来像"分组没渲染"。
    expect(await screen.findByRole('navigation', { name: '技术分享目录' })).toBeInTheDocument()
    expect(await screen.findByText('Java 后端')).toBeInTheDocument()
    expect(screen.getByText('AI Agent')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '第二篇' })).toHaveAttribute('href', '/tech/b')
  })

  it('当前文章恰好一项被标记为当前页', async () => {
    fetchArticles.mockResolvedValue(page([card('a', '第一篇'), card('b', '第二篇')]))
    renderRail('b')

    const current = await screen.findAllByRole('link', { current: 'page' })
    await waitFor(() => expect(current).toHaveLength(1))
    expect(current[0]).toHaveTextContent('第二篇')
  })

  it('「全部文章」不是当前项 —— 它只是返回列表的入口', async () => {
    fetchArticles.mockResolvedValue(page([card('a', '第一篇')]))
    renderRail('a')

    await screen.findByRole('link', { name: '第一篇' })
    // 列表页已经不挂这条栏，「全部文章」不再有自己的当前态；
    // 若它被标成 current，进文章后会出现两个「你在这里」
    expect(screen.getByRole('link', { name: /全部文章/ })).not.toHaveAttribute('aria-current')
    const current = screen.getAllByRole('link', { current: 'page' })
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent('第一篇')
  })
})
