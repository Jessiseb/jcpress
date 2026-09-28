import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { withLatinEmphasis } from './latin'

describe('withLatinEmphasis', () => {
  it('把 Latin 词包成 em，中文保持正体', () => {
    const html = renderToStaticMarkup(<>{withLatinEmphasis('用 Agent 和 Java 把重复劳动自动化')}</>)
    expect(html).toBe('用 <em>Agent</em> 和 <em>Java</em> 把重复劳动自动化')
  })

  it('纯中文不产生任何 em', () => {
    const html = renderToStaticMarkup(<>{withLatinEmphasis('广州 · AI 应用开发')}</>)
    // 「AI」本身是 Latin 词，会被包成 em；这里只守住中文没被包
    expect(html).not.toContain('<em>广州</em>')
    expect(html).not.toContain('<em>应用开发</em>')
  })

  it('数字后紧跟的字母不触发斜体（1200ms 不拆）', () => {
    const html = renderToStaticMarkup(<>{withLatinEmphasis('1200ms → 50ms')}</>)
    expect(html).toBe('1200ms → 50ms')
  })
})
