import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'

import CodeBlock from './CodeBlock'
import { rehypeCollectHeadings, type TocItem } from './rehypeCollectHeadings'
import styles from './markdown.module.css'

interface Props {
  markdown: string
  /** 传了就顺带把标题收集出来给目录用（不传就不挂那个插件） */
  onHeadings?: (items: TocItem[]) => void
}

/**
 * 正文渲染：GFM（表格 / 任务列表 / 删除线）+ 标题锚点 + 代码高亮 + 复制按钮。
 *
 * 插件顺序有讲究：`rehypeSlug` 先加 id，`rehypeCollectHeadings` 之后才取得到 —— 反过来目录
 * 就会拿到一组不存在的锚点。
 */
export default function MarkdownBody({ markdown, onHeadings }: Props) {
  return (
    <div className={styles.prose}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeSlug,
          rehypeHighlight,
          ...(onHeadings ? [rehypeCollectHeadings(onHeadings)] : []),
        ]}
        components={{
          pre: CodeBlock,
          a: ({ children, ...props }) => (
            // 外链一律新窗口打开，并带上 noreferrer（防 target=_blank 的 window.opener 风险）
            <a {...props} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
          table: ({ children, ...props }) => (
            <div className={styles.tableWrap}>
              <table {...props}>{children}</table>
            </div>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
