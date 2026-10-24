import { useQuery } from '@tanstack/react-query'

import {
  fetchArticleStats,
  fetchHourStats,
  fetchPathStats,
  fetchStatsOverview,
  fetchVisitTrend,
} from '@/api/stats'

/**
 * 看板的四条数据。
 *
 * 共用 `['admin','stats',…]` 前缀，翻区间时四个 key 一起换 —— 趋势、排行、热门页面
 * 始终是同一个时间窗口（spec「切区间整体联动」）。
 *
 * `retry: false`：401 时重试只会把失效 token 多打几次；真正的重试交给页面上的按钮。
 */
const STALE_MS = 60_000

export function useStatsOverview() {
  return useQuery({
    queryKey: ['admin', 'stats', 'overview'],
    queryFn: fetchStatsOverview,
    // 服务端 5 分钟才回写一次，前端比它更勤地重取没有意义，只会多几条请求
    staleTime: STALE_MS,
    retry: false,
  })
}

export function useVisitTrend(days: number) {
  return useQuery({
    queryKey: ['admin', 'stats', 'trend', days],
    queryFn: () => fetchVisitTrend(days),
    staleTime: STALE_MS,
    retry: false,
  })
}

export function useHourStats(days: number) {
  return useQuery({
    queryKey: ['admin', 'stats', 'hours', days],
    queryFn: () => fetchHourStats(days),
    staleTime: STALE_MS,
    retry: false,
  })
}

export function useArticleStats(days: number, limit = 10) {
  return useQuery({
    queryKey: ['admin', 'stats', 'articles', days, limit],
    queryFn: () => fetchArticleStats(days, limit),
    staleTime: STALE_MS,
    retry: false,
  })
}

export function usePathStats(days: number, limit = 10) {
  return useQuery({
    queryKey: ['admin', 'stats', 'paths', days, limit],
    queryFn: () => fetchPathStats(days, limit),
    staleTime: STALE_MS,
    retry: false,
  })
}
