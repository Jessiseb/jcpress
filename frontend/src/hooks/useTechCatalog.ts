import { useQuery } from '@tanstack/react-query'

import { fetchArticles } from '@/api/articles'
import type { ArticleCardVO } from '@/api/types'

/**
 * 「技术分享」整段的一次性全量目录（左栏清单与列表页索引**共用同一份缓存**）。
 *
 * 为什么不分页：这是个人站的技术分享区，体量是「几十篇、每篇几千字」。一次取全
 * （200 条上限）换来左栏那句「一眼看得到整体结构」—— 这是 2026-10-16 引入左栏目录的
 * 全部理由。代价是一次几十 KB 的响应，比「每翻一页左栏就变一次」划算得多。
 * 真超过 200 篇再谈分页，届时列表页的那行提示会自己冒出来。
 */
export const CATALOG_SIZE = 200

export interface TechGroup {
  name: string
  articles: ArticleCardVO[]
}

export interface TechCatalog {
  groups: TechGroup[]
  total: number
  /** 最新一篇的发布时间，给列表页那行计数用 */
  latest: string
}

/**
 * 按分类分组，**保持接口给的顺序**（接口已按置顶 + 发布时间排好）。
 * 分类为空时归到「未分类」—— 分组标题不能是空白，否则左栏会出现一段无名的清单。
 */
const toCatalog = (list: ArticleCardVO[], total: number): TechCatalog => {
  const groups: TechGroup[] = []
  const byName = new Map<string, TechGroup>()

  for (const article of list) {
    const name = article.categoryName ?? '未分类'
    let group = byName.get(name)
    if (!group) {
      group = { name, articles: [] }
      byName.set(name, group)
      groups.push(group)
    }
    group.articles.push(article)
  }

  return {
    groups,
    total,
    latest: list.reduce((max, item) => (item.publishTime > max ? item.publishTime : max), ''),
  }
}

/** 侧栏与列表页共用的读取入口：同一个 queryKey，两处调用只会发一次请求 */
export function useTechCatalog() {
  return useQuery({
    queryKey: ['tech-catalog'],
    queryFn: () => fetchArticles({ type: 'TECH', page: 1, size: CATALOG_SIZE }),
    select: (page) => toCatalog(page.list, page.total),
  })
}
