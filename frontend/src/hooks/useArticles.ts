import { useQuery } from '@tanstack/react-query'

import { fetchArticles } from '@/api/articles'
import type { ArticleListQuery } from '@/api/types'

/**
 * 「技术分享」列表的唯一读取入口（三期：从 mock 常量换成真接口）。
 *
 * 组件侧零改动的承诺兑现了 —— 当初把数据放在常量里，就是为了这一刻换实现而不动组件。
 * 接口挂了就是错误态：**不做假数据降级**（Agent.md：依赖缺失应表现为失败）。
 */
export function useArticles(query: ArticleListQuery = {}) {
  return useQuery({
    queryKey: ['articles', query],
    queryFn: () => fetchArticles(query),
  })
}
