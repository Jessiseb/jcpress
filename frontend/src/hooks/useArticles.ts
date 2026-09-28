import { articleData, type ArticleVO } from '@/data/articles'

/**
 * 「技术分享」列表的唯一读取入口。
 *
 * 后端 `/api/v1/articles`（规划 §9.2）就绪后，把这里换成：
 *
 *   export function useArticles() {
 *     return useQuery({ queryKey: ['articles'], queryFn: fetchArticles })
 *   }
 *
 * 组件侧不需要任何改动 —— 与 `useProfile()` 同一套策略。
 */
export function useArticles(): ArticleVO[] {
  return articleData
}
