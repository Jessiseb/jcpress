import type { ArticleCardVO, TagVO } from '@/api/types'
import type { TechCatalog, TechGroup } from '@/hooks/useTechCatalog'

/**
 * 技术分享的搜索（前端过滤，不发请求）。
 *
 * 为什么在客户端做：`useTechCatalog` 本来就把整份目录一次取全（上限 200 篇），
 * 左栏目录和列表页共用同一份缓存。再发一次搜索请求只会多一次往返，而且
 * 会让「左栏显示的篇数」和「列表显示的篇数」有机会对不上。
 *
 * 匹配规则（三条都做，任一命中即算）：
 * · 标题包含关键词；
 * · 标签名包含关键词；
 * · 标签 slug 包含关键词（`redis` 能搜到标签名叫「Redis 缓存」的那篇）。
 *
 * 全部忽略大小写与首尾空白 —— 用户不会关心「Redis」和「redis」的区别。
 */

export const normalizeKeyword = (raw: string): string => raw.trim().toLowerCase()

/** 单个标签是否命中关键词 */
export function isTagMatched(tag: TagVO, keyword: string): boolean {
  const query = normalizeKeyword(keyword)
  if (query === '') return false
  return tag.name.toLowerCase().includes(query) || tag.slug.toLowerCase().includes(query)
}

/** 一篇文章是否命中关键词（关键词为空时一律命中） */
export function isArticleMatched(article: ArticleCardVO, keyword: string): boolean {
  const query = normalizeKeyword(keyword)
  if (query === '') return true
  if (article.title.toLowerCase().includes(query)) return true
  return article.tags.some((tag) => isTagMatched(tag, query))
}

/**
 * 过滤整份目录。
 *
 * **空分类直接丢掉**：搜索时留下一串「分类标题下面一条都没有」，比不分组还乱。
 */
export function filterCatalog(catalog: TechCatalog, keyword: string): TechCatalog {
  const query = normalizeKeyword(keyword)
  if (query === '') return catalog

  const groups: TechGroup[] = catalog.groups
    .map((group) => ({
      ...group,
      articles: group.articles.filter((article) => isArticleMatched(article, query)),
    }))
    .filter((group) => group.articles.length > 0)

  const total = groups.reduce((sum, group) => sum + group.articles.length, 0)
  // latest 保持原样：它表达的是「最后一次更新」，与筛选无关
  return { ...catalog, groups, total }
}

/**
 * 详情页高亮用：这篇文章里与关键词命中的标签名。
 *
 * 为什么要「哪些标签命中」而不是「有没有命中」：一篇文章可能同时带
 * `Redis` 与 `缓存`，用户搜「缓存」时只有后者该亮。
 */
export function matchedTagKeys(tags: TagVO[], keyword: string): Set<string> {
  const matched = new Set<string>()
  for (const tag of tags) {
    if (isTagMatched(tag, keyword)) {
      matched.add(tag.slug)
    }
  }
  return matched
}
