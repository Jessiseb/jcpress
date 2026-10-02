import { useEffect, useState } from 'react'

import type { TocItem } from './rehypeCollectHeadings'
import styles from './toc.module.css'

/**
 * 右侧目录：滚动联动高亮当前小节。
 *
 * 复用 `useActiveScene` 那套机制 —— 只观察「跨过视口中线」这一个事件，
 * 不新增滚动监听（页面全局已经有且只有一个滚动监听：`useScrollProgress`）。
 *
 * 窄屏时由详情页用 `<details>` 包起来，本组件自身不关心断点。
 */
export default function Toc({ items }: { items: TocItem[] }) {
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
    <nav className={styles.toc} aria-label="文章目录">
      <p className={styles.tocTitle}>目录</p>
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
