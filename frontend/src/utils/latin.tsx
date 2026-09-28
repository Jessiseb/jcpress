import type { ReactNode } from 'react'

/**
 * 把字符串里的 Latin 词包成 `<em>`。
 *
 * 为什么只给 Latin：中文没有真斜体，浏览器会做机械倾斜（左右切变），在中文字形上非常廉价。
 * 「英文词斜体 + 降灰」是参照站的签名手法（见 docs/style-ref-aura.md §1），
 * 中文则始终正体。
 *
 * 切分规则：只匹配「以字母开头、后接字母或数字」的连续片段，且必须处在词首
 * （前一个字符不是字母或数字）—— 这样 `1200ms` 不会被切成 `1200` + `ms`。
 */
export function withLatinEmphasis(text: string): ReactNode[] {
  return text.split(/(?<![A-Za-z0-9])([A-Za-z][A-Za-z0-9]*)/g).map((part, index) => {
    if (/^[A-Za-z][A-Za-z0-9]*$/.test(part)) {
      return <em key={index}>{part}</em>
    }
    return <span key={index}>{part}</span>
  })
}
