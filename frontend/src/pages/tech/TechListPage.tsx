import { Link } from 'react-router-dom'

import { useArticles } from '@/hooks/useArticles'
import styles from './TechListPage.module.css'

/** 把 YYYY-MM-DD 显示成 YYYY.MM.DD（等宽字下点号比短横线更好对齐） */
function formatDate(value: string): string {
  return value.replace(/-/g, '.')
}

/**
 * 技术分享列表页（M3 的前端外壳）。
 *
 * 本期只做列表：详情页、Markdown 渲染、浏览量、分页都属 M3 剩余部分。
 * 因此列表项**不设链接** —— 没有详情页就跳过去只能是 404，不如先不给死链。
 */
export default function TechListPage() {
  const articles = useArticles()
  const latest = articles.reduce((max, a) => (a.publishedAt > max ? a.publishedAt : max), '')

  return (
    <section className={`container section ${styles.wrap}`} aria-labelledby="tech-title">
      <span className={styles.badge} data-ring="" aria-hidden="true" />

      <h1 id="tech-title" className={styles.title}>
        技术分享
      </h1>
      <p className={styles.lead}>把踩过的坑写清楚：Java 后端、AI Agent 工程、数据库与中间件。</p>

      {articles.length === 0 ? (
        <div className={styles.empty}>
          <p>列表接口还没接通，这一页暂时是空的。</p>
          <p className={styles.emptyHint}>
            先看首页的项目与实习经历 —— 那边已经把两个自研项目的取舍写得比较细。
          </p>
          <Link to="/" className={styles.back}>
            回到首页
          </Link>
        </div>
      ) : (
        <>
          <p className={styles.count}>
            共 {articles.length} 篇 · 更新至 {formatDate(latest)}
          </p>

          <div className={styles.table}>
            <div className={styles.head} aria-hidden="true">
              <span>日期</span>
              <span>标题</span>
              <span>分类</span>
              <span>阅读</span>
            </div>

            {articles.map((a) => (
              <div key={a.slug} className={styles.row}>
                <span className={styles.date}>{formatDate(a.publishedAt)}</span>
                <span className={styles.titleCell}>
                  <span className={styles.articleTitle}>{a.title}</span>
                  <span className={styles.tags}>{a.tags.join(' / ')}</span>
                </span>
                <span className={styles.category}>{a.category}</span>
                <span className={styles.reading}>{a.readingMinutes} 分钟</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
