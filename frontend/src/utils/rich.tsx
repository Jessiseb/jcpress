import type { ReactNode } from 'react'

/**
 * 最小富文本渲染：只解析 `**加粗**`。
 *
 * 不用 markdown 全量解析器 —— 首页文案是受控常量，引入 `react-markdown`
 * 会为了一个语法背上整条渲染管线（YAGNI）。正文 Markdown 渲染在文章页做（M3）。
 */
export function renderRich(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    return <span key={index}>{part}</span>
  })
}
