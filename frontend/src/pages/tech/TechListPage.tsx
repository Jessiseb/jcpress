import { Empty, Input } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import type { ArticleCardVO } from '@/api/types'
import { Skeleton, SkeletonRegion } from '@/components/common/Skeleton'
import { CATALOG_SIZE, useTechCatalog } from '@/hooks/useTechCatalog'
import { describeLoadError } from '@/utils/loadError'
import { filterCatalog } from './articleSearch'
import styles from './TechListPage.module.css'

const formatDate = (value: string) => value.slice(0, 10).replace(/-/g, '.')

/**
 * 两个图标手写 SVG，不用 antd 的图标包：这一页的线条是 1px 发丝线，
 * antd 图标是 1024 画布实心描边，缩到 14px 会显得发糊。手写还能跟着 currentColor 变色。
 */
const SearchGlyph = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m20 20-4.8-4.8" />
  </svg>
)

const ClearGlyph = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

/**
 * 一条目录项：缩略图 + 标题 + 摘要 + 档案行。
 *
 * 保留缩略图（而不是纯文字链接）有两个理由：① 封面是既有功能，纯文字会让它在列表里
 * 消失；② 一行里有个固定的方形锚点，扫读时眼睛有落点，比纯文字清单更容易"一眼不乱"。
 * 但它**不再是主角** —— 从原来通栏大图缩到 56px，视觉权重让给标题与分组。
 */
function ArticleRow({ article, keyword }: { article: ArticleCardVO; keyword: string }) {
  // 把搜索词带进详情页：那边据此把命中的标签高亮（`?q=redis`）
  const to = keyword === '' ? `/tech/${article.slug}` : `/tech/${article.slug}?q=${encodeURIComponent(keyword)}`
  return (
    <Link
      to={to}
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

  // 关键词放在 URL 上（`/tech?q=redis`）：刷新、分享、从详情页的标签点回来都能还原，
  // 而且浏览器的前进后退天然可用。本地 state 只负责输入框的即时输入。
  const [params, setParams] = useSearchParams()
  const queryString = params.get('q') ?? ''
  const [keyword, setKeyword] = useState(queryString)

  // 外部改动 URL（浏览器后退、详情页标签链接）时同步输入框
  useEffect(() => {
    setKeyword(queryString)
  }, [queryString])

  const commitKeyword = (next: string) => {
    setKeyword(next)
    const trimmed = next.trim()
    const nextParams = new URLSearchParams(params)
    if (trimmed === '') {
      nextParams.delete('q')
    } else {
      nextParams.set('q', trimmed)
    }
    // replace：搜一次不该在历史里堆一条记录，否则后退要按很多下才出得去
    setParams(nextParams, { replace: true })
  }

  const filtered = useMemo(
    () => (data === undefined ? undefined : filterCatalog(data, keyword)),
    [data, keyword],
  )
  const searching = keyword.trim() !== ''
  const empty = !isPending && !isError && data.groups.length === 0
  const noMatch = !isPending && !isError && !empty && filtered !== undefined && filtered.total === 0

  // 计数文案在工具栏里（与搜索框同一行），所以先算出来。
  // 「匹配 0 篇」不显示：下面已经有专门的空态说这件事，两处同时说反而是噪音。
  const countLabel =
    filtered !== undefined && data !== undefined && filtered.total > 0
      ? `${searching ? `匹配 ${filtered.total} 篇 · ` : `共 ${data.total} 篇 · `}更新至 ${formatDate(data.latest)}`
      : null
  const showCount = countLabel !== null && !isError && !noMatch

  return (
    <section className={styles.wrap} aria-labelledby="tech-title">
      <span className={styles.badge} data-ring="" aria-hidden="true" />

      <h1 id="tech-title" className={styles.title}>
        技术分享
      </h1>
      <p className={styles.lead}>把踩过的坑写清楚：Java 后端、AI Agent 工程、数据库与中间件。</p>

      {/* 搜索栏：字段与计数同一行（计数右端与下方列表的日期列对齐）。
          不摆按钮 —— 输入即筛选，「搜索」这两个字点了也没有额外动作。
          外观不用 antd 的方框：站内这一页是衬线标题 + 发丝线目录，
          一个带圆角和蓝色描边的表单控件会显得是外挂上去的（样式见 .searchField）。 */}
      <div className={styles.toolbar}>
        <div className={styles.searchField}>
          <Input
            allowClear={{ clearIcon: <ClearGlyph /> }}
            variant="borderless"
            value={keyword}
            placeholder="搜标题或标签，例如 Redis"
            aria-label="搜索文章"
            prefix={
              <span className={styles.searchIcon} aria-hidden="true">
                <SearchGlyph />
              </span>
            }
            onChange={(event) => commitKeyword(event.target.value)}
            onKeyDown={(event) => {
              // 清空按钮用鼠标才点得到，键盘用户给一条 Esc
              if (event.key === 'Escape') {
                commitKeyword('')
              }
            }}
          />
        </div>

        {showCount && <p className={styles.count}>{countLabel}</p>}
      </div>

      {/* 加载态用 antd 的 Skeleton（这一页已改懒加载，antd 不会进首屏包）。
          chunk 还没到的那一段由 App 的 Suspense 兜底（零依赖 TechListSkeleton），
          两段都是灰块扫光，视觉上是连续的。 */}
      {isPending && (
        <SkeletonRegion label="正在加载文章列表" className={styles.skeletonList}>
          {[0, 1, 2].map((group) => (
            <div className={styles.skeletonGroup} key={group}>
              <Skeleton width={92} height={14} radius={4} />
              {[0, 1, 2].map((row) => (
                <div className={styles.skeletonRow} key={row}>
                  <Skeleton width={56} height={56} radius={12} />
                  <div className={styles.skeletonRowText}>
                    <Skeleton height={16} radius={4} width={row === 1 ? '62%' : '78%'} />
                    <Skeleton height={12} radius={4} width={row === 2 ? '48%' : '70%'} />
                  </div>
                  <Skeleton width={46} height={12} radius={4} />
                </div>
              ))}
            </div>
          ))}
        </SkeletonRegion>
      )}

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
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span className={styles.emptyText}>
                还没有发布的文章。
                <span className={styles.emptyHint}>
                  去后台写第一篇，或先用导入器把 content/ 下的 Markdown 灌进来。
                </span>
              </span>
            }
          />
          <Link to="/" className="btn btnSolid">
            回到首页
          </Link>
        </div>
      )}

      {noMatch && (
        <div className={styles.empty}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span className={styles.emptyText}>
                没有匹配「{keyword.trim()}」的文章。
                <span className={styles.emptyHint}>换个关键词，或清空搜索看全部。</span>
              </span>
            }
          />
          <button type="button" className="btn btnGhost" onClick={() => commitKeyword('')}>
            清空搜索
          </button>
        </div>
      )}

      {!isPending && !isError && !empty && !noMatch && filtered !== undefined && (
        <>
          <div className={styles.index}>
            {filtered.groups.map((group, index) => (
              <section key={group.name} className={styles.group} aria-labelledby={`tech-g-${index}`}>
                <h2 id={`tech-g-${index}`} className={styles.groupName}>
                  {group.name}
                  <span className={styles.groupCount}>{group.articles.length}</span>
                </h2>
                <ul className={styles.rows}>
                  {group.articles.map((article) => (
                    <li key={article.slug}>
                      <ArticleRow article={article} keyword={keyword.trim()} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {/* 一次只取 CATALOG_SIZE 篇（左栏要的是「一眼看得到整体」），超出的部分如实说一声。
              原文是「还有 N 篇 —— 分页与筛选留给下一期」：后半句是排期，不是访客要知道的事。 */}
          {!searching && data.total > CATALOG_SIZE && (
            <p className={styles.more}>还有 {data.total - CATALOG_SIZE} 篇没在这里列出。</p>
          )}
        </>
      )}
    </section>
  )
}
