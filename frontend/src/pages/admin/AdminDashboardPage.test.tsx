import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import type { ArticleStatsVO, PathStatsVO, StatsOverviewVO, VisitTrendVO } from '@/api/types'
import AdminDashboardPage from './AdminDashboardPage'

const fetchStatsOverview = vi.fn()
const fetchVisitTrend = vi.fn()
const fetchArticleStats = vi.fn()
const fetchPathStats = vi.fn()

vi.mock('@/api/stats', () => ({
  fetchStatsOverview: () => fetchStatsOverview(),
  fetchVisitTrend: (days: number) => fetchVisitTrend(days),
  fetchArticleStats: (days: number, limit: number) => fetchArticleStats(days, limit),
  fetchPathStats: (days: number, limit: number) => fetchPathStats(days, limit),
  reportPageView: vi.fn(),
}))

// 看板包在 AdminLayout 里，布局要读一次登录态（顶栏头像）与 token
vi.mock('@/api/admin', () => ({
  fetchCurrentAdmin: vi.fn().mockResolvedValue({
    id: '1',
    username: 'admin',
    nickname: '管理员',
    role: 'ADMIN',
  }),
  adminLogin: vi.fn(),
  adminLogout: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  getToken: () => 'test-token',
  setToken: vi.fn(),
  clearToken: vi.fn(),
  ApiError: class MockApiError extends Error {
    readonly code: number
    readonly httpStatus: number
    constructor(code: number, message: string, httpStatus: number) {
      super(message)
      this.name = 'ApiError'
      this.code = code
      this.httpStatus = httpStatus
    }
  },
}))

const overview = (patch: Partial<StatsOverviewVO> = {}): StatsOverviewVO => ({
  todayPv: 12,
  todayUv: 5,
  yesterdayPv: 8,
  yesterdayUv: 6,
  last7Pv: 30,
  totalView: 99,
  articleCount: 7,
  publishedCount: 4,
  ...patch,
})

const trend: VisitTrendVO[] = [
  { date: '2026-10-20', pv: 5, uv: 2 },
  { date: '2026-10-21', pv: 7, uv: 3 },
]

const articleStats: ArticleStatsVO[] = [
  { id: '42', title: 'Redis 分布式锁', slug: 'redis-lock', periodView: 9, totalView: 30 },
]

const pathStats: PathStatsVO[] = [{ path: '/tech', pv: 11 }]

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <AdminDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    fetchStatsOverview.mockReset()
    fetchVisitTrend.mockReset()
    fetchArticleStats.mockReset()
    fetchPathStats.mockReset()

    fetchStatsOverview.mockResolvedValue(overview())
    fetchVisitTrend.mockResolvedValue(trend)
    fetchArticleStats.mockResolvedValue(articleStats)
    fetchPathStats.mockResolvedValue(pathStats)
  })

  it('四张指标卡都显示，并带上口径说明', async () => {
    renderPage()

    expect(await screen.findByText('今日访问')).toBeInTheDocument()

    // 按指标键取值，而不是 getByText('30') —— 30 这个数字在别处也会出现（排行里的累计阅读），
    // 全局文本查询会因为「命中多处」直接失败，那是在测噪音不是测页面
    const value = (metric: string) =>
      document.querySelector(`[data-kpi-value="${metric}"]`)?.textContent ?? ''
    expect(value('todayPv')).toBe('12次')
    expect(value('todayUv')).toBe('5人')
    expect(value('last7Pv')).toBe('30次')
    expect(value('totalView')).toBe('99次')

    // 口径必须看得见：这正是「数看着对其实在骗自己」最容易发生的地方
    expect(screen.getByText('数据每 5 分钟更新一次')).toBeInTheDocument()
    expect(screen.getByText(/按天去重的阅读数/)).toBeInTheDocument()
    // 不给「7 日 UV」这种把按日去重结果相加的数
    expect(screen.queryByText('近 7 日访客')).toBeNull()
  })

  it('排行能点进编辑页，热门页面有数', async () => {
    renderPage()

    const link = await screen.findByRole('link', { name: 'Redis 分布式锁' })
    expect(link).toHaveAttribute('href', '/admin/articles/42')
    expect(screen.getByText('/tech')).toBeInTheDocument()
  })

  it('接口失败时给出原因与重试，且不伪装成空态', async () => {
    fetchStatsOverview.mockRejectedValue(new ApiError(50000, '系统异常', 500))
    fetchArticleStats.mockRejectedValue(new ApiError(50000, '系统异常', 500))

    renderPage()

    expect(await screen.findByText(/数据暂时打不开/)).toBeInTheDocument()
    expect(screen.getByText(/服务没响应（HTTP 500）/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '再试一次' }).length).toBeGreaterThan(0)
    // 关键：失败不能被说成「还没有数据」
    expect(screen.queryByText('这段时间还没有文章被打开过。')).toBeNull()
  })

  it('区间内真的没有数据时给空态文案', async () => {
    fetchVisitTrend.mockResolvedValue([
      { date: '2026-10-20', pv: 0, uv: 0 },
      { date: '2026-10-21', pv: 0, uv: 0 },
    ])
    fetchArticleStats.mockResolvedValue([])
    fetchPathStats.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText(/这几天还没有访问记录/)).toBeInTheDocument()
    expect(screen.getByText('这段时间还没有文章被打开过。')).toBeInTheDocument()
    expect(screen.getByText('这段时间还没有页面访问记录。')).toBeInTheDocument()
  })

  it('总览还没回来时给骨架，不留「正在加载…」这种一行字', async () => {
    // 永不 resolve：模拟首屏刷新时接口尚未返回的那一段
    fetchStatsOverview.mockReturnValue(new Promise(() => {}))

    renderPage()

    const regions = await screen.findAllByRole('status')
    expect(regions.length).toBeGreaterThan(0)
    expect(screen.queryByText('正在加载…')).toBeNull()
    // 骨架块的存在感：至少四张指标卡 + 图表 + 两个榜单行
    expect(document.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(10)
  })
})
