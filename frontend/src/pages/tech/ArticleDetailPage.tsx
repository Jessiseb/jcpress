import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { reportArticleView } from '@/api/articles'
import MarkdownBody from '@/components/markdown/MarkdownBody'
import Toc from '@/components/markdown/Toc'
import type { TocItem } from '@/components/markdown/rehypeCollectHeadings'
import { useArticleDetail } from '@/hooks/useArticleDetail'
import styles from './ArticleDetailPage.module.css'

const formatDate = (value: string) => value.slice(0, 10).replace(/-/g, '.')

/**
 * 文章详情页（三期）。
 *
 * - 正文走 `MarkdownBody`（护眼档位在它的 CSS 里，本页只管版式与目录栏）；
 * - 上下篇来自详情响应**内联**的 prev/next，不再多打一次接口；
 * - 浏览量上报是幂等的（后端按 ip+ua 按天去重），失败不打扰读者、也不改页面。
 */
export default function ArticleDetailPage() {
  const { slug = '' } = useParams()
  const { data, isPending, isError, error } = useArticleDetail(slug)
  const [headings, setHeadings] = useState<TocItem[]>([])

  /**
   * 目录数据**在正文渲染完成之后**从 DOM 里读，而不是在渲染期由 rehype 插件回调塞进来。
   *
   * 为什么不用插件回调（试过，踩了两次坑）：
   * 1. `rehypeCollectHeadings` 是在 React 渲染期同步执行的，回调里 `setState`
   *    会让「渲染 → setState → 再渲染」自激，直接撞 React 的
   *    "Maximum update depth exceeded"，把整个页面打崩；
   * 2. 加「id 序列相同就不再 set」的守卫虽然能断掉循环，但渲染期的 setState
   *    会被 React 丢弃（StrictMode 下更明显）—— 结果是**目录永远为空**，
   *    而且不报错，是最难发现的那种失败。
   *
   * 从 DOM 读还有一个附带好处：id 由 rehype-slug 生成，读出来的锚点与正文**天然一致**，
   * 不存在两套 slug 规则漂移的问题。依赖 `data.contentMd`：正文换了才重收集。
   */
  useEffect(() => {
    if (!data?.contentMd) {
      return
    }
    const root = document.querySelector('[data-article-body]')
    if (!root) {
      return
    }
    const items: TocItem[] = Array.from(root.querySelectorAll('h2[id], h3[id]')).map((el) => ({
      id: el.id,
      text: el.textContent ?? '',
      level: el.tagName === 'H2' ? 2 : 3,
    }))
    setHeadings(items)
  }, [data?.contentMd])

  useEffect(() => {
    if (!data?.slug) return
    void reportArticleView(data.slug).catch(() => undefined)
  }, [data?.slug])

  if (isPending) {
    return (
      <section className="container section">
        <p className={styles.state}>正在取文章…</p>
      </section>
    )
  }

  if (isError || !data) {
    return (
      <section className="container section" role="alert">
        <h1 className={styles.errorTitle}>这篇文章没取回来</h1>
        <p className={styles.state}>{error instanceof Error ? error.message : '未知错误'}</p>
        <Link to="/tech" className="btn btnSolid">
          回到技术分享
        </Link>
      </section>
    )
  }

  return (
    <article className={`container section ${styles.wrap}`}>
      <header className={styles.header}>
        <p className={styles.breadcrumb}>
          <Link to="/tech">技术分享</Link>
        </p>
        <h1 className={styles.title}>{data.title}</h1>
        <p className={styles.meta}>
          {data.categoryName && <span className={styles.category}>{data.categoryName}</span>}
          <span>{formatDate(data.publishTime)}</span>
          <span aria-hidden="true">·</span>
          <span>{data.readingMinutes} 分钟</span>
          <span aria-hidden="true">·</span>
          <span>{data.viewCount} 次阅读</span>
          {data.tags.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>{data.tags.map((tag) => tag.name).join(' / ')}</span>
            </>
          )}
        </p>
      </header>

      <div className={styles.layout}>
        <div className={styles.main}>
          {/* 窄屏：目录折叠进正文顶部。桌面由 CSS 隐藏，改用右侧常驻栏 */}
          <details className={styles.mobileToc}>
            <summary>目录</summary>
            <Toc items={headings} />
          </details>
          <div data-article-body>
            <MarkdownBody markdown={data.contentMd} />
          </div>
        </div>
        <aside className={styles.aside}>
          <Toc items={headings} />
        </aside>
      </div>

      <nav className={styles.adjacent} aria-label="相邻文章">
        {data.prev ? (
          <Link to={`/tech/${data.prev.slug}`} className={styles.adjacentCard}>
            <span className={styles.adjacentLabel}>上一篇</span>
            <span className={styles.adjacentTitle}>{data.prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {data.next && (
          <Link
            to={`/tech/${data.next.slug}`}
            className={`${styles.adjacentCard} ${styles.adjacentNext}`}
          >
            <span className={styles.adjacentLabel}>下一篇</span>
            <span className={styles.adjacentTitle}>{data.next.title}</span>
          </Link>
        )}
      </nav>

      <p className={styles.back}>
        <Link to="/tech">← 回到技术分享</Link>
      </p>
    </article>
  )
}
