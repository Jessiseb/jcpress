import { useQuery } from '@tanstack/react-query'

import { fetchArticles } from '@/api/articles'

/** 首页「最新技术分享」区块用：只要最新的几篇 */
export function useLatestArticles(size = 3) {
  return useQuery({
    queryKey: ['articles', 'latest', size],
    queryFn: () => fetchArticles({ type: 'TECH', page: 1, size }),
  })
}
