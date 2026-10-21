import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'

import { useLatestArticles } from '@/hooks/useLatestArticles'
import { describeLoadError } from '@/utils/loadError'
import styles from './LatestArticles.module.css'

const stagger = (step: number) => ({ '--reveal-delay': `${step * 80}ms` }) as CSSProperties

const formatDate = (value: string) => value.slice(0, 10).replace(/-/g, '.')

/**
 * 首页「最新技术分享」区块（三期新增）。
 *
 * ⛔ **这里不用卡片。** `openspec/specs/homepage/spec.md` 有一条硬要求：首页只对
 *    「关键数字 / 项目经历 / 技术栈」三类区块用面板容器，其余区块保持通栏、
 *    不得用面板底色或投影。三期对卡片的破例**只给 `/tech` 与文章详情页**，
 *    首页这一块若也做成卡片，会同时违反 spec 与那条破例的边界。
 *    所以走**通栏紧凑列表**：每行 = 标题（左）+ 日期 · 阅读时长（右），
 *    行间靠间距分隔而不是色块。
 *
 * 三条「漏了就静默失效」的硬要求：
 *  1. 根节点必须带 `aria-labelledby` —— `useActiveScene` 的选择器是
 *     `main section[aria-labelledby]`，少了它这个区块**不会被算成一个 scene**，
 *     区块数仍是 7，后面所有停靠分析都建立在错误前提上；
 *  2. 根节点带 `data-block="latest-articles"` —— 行为断言靠它定位；
 *  3. 加载失败显示「没取回来」而不是空态 —— 错误不许伪装成没内容。
 *
 * 2026-10-21：错误文案重写。原来写的是「文章没取回来 —— 这里不会拿假数据凑数。」，
 * 那是把工程约束（不做假数据降级）念给访客听；现在只说没加载出来 + 给一次重试，
 * 原因交给 `describeLoadError` 说人话（详见该文件的注释）。
 */
export default function LatestArticles() {
  const { data, isPending, isError, error, refetch } = useLatestArticles(3)
  const articles = data?.list ?? []

  return (
    <section
      className="container section"
      aria-labelledby="latest-articles-title"
      data-rhythm="minor"
      data-block="latest-articles"
    >
      <h2 id="latest-articles-title" className="sectionTitle" data-reveal>
        最新技术分享
      </h2>
      <p className="sectionLead" data-reveal style={stagger(1)}>
        程序员的素养
      </p>

      {isPending && (
        <p className={styles.state} data-reveal style={stagger(2)}>
          正在加载…
        </p>
      )}

      {isError && (
        <div className={styles.state} role="alert" data-reveal style={stagger(2)}>
          <span>技术分享暂时没加载出来，{describeLoadError(error)}。</span>
          <button type="button" className={styles.retry} onClick={() => void refetch()}>
            再试一次
          </button>
        </div>
      )}

      {!isPending && !isError && articles.length === 0 && (
        <p className={styles.state} data-reveal style={stagger(2)}>
          还没有发布的文章，<Link to="/tech">去技术分享看看</Link>。
        </p>
      )}

      {articles.length > 0 && (
        <ul className={styles.list}>
          {articles.map((article, index) => (
            <li key={article.slug} data-reveal style={stagger(index + 2)}>
              <Link to={`/tech/${article.slug}`} className={styles.row}>
                <span className={styles.title}>{article.title}</span>
                <span className={styles.meta}>
                  {article.categoryName && (
                    <span className={styles.category}>{article.categoryName}</span>
                  )}
                  <span className={styles.date}>{formatDate(article.publishTime)}</span>
                  <span className={styles.reading}>{article.readingMinutes} 分钟</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {articles.length > 0 && (
        <p className={styles.more} data-reveal style={stagger(articles.length + 2)}>
          <Link to="/tech">查看全部技术分享 →</Link>
        </p>
      )}
    </section>
  )
}
