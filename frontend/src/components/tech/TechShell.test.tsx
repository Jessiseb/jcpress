/**
 * 外壳的单测：**左栏只在详情页挂**（2026-10-16 用户要求）。
 *
 * 这条断言值得写，是因为它守的是一个「少了一个元素」的行为 ——
 * 少掉的东西截图里看不出来（页面照样好看），只有等到某次重构把外壳改回
 * 「列表与详情共用同一条栏」，才会有人发现左栏又回来了。那时这里会红。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import TechShell from './TechShell'
import { usePublishPageToc } from './pageTocContext'

const fetchArticles = vi.fn()
vi.mock('@/api/articles', () => ({
  fetchArticles: (...args: unknown[]) => fetchArticles(...args),
}))

/** 假的详情页：只做一件事 —— 把两条小节推给外壳（真详情页从正文 DOM 里收集） */
const PublishFakeToc = () => {
  const publish = usePublishPageToc()
  useEffect(() => {
    publish?.([
      { id: 'sec-1', text: '第一节', level: 2 },
      { id: 'sec-1-1', text: '一小节', level: 3 },
    ])
  }, [publish])
  return <p>详情内容</p>
}

const renderAt = (path: string, detail: JSX.Element = <p>详情内容</p>) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/tech" element={<TechShell />}>
            <Route index element={<p>列表内容</p>} />
            <Route path=":slug" element={detail} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

describe('TechShell', () => {
  it('列表页不渲染左栏目录', () => {
    // 目录接口故意不给数据：即使请求成功，列表页也不该有这条栏
    fetchArticles.mockResolvedValue({ list: [], page: 1, size: 200, total: 0, pages: 0 })
    renderAt('/tech')

    expect(screen.getByText('列表内容')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: '技术分享目录' })).toBeNull()
  })

  it('详情页渲染左栏目录，并把当前篇标成当前页', async () => {
    fetchArticles.mockResolvedValue({
      list: [
        {
          id: 'a',
          title: '第一篇文章',
          slug: 'a',
          summary: '摘要',
          coverUrl: null,
          categoryName: 'Java 后端',
          categorySlug: 'java-backend',
          tags: [],
          readingMinutes: 7,
          viewCount: 3,
          top: 0,
          publishTime: '2026-10-02 09:00:00',
        },
      ],
      page: 1,
      size: 200,
      total: 1,
      pages: 1,
    })
    renderAt('/tech/a')

    const nav = await screen.findByRole('navigation', { name: '技术分享目录' })
    expect(nav).toBeInTheDocument()
    // slug 由路由解析（useMatch）而不是字符串切割：切错了这条就红
    expect(await screen.findByRole('link', { current: 'page' })).toHaveTextContent('第一篇文章')
    expect(screen.getByText('详情内容')).toBeInTheDocument()
  })

  /**
   * 外壳带 `data-page`，CSS 靠它给列表页较紧的顶部留白
   * （列表页标题上面压着一枚 64px 环 badge，同 padding 下会比详情页低 49px）。
   * 这个属性一旦丢了，留白覆盖就静默失效、页面又低回去 —— 单测看不出版式，但能守住这个钩子。
   */
  /**
   * 页内目录 2026-10-20 从正文右侧搬进左栏（用户第二次说「中间还是不够宽」）。
   * 这条守两件事：数据真的能上到外壳、并且落在左栏里面而不是正文区域内 ——
   * 后者是搬家的全部意义，一旦有人把 `<Toc>` 挪回 Outlet 里，宽度又会缩回去。
   */
  it('详情页把子级推上来的小节渲染成左栏的「本页目录」', async () => {
    fetchArticles.mockResolvedValue({ list: [], page: 1, size: 200, total: 0, pages: 0 })
    const { container } = renderAt('/tech/a', <PublishFakeToc />)

    const toc = await screen.findByRole('navigation', { name: '本页目录' })
    expect(toc).toHaveTextContent('第一节')
    expect(toc.closest('aside')).not.toBeNull()
    // 正文那一栏里不该再有目录
    expect(container.querySelector('[class*="content"] nav')).toBeNull()
  })

  it('外壳标注当前是列表页还是详情页', () => {
    fetchArticles.mockResolvedValue({ list: [], page: 1, size: 200, total: 0, pages: 0 })
    const { container: listShell } = renderAt('/tech')
    expect(listShell.firstElementChild).toHaveAttribute('data-page', 'list')

    const { container: detailShell } = renderAt('/tech/a')
    expect(detailShell.firstElementChild).toHaveAttribute('data-page', 'detail')
  })
})
