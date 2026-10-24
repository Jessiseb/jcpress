import { describe, expect, it } from 'vitest'

import type { ArticleCardVO, TagVO } from '@/api/types'
import type { TechCatalog } from '@/hooks/useTechCatalog'
import { filterCatalog, isArticleMatched, isTagMatched, matchedTagKeys, normalizeKeyword } from './articleSearch'

const tag = (name: string, slug: string): TagVO => ({ name, slug })

const article = (slug: string, title: string, tags: TagVO[]): ArticleCardVO => ({
  id: slug,
  title,
  slug,
  summary: null,
  coverUrl: null,
  categoryName: 'Java 后端',
  categorySlug: 'java-backend',
  tags,
  readingMinutes: 5,
  viewCount: 1,
  top: 0,
  publishTime: '2026-10-20 09:00:00',
})

const catalog: TechCatalog = {
  total: 3,
  latest: '2026-10-20 09:00:00',
  groups: [
    {
      name: 'Java 后端',
      articles: [
        article('lock', 'Redis 分布式锁的三个坑', [tag('Redis', 'redis')]),
        article('layers', 'Spring Boot 分层到底分什么', [tag('架构', 'architecture')]),
      ],
    },
    {
      name: 'AI 工程',
      articles: [article('rag', 'RAG 里的召回率', [tag('检索', 'retrieval'), tag('Redis', 'redis')])],
    },
  ],
}

describe('articleSearch', () => {
  it('关键词去掉首尾空白并忽略大小写', () => {
    expect(normalizeKeyword('  ReDiS ')).toBe('redis')
  })

  it('按标题命中', () => {
    expect(isArticleMatched(catalog.groups[0].articles[1], '分层')).toBe(true)
  })

  it('按标签名命中，也按标签 slug 命中', () => {
    const redisArticle = catalog.groups[0].articles[0]
    expect(isArticleMatched(redisArticle, 'redis')).toBe(true)
    expect(isTagMatched(tag('Redis 缓存', 'redis-cache'), 'redis')).toBe(true)
  })

  it('关键词为空时一律命中', () => {
    expect(isArticleMatched(catalog.groups[0].articles[1], '   ')).toBe(true)
  })

  it('过滤后丢掉空分类，并把 total 改成匹配数', () => {
    const result = filterCatalog(catalog, 'redis')

    expect(result.groups.map((group) => group.name)).toEqual(['Java 后端', 'AI 工程'])
    expect(result.total).toBe(2)
    // latest 不参与筛选，保持原值
    expect(result.latest).toBe(catalog.latest)
  })

  it('某分类全不命中时整组消失', () => {
    const result = filterCatalog(catalog, 'redis')

    expect(result.groups.every((group) => group.articles.length > 0)).toBe(true)
    expect(filterCatalog(catalog, '架构').groups.map((group) => group.name)).toEqual(['Java 后端'])
  })

  it('高亮只挑命中的标签，不是整篇文章的标签', () => {
    const rag = catalog.groups[1].articles[0]

    expect([...matchedTagKeys(rag.tags, 'Redis')]).toEqual(['redis'])
    // 搜「检索」时命中另一个标签，Redis 不该亮
    expect([...matchedTagKeys(rag.tags, '检索')]).toEqual(['retrieval'])
    expect([...matchedTagKeys(rag.tags, '')]).toEqual([])
  })
})
