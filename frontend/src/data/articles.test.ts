import { describe, expect, it } from 'vitest'

import { articleData } from './articles'

describe('articleData', () => {
  it('每条都有 slug / 标题 / 摘要 / 分类 / 日期 / 阅读时长', () => {
    expect(articleData.length).toBeGreaterThan(0)

    articleData.forEach((a) => {
      expect(a.slug).toMatch(/^[a-z0-9-]+$/)
      expect(a.title.length).toBeGreaterThan(4)
      expect(a.summary.length).toBeLessThanOrEqual(120)
      expect(a.category.length).toBeGreaterThan(0)
      expect(a.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(a.readingMinutes).toBeGreaterThan(0)
    })
  })

  it('slug 唯一（列表 key 与将来的详情路由都依赖它）', () => {
    const slugs = articleData.map((a) => a.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('按发布日期倒序（最新在最前，页面不重新排序）', () => {
    const dates = articleData.map((a) => a.publishedAt)
    expect([...dates].sort().reverse()).toEqual(dates)
  })
})
