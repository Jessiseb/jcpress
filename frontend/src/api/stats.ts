import { request } from './client'
import type {
  ArticleStatsVO,
  HourStatsVO,
  PathStatsVO,
  StatsOverviewVO,
  VisitTrendVO,
} from './types'

/** 站点统计的四个查询（后台，需登录）+ 一条公开的采集上报 */

export const fetchStatsOverview = () => request<StatsOverviewVO>('/api/v1/admin/stats/overview', { auth: true })

export const fetchVisitTrend = (days: number) =>
  request<VisitTrendVO[]>('/api/v1/admin/stats/trend', { auth: true, query: { days } })

export const fetchArticleStats = (days: number, limit = 10) =>
  request<ArticleStatsVO[]>('/api/v1/admin/stats/articles', { auth: true, query: { days, limit } })

/** 访问时段：固定 24 条（0–23 点），没有数据的小时由后端补 0 */
export const fetchHourStats = (days: number) =>
  request<HourStatsVO[]>('/api/v1/admin/stats/hours', { auth: true, query: { days } })

export const fetchPathStats = (days: number, limit = 10) =>
  request<PathStatsVO[]>('/api/v1/admin/stats/paths', { auth: true, query: { days, limit } })

/**
 * 上报一次页面访问（公开接口，不带 token）。
 *
 * 三条纪律：
 * 1. **优先 `sendBeacon`** —— 它在页面卸载时也能把请求发完，且不占用主线程；
 *    路由跳转恰好是「上一个页面正在销毁」的时刻。
 * 2. **不重试、不看返回值** —— 统计少记一条是零损失，为此重试会白白多打后端。
 * 3. **绝不抛错** —— 调用方在渲染链路里，一个埋点失败不能冒泡成白屏。
 *
 * `Blob` 的 type 必须是 `application/json`：不写的话浏览器会按 text/plain 发，
 * 后端的 `@RequestBody` 直接 415。
 */
export function reportPageView(path: string): void {
  const body = JSON.stringify({ path })
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      if (navigator.sendBeacon('/api/v1/stats/pageview', blob)) {
        return
      }
    }
    void fetch('/api/v1/stats/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // 静默：埋点的失败不该出现在任何人的控制台里
    })
  } catch {
    // 同上：sendBeacon 在某些环境下会抛（隐私模式 / 跨域限制）
  }
}
