import { describe, expect, it } from 'vitest'

import { findExpansion, findRegressions, markdownStats, STAT_ITEMS } from './markdownStats'

describe('markdownStats', () => {
  it('数出标题、代码块、列表项与表格行', () => {
    const md = [
      '# 一级标题',
      '',
      '正文段落。',
      '',
      '## 二级标题',
      '',
      '- 第一项',
      '- 第二项',
      '1. 有序项',
      '',
      '```java',
      'int a = 1;',
      '```',
      '',
      '| a | b |',
      '| --- | --- |',
      '| 1 | 2 |',
    ].join('\n')

    const stats = markdownStats(md)
    expect(stats.headings).toBe(2)
    expect(stats.codeBlocks).toBe(1)
    expect(stats.listItems).toBe(3)
    // 表格三行都算
    expect(stats.tableRows).toBe(3)
  })

  it('图片不计入链接（图片语法同时匹配链接正则）', () => {
    const md = '![封面](/covers/a.jpg) 与 [链接](/tech/x)'
    const stats = markdownStats(md)
    expect(stats.images).toBe(1)
    expect(stats.links).toBe(1)
  })

  it('未闭合的围栏不产生代码块计数', () => {
    // 写到一半的围栏：三处 ``` 向下取整为 1 个代码块，不虚报成 2 个
    expect(markdownStats('```js\ncode\n```\n\n```js\n半截').codeBlocks).toBe(1)
  })

  it('空输入不抛错', () => {
    expect(markdownStats(null).chars).toBe(0)
    expect(markdownStats('').headings).toBe(0)
  })

  it('展示项覆盖全部计数键（除字符数外的回归判定依赖它）', () => {
    const keys = STAT_ITEMS.map((item) => item.key)
    expect(keys).toContain('headings')
    expect(keys).toContain('codeBlocks')
    expect(keys).toContain('links')
    expect(keys).toContain('images')
    expect(keys).toContain('tableRows')
    expect(keys).toContain('listItems')
  })
})

describe('findRegressions', () => {
  it('只报数量减少的项，不报增加或持平', () => {
    const before = markdownStats('# 标题\n\n[链接](/a)\n\n```\ncode\n```')
    // 少了一个链接、多了一个标题
    const after = markdownStats('# 标题\n\n## 又一个\n\n```\ncode\n```')

    const lost = findRegressions(before, after)
    expect(lost).toHaveLength(1)
    expect(lost[0].label).toBe('链接')
    expect(lost[0]).toMatchObject({ from: 1, to: 0 })
  })

  it('字符数不算内容凭证，减少也不报', () => {
    const before = markdownStats('标题\n\n正文正文正文')
    const after = markdownStats('标题\n正文')
    expect(findRegressions(before, after).some((item) => item.label === '字符数')).toBe(false)
  })

  it('纯格式调整（只压空行）不报回归', () => {
    const before = markdownStats('# 标题\n\n\n\n- a\n- b')
    const after = markdownStats('# 标题\n\n- a\n- b')
    expect(findRegressions(before, after)).toEqual([])
  })
})

describe('findExpansion', () => {
  it('补空格这类正常增幅（10% 内）不报', () => {
    const before = markdownStats('a'.repeat(1000))
    const after = markdownStats('a'.repeat(1080))
    expect(findExpansion(before, after)).toBeNull()
  })

  it('扩写 30% 时报出增长百分比', () => {
    const before = markdownStats('a'.repeat(1000))
    const after = markdownStats('a'.repeat(1300))
    expect(findExpansion(before, after)).toBe(30)
  })

  it('缩短不报（缩短由结构计数负责发现）', () => {
    const before = markdownStats('a'.repeat(1000))
    const after = markdownStats('a'.repeat(500))
    expect(findExpansion(before, after)).toBeNull()
  })

  it('原文为空时不报（没有基数可比）', () => {
    expect(findExpansion(markdownStats(''), markdownStats('a'.repeat(100)))).toBeNull()
  })
})
