import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  deleteAdminArticle,
  fetchAdminArticle,
  fetchAdminArticles,
  publishAdminArticle,
  saveAdminArticle,
  updateAdminArticle,
} from '@/api/admin'
import type { AdminArticleQuery, ArticleSavePayload } from '@/api/types'

/** 后台文章列表。query 变化即换 key，筛选/翻页自动重取。 */
export function useAdminArticles(query: AdminArticleQuery = {}) {
  return useQuery({
    queryKey: ['admin', 'articles', query],
    queryFn: () => fetchAdminArticles(query),
    // 列表页本身是「看一眼再进编辑」，切回来会重取；retry 关掉免得 401 反复重试
    retry: false,
  })
}

/** 单篇详情（编辑页）。`enabled` 让「新建」路由（id === 'new'）不发请求。 */
export function useAdminArticle(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'article', id],
    queryFn: () => fetchAdminArticle(id as string),
    enabled: id !== undefined && id !== 'new',
    retry: false,
  })
}

/**
 * 写操作统一失效 `['admin','articles']` 前缀（含所有分页/筛选组合）与公开站文章缓存 ——
 * 「后台保存后前台立刻可见」这条手工验收要的就是它。公开站的 key 前缀是 `['articles']`，
 * 与后台的 `['admin','articles']` 不同，所以两个前缀都要打。
 */
function useInvalidateArticles() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'articles'] })
    void queryClient.invalidateQueries({ queryKey: ['articles'] })
    void queryClient.invalidateQueries({ queryKey: ['article'] })
    void queryClient.invalidateQueries({ queryKey: ['latest-articles'] })
  }
}

/** 新建返回新 id（string），更新返回 void —— 统一成 `string | null` 供调用方判断。 */
export function useSaveAdminArticle() {
  const invalidate = useInvalidateArticles()
  return useMutation<string | null, Error, { id: string | null; payload: ArticleSavePayload }>({
    mutationFn: async ({ id, payload }) =>
      id ? ((await updateAdminArticle(id, payload)) ?? null) : await saveAdminArticle(payload),
    onSuccess: invalidate,
  })
}

export function usePublishAdminArticle() {
  const invalidate = useInvalidateArticles()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: number }) =>
      publishAdminArticle(id, status),
    onSuccess: invalidate,
  })
}

export function useDeleteAdminArticle() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateArticles()
  return useMutation({
    mutationFn: (id: string) => deleteAdminArticle(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: ['admin', 'article', id] })
      invalidate()
    },
  })
}
