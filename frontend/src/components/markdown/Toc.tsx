import { useEffect, useState } from 'react'

import type { TocItem } from './rehypeCollectHeadings'
import styles from './toc.module.css'

/**
 * 页内目录：滚动联动高亮当前小节。
 *
 * 复用 `useActiveScene` 那套机制 —— 只观察「跨过视口中线」这一个事件，
 * 不新增滚动监听（页面全局已经有且只有一个滚动监听：`useScrollProgress`）。
 *
 * 组件只负责「列出来 + 高亮」，粘顶/滚动交给调用方（2026-10-20 之后它唯一的
 * 调用方是技术分享外壳的左栏，那条栏自己已经是 `position: sticky` 加内部滚动，
 * 这里再 sticky 一次会叠出两个滚动容器）。`title` 也是给调用方的 ——
 * 左栏顶部已经有一个「目录」按钮，同一个词在同一块区域出现两次会让人愣一下。
 */
export default function Toc({ items, title = '目录' }: { items: TocItem[]; title?: string }) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null)

  useEffect(() => {
    if (items.length === 0) return
    if (typeof IntersectionObserver === 'undefined') return

    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null)

    if (headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
        if (visible.length > 0) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    )

    headings.forEach((heading) => observer.observe(heading))
    return () => observer.disconnect()
  }, [items])

  if (items.length === 0) return null

  return (
    <nav className={styles.toc} aria-label={title}>
      <p className={styles.tocTitle}>{title}</p>
      <ul>
        {items.map((item) => (
          <li key={item.id} className={item.level === 3 ? styles.level3 : undefined}>
            <a
              href={`#${item.id}`}
              className={item.id === activeId ? styles.active : undefined}
              aria-current={item.id === activeId ? 'location' : undefined}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
