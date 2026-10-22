import { Link } from 'react-router-dom'

import type { ArticleCardVO } from '@/api/types'
import { CATALOG_SIZE, useTechCatalog } from '@/hooks/useTechCatalog'
import { describeLoadError } from '@/utils/loadError'
import { TechListSkeleton } from '@/components/tech/ContentSkeleton'
import styles from './TechListPage.module.css'

const formatDate = (value: string) => value.slice(0, 10).replace(/-/g, '.')

/**
 * 一条目录项：缩略图 + 标题 + 摘要 + 档案行。
 *
 * 保留缩略图（而不是纯文字链接）有两个理由：① 封面是既有功能，纯文字会让它在列表里
 * 消失；② 一行里有个固定的方形锚点，扫读时眼睛有落点，比纯文字清单更容易"一眼不乱"。
 * 但它**不再是主角** —— 从原来通栏大图缩到 56px，视觉权重让给标题与分组。
 */
function ArticleRow({ article }: { article: ArticleCardVO }) {
  return (
    <Link
      to={`/tech/${article.slug}`}
      className={styles.row}
      data-card={article.slug}
      title={article.title}
    >
      <span className={styles.thumb} aria-hidden="true">
        {article.coverUrl ? (
          <img src={article.coverUrl} alt="" loading="lazy" />
        ) : (
          <span className={styles.coverGlyph}>{article.title.slice(0, 1)}</span>
        )}
      </span>

      <span className={styles.rowBody}>
        <span className={styles.rowTitle}>{article.title}</span>
        {article.summary && <span className={styles.rowSummary}>{article.summary}</span>}
      </span>

      <span className={styles.rowMeta}>
        <span>{formatDate(article.publishTime)}</span>
        <span>{article.readingMinutes} 分钟</span>
      </span>
    </Link>
  )
}

/**
 * 技术分享列表页（三期 → 2026-10-16 改成目录式索引）。
 *
 * 为什么不再用卡片墙：卡片墙每篇都自成一块，篇数一多就没有"整体"，只剩一堆平行的块；
 * 而参照站（文档站）的读法是**列表即目录** —— 一行一篇、按分类分组，一眼看完整区结构。
 *
 * 结构的担子整个压在这一页：外壳的左栏目录**只在详情页出现**（2026-10-16 用户定：
 * 「没有点击具体的文章的那个页面不需要有左侧」），所以这里不再有第二条清单
 * 在左边把同一份分组念一遍。
 *
 * 四种状态齐全，且**错误态不许伪装成空态** —— 接口挂了要明说，不能显示"还没有文章"
 * （Agent.md：依赖缺失应表现为失败，不得降级为假内容）。
 *
 * 2026-10-21：错误态的**文案重写**。原来那两句是
 * 「后端没起来或是接口出错 —— 这里不会拿假数据凑数。」——
 * 说的是工程约束（`Agent.md` 里的「不做假数据降级」），听的对象是代码评审，
 * 却被摆到了访客眼前：他不知道什么叫后端，也不关心你有没有兜底，
 * 他只知道「这里空了、还能不能看」。
 * 现在只说发生了什么 + 给一个真能点的重试；原因仍保留（spec 要求错误态带失败原因），
 * 但由 `describeLoadError` 统一翻译成人话，不再把原始英文或实现细节端出来。
 */
export default function TechListPage() {
  const { data, isPending, isError, error, refetch, isFetching } = useTechCatalog()
  const empty = !isPending && !isError && data.groups.length === 0

  return (
    <section className={styles.wrap} aria-labelledby="tech-title">
      <span className={styles.badge} data-ring="" aria-hidden="true" />

      <h1 id="tech-title" className={styles.title}>
        技术分享
      </h1>
      <p className={styles.lead}>把踩过的坑写清楚：Java 后端、AI Agent 工程、数据库与中间件。</p>

      {isPending && <TechListSkeleton />}

      {isError && (
        <div className={styles.empty} role="alert">
          <p className={styles.errorTitle}>文章列表暂时打不开</p>
          <p className={styles.emptyHint}>{describeLoadError(error)}</p>
          <div className={styles.actions}>
            <button
              type="button"
              className="btn btnSolid btnSm"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              {isFetching ? '正在重试…' : '再试一次'}
            </button>
            <Link to="/" className="btn btnGhost btnSm">
              回到首页
            </Link>
          </div>
        </div>
      )}

      {empty && (
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

      {!isPending && !isError && !empty && (
        <>
          <p className={styles.count}>
            共 {data.total} 篇 · 更新至 {formatDate(data.latest)}
          </p>

          <div className={styles.index}>
            {data.groups.map((group, index) => (
              <section key={group.name} className={styles.group} aria-labelledby={`tech-g-${index}`}>
                <h2 id={`tech-g-${index}`} className={styles.groupName}>
                  {group.name}
                  <span className={styles.groupCount}>{group.articles.length}</span>
                </h2>
                <ul className={styles.rows}>
                  {group.articles.map((article) => (
                    <li key={article.slug}>
                      <ArticleRow article={article} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {/* 一次只取 CATALOG_SIZE 篇（左栏要的是「一眼看得到整体」），超出的部分如实说一声。
              原文是「还有 N 篇 —— 分页与筛选留给下一期」：后半句是排期，不是访客要知道的事。 */}
          {data.total > CATALOG_SIZE && (
            <p className={styles.more}>还有 {data.total - CATALOG_SIZE} 篇没在这里列出。</p>
          )}
        </>
      )}
    </section>
  )
}
