import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { reportArticleView } from '@/api/articles'
import MarkdownBody from '@/components/markdown/MarkdownBody'
import type { TocItem } from '@/components/markdown/rehypeCollectHeadings'
import { Skeleton, SkeletonRegion, SkeletonText } from '@/components/common/Skeleton'
import { usePublishPageToc } from '@/components/tech/pageTocContext'
import { useArticleDetail } from '@/hooks/useArticleDetail'
import { describeLoadError } from '@/utils/loadError'
// 文章页专用字体子集（GB2312 一级字，独立 family）。放在**详情页** import，
// Vite 会把它并进详情页 chunk —— 首页既不加载这份 CSS，也不下载那两个字体文件。
// @font-face 本身不触发下载，浏览器只在字形真正被用到时才取。
import '@/styles/fonts-article.css'
import styles from './ArticleDetailPage.module.css'

const formatDate = (value: string) => value.slice(0, 10).replace(/-/g, '.')

/**
 * 正文开头的一级标题若与文章标题**同名**，渲染时去掉一个。
 *
 * 页头已经渲染了一份 h1（`data.title`），而导入的 Markdown 往往自带 `# 标题`，
 * 两者叠在一起就是两个一模一样的大标题连着出现（截图确认过的真缺陷）。
 *
 * 两条边界：
 * - **只影响展示**：`data.contentMd` 原样不动 —— 保存接口、AI 排版、后台编辑器
 *   拿到的都还是带 h1 的原文，不会因为「页面上少了一行」而把正文改短；
 * - **只在同名时去掉**：标题不同说明正文自有主张（或内容写错了），此时宁可多留一个标题，
 *   也不要悄悄把一段有信息量的文字吞掉。
 */
const stripDuplicateTitle = (markdown: string, title: string) => {
  const head = markdown.match(/^\s*#\s+(.+?)\s*(?:\r?\n|$)/)
  if (!head) return markdown
  const simplify = (text: string) => text.replace(/\s+/g, '').replace(/[：:]/g, ':')
  return simplify(head[1]) === simplify(title) ? markdown.slice(head[0].length) : markdown
}

/**
 * 文章详情页（三期）。
 *
 * - 正文走 `MarkdownBody`（护眼档位在它的 CSS 里，本页只管版式与目录数据）；
 * - 小节清单交给外壳左栏渲染（2026-10-20 起正文右边不再单开目录栏，
 *   那 176px 还给了正文，见 `pageTocContext.ts`）；
 * - 上下篇来自详情响应**内联**的 prev/next，不再多打一次接口；
 * - 浏览量上报是幂等的（后端按 ip+ua 按天去重），失败不打扰读者、也不改页面。
 */
export default function ArticleDetailPage() {
  const { slug = '' } = useParams()
  const { data, isPending, isError, error, refetch } = useArticleDetail(slug)
  const [headings, setHeadings] = useState<TocItem[]>([])
  const publishPageToc = usePublishPageToc()

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
   *
   * 取不到正文时显式清空 —— 换文章的那一刻 `contentMd` 会先变 undefined，
   * 若此时留着上一篇的小节，左栏会有几十毫秒显示的是**别的文章**的目录。
   */
  useEffect(() => {
    const root = data?.contentMd ? document.querySelector('[data-article-body]') : null
    if (!root) {
      setHeadings([])
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
    publishPageToc?.(headings)
  }, [headings, publishPageToc])

  useEffect(() => {
    if (!data?.slug) return
    void reportArticleView(data.slug).catch(() => undefined)
  }, [data?.slug])

  if (isPending) {
    // 骨架而不是一行「正在加载…」：正文是长页面，先给出它的形状，读起来像「正在排版」。
    // 用 antd 的 Skeleton —— 详情页本来就是懒加载路由，antd 不会进首屏包。
    return (
      <article className={styles.wrap}>
        <SkeletonRegion label="正在加载文章" className={styles.skeleton}>
          <Skeleton width={78} height={11} radius={3} />
          <Skeleton width="86%" height={32} radius={6} />
          <Skeleton width="54%" height={32} radius={6} />
          <Skeleton width={240} height={12} radius={4} />
          <SkeletonText lines={4} lineHeight={15} gap={14} />
          <SkeletonText lines={5} lineHeight={15} gap={14} lastWidth="74%" />
          <SkeletonText lines={3} lineHeight={15} gap={14} lastWidth="42%" />
        </SkeletonRegion>
      </article>
    )
  }

  if (isError || !data) {
    return (
      <section className={styles.wrap} role="alert">
        <h1 className={styles.errorTitle}>这篇文章暂时打不开</h1>
        {/* 失败原因保留（spec：错误态要带原因），但由 describeLoadError 译成人话 ——
            原来直接把 `error.message` 印出来，断网时访客看到的是 Failed to fetch */}
        <p className={styles.state}>{describeLoadError(error)}</p>
        <div className={styles.errorActions}>
          <button type="button" className="btn btnSolid" onClick={() => void refetch()}>
            再试一次
          </button>
          <Link to="/tech" className="btn btnGhost">
            回到技术分享
          </Link>
        </div>
      </section>
    )
  }

  return (
    <article className={styles.wrap}>
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

      {/* 正文独占内容栏整条宽度：原来右边那 176px 的目录栏已经挪进左栏，
          正文的最大宽度也放开了（`--prose-measure: none` 在 .wrap 上）。 */}
      <div data-article-body>
        <MarkdownBody markdown={stripDuplicateTitle(data.contentMd, data.title)} />
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
