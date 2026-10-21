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

describe('MarkdownBody 的颜色 / 底色语法', () => {
  it('{红}…{/红} 渲染成带 data-jc-tone 的 span，定界符不留在页面上', () => {
    const { container } = render(<MarkdownBody markdown="这句里 {红}重点{/红} 是红的" />)

    const tone = container.querySelector('[data-jc-tone="red"]')
    expect(tone).not.toBeNull()
    expect(tone?.textContent).toBe('重点')
    expect(container.textContent).not.toContain('{红}')
  })

  it('{黄底}…{/黄底} 用 mark（语义就是标记），不是 span', () => {
    const { container } = render(<MarkdownBody markdown="这句里 {黄底}有底色{/黄底}" />)

    const mark = container.querySelector('mark[data-jc-bg="yellow"]')
    expect(mark?.textContent).toBe('有底色')
  })

  it('被行内元素隔开也能包住（{红} 里有 **加粗**）', () => {
    // mdast 里这一对标记落在两个 text 节点里，中间夹着 strong —— 只按单节点处理会漏
    const { container } = render(<MarkdownBody markdown="{红}前面**加粗**后面{/红}" />)

    const tone = container.querySelector('[data-jc-tone="red"]')
    expect(tone?.textContent).toBe('前面加粗后面')
    expect(tone?.querySelector('strong')?.textContent).toBe('加粗')
  })

  it('代码里的花括号是代码，不当格式', () => {
    const { container } = render(<MarkdownBody markdown={'`{红}x{/红}`\n\n```\n{红}y{/红}\n```'} />)

    expect(container.querySelector('[data-jc-tone]')).toBeNull()
    expect(container.textContent).toContain('{红}x{/红}')
  })

  it('没配对的标记原样留着，不吞正文', () => {
    const { container } = render(<MarkdownBody markdown="只有 {红}开头 没有收尾" />)

    expect(container.querySelector('[data-jc-tone]')).toBeNull()
    expect(container.textContent).toContain('{红}开头')
  })
})

describe('MarkdownBody 的源文行号（后台对齐滚动用）', () => {
  const SRC = `# 标题

第一段

## 小节

- 一
- 二
`

  it('不传 sourceLines 时一个 data-src-line 都不加（公开站不要这些属性）', () => {
    const { container } = render(<MarkdownBody markdown={SRC} />)
    expect(container.querySelector('[data-src-line]')).toBeNull()
  })

  it('传了就按顶层块标上行号，且行号递增', () => {
    const { container } = render(<MarkdownBody markdown={SRC} sourceLines />)

    const lines = Array.from(container.querySelectorAll<HTMLElement>('[data-src-line]')).map((el) =>
      Number(el.dataset.srcLine),
    )
    expect(lines.length).toBe(4) // h1 / p / h2 / ul
    expect(lines[0]).toBe(1)
    // h2 前面隔了两个空行，但断言的是「递增且覆盖到后面」，不锁死具体数字
    expect(lines).toEqual([...lines].sort((a, b) => a - b))
    expect(lines[3]).toBeGreaterThan(lines[2])
  })
})
