import { Link } from 'react-router-dom'

import type { ArticleCardVO } from '@/api/types'
import { useArticles } from '@/hooks/useArticles'
import { useSpotlight } from '@/hooks/useSpotlight'
import spot from '@/styles/spotlight.module.css'
import ArticleCard from './ArticleCard'
import styles from './TechListPage.module.css'

/** 一期就定下的页大小；超过一页时本期只提示，不做分页器（留给下一期） */
const PAGE_SIZE = 20

const formatDate = (value: string) => value.slice(0, 10).replace(/-/g, '.')

/**
 * 技术分享列表页（三期：卡片博客风）。
 *
 * 四种状态齐全，且**错误态不许伪装成空态** —— 接口挂了要明说，不能显示"还没有文章"
 * （Agent.md：依赖缺失应表现为失败，不得降级为假内容）。
 */
export default function TechListPage() {
  const { data, isPending, isError, error } = useArticles({
    type: 'TECH',
    page: 1,
    size: PAGE_SIZE,
  })
  const ref = useSpotlight<HTMLDivElement>()
  const articles: ArticleCardVO[] = data?.list ?? []
  const latest = articles.reduce((max, item) => (item.publishTime > max ? item.publishTime : max), '')

  return (
    <section className={`container section ${styles.wrap}`} aria-labelledby="tech-title">
      <span className={styles.badge} data-ring="" aria-hidden="true" />

      <h1 id="tech-title" className={styles.title}>
        技术分享
      </h1>
      <p className={styles.lead}>把踩过的坑写清楚：Java 后端、AI Agent 工程、数据库与中间件。</p>

      {isPending && <p className={styles.state}>正在取文章…</p>}

      {isError && (
        <div className={styles.empty} role="alert">
          <p>文章列表没取回来：{error instanceof Error ? error.message : '未知错误'}</p>
          <p className={styles.emptyHint}>后端没起来或是接口出错 —— 这里不会拿假数据凑数。</p>
        </div>
      )}

      {!isPending && !isError && articles.length === 0 && (
        <div className={styles.empty}>
          <p>还没有发布的文章。</p>
          <p className={styles.emptyHint}>
            去后台写第一篇，或先用导入器把 content/ 下的 Markdown 灌进来。
          </p>
          <Link to="/" className="btn btnSolid">
            回到首页
          </Link>
        </div>
      )}

      {articles.length > 0 && (
        <>
          <p className={styles.count}>
            共 {data?.total ?? articles.length} 篇 · 更新至 {formatDate(latest)}
          </p>

          <div ref={ref} className={`${spot.host} ${styles.grid}`}>
            {articles.map((article, index) => (
              <ArticleCard key={article.slug} article={article} featured={index === 0} />
            ))}
          </div>

          {(data?.total ?? 0) > PAGE_SIZE && (
            <p className={styles.more}>还有 {data!.total - PAGE_SIZE} 篇 —— 分页与筛选留给下一期。</p>
          )}
        </>
      )}
    </section>
  )
}
