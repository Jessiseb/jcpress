import { Link } from 'react-router-dom'

import type { ArticleCardVO } from '@/api/types'
import styles from './ArticleCard.module.css'

/** 把 `yyyy-MM-dd HH:mm:ss` 截成 `yyyy.MM.DD`（等宽字下点号比短横线好对齐） */
const formatDate = (value: string) => value.slice(0, 10).replace(/-/g, '.')

interface Props {
  article: ArticleCardVO
  /** 头版：通栏、封面横置、标题更大 */
  featured?: boolean
}

/**
 * 列表卡片：封面（无图时退化为字体封面）→ 分类胶囊 → 标题 → 摘要 → 档案行。
 *
 * 整张卡是一个 `<Link>`：点击面积即卡片面积（触摸目标远大于 44px）。
 * 无封面时用「品牌渐变 + 标题首字」而不是外部占位图 —— 不依赖网络，也不会闪。
 */
export default function ArticleCard({ article, featured = false }: Props) {
  return (
    <Link
      to={`/tech/${article.slug}`}
      className={`${styles.card} ${featured ? styles.featured : ''}`}
      data-card={article.slug}
    >
      <span className={styles.cover} aria-hidden="true">
        {article.coverUrl ? (
          <img src={article.coverUrl} alt="" loading="lazy" />
        ) : (
          <span className={styles.coverGlyph}>{article.title.slice(0, 1)}</span>
        )}
      </span>
      <span className={styles.body}>
        {article.categoryName && <span className={styles.category}>{article.categoryName}</span>}
        <span className={styles.title}>{article.title}</span>
        {article.summary && <span className={styles.summary}>{article.summary}</span>}
        <span className={styles.meta}>
          <span>{formatDate(article.publishTime)}</span>
          <span aria-hidden="true">·</span>
          <span>{article.readingMinutes} 分钟</span>
          {article.tags.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className={styles.tags}>{article.tags.map((tag) => tag.name).join(' / ')}</span>
            </>
          )}
        </span>
      </span>
    </Link>
  )
}
