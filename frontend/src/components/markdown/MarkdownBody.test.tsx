import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import MarkdownBody from './MarkdownBody'
import type { TocItem } from './rehypeCollectHeadings'

const SAMPLE = `## 第一节

正文里有 **加粗**、\`行内代码\` 与一个 [外链](https://sa-token.cc)。

### 子节

| 列 A | 列 B |
| --- | --- |
| 1 | 2 |

\`\`\`java
public class Demo {}
\`\`\`

> 引用
`

describe('MarkdownBody', () => {
  it('renders GFM tables inside a horizontal scroll container', () => {
    const { container } = render(<MarkdownBody markdown={SAMPLE} />)

    expect(screen.getByRole('table')).toBeInTheDocument()
    // 表格在窄屏会撑破版面，必须有自己的滚动容器
    expect(container.querySelector('table')?.parentElement?.className).toMatch(/tableWrap/)
  })

  it('exposes heading ids that match the collected TOC ids', () => {
    const collected: TocItem[] = []
    const { container } = render(
      <MarkdownBody markdown={SAMPLE} onHeadings={(items) => collected.push(...items)} />,
    )

    expect(collected.map((item) => item.text)).toEqual(['第一节', '子节'])
    expect(collected.map((item) => item.level)).toEqual([2, 3])
    // 目录里的锚点必须真的存在于 DOM —— 这就是把收集插件排在 rehype-slug 之后的原因
    collected.forEach((item) => {
      expect(container.querySelector(`#${CSS.escape(item.id)}`)).not.toBeNull()
    })
  })

  it('opens external links in a new tab with noreferrer', () => {
    render(<MarkdownBody markdown={SAMPLE} />)

    const link = screen.getByRole('link', { name: '外链' })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noreferrer')
  })

  it('highlights fenced code and offers a copy button', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    const { container } = render(<MarkdownBody markdown={SAMPLE} />)

    // rehype-highlight 会打上 hljs 类名
    expect(container.querySelector('code.hljs')).not.toBeNull()
    expect(container.querySelector('.hljs-keyword')).not.toBeNull()

    // 用 fireEvent 而不是 user-event：一次点击不值得为它新增一个开发依赖
    fireEvent.click(screen.getByRole('button', { name: '复制代码' }))

    expect(writeText).toHaveBeenCalledWith('public class Demo {}\n')
    expect(await screen.findByRole('button', { name: '已复制' })).toBeInTheDocument()
  })

  it('does not leak the react-markdown node prop onto the DOM', () => {
    const { container } = render(<MarkdownBody markdown={SAMPLE} />)

    expect(container.querySelector('pre')?.hasAttribute('node')).toBe(false)
  })
})
