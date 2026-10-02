import { Check, Copy } from 'lucide-react'
import { useState, type HTMLAttributes, type ReactNode } from 'react'

import styles from './markdown.module.css'

interface CodeBlockProps extends HTMLAttributes<HTMLPreElement> {
  /** react-markdown 会把它自己的 hast 节点透传进来；不能落到 DOM 上（会报未知属性） */
  node?: unknown
  children?: ReactNode
}

/**
 * 包住 `<pre>`：右上角复制按钮 + 横向滚动容器。
 *
 * 高亮由 `rehype-highlight` 完成，这里只做外壳 —— 所以按钮取文本时直接读 `<pre>` 的
 * textContent 就够了（不需要再解析一遍）。
 */
export default function CodeBlock({ node: _node, children, ...props }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const copy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    const pre = event.currentTarget.parentElement?.querySelector('pre')
    const text = pre?.textContent ?? ''
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className={styles.codeWrap}>
      <button
        type="button"
        className={styles.copyBtn}
        onClick={copy}
        aria-label={copied ? '已复制' : '复制代码'}
      >
        {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
        <span>{copied ? '已复制' : '复制'}</span>
      </button>
      <pre {...props}>{children}</pre>
    </div>
  )
}
