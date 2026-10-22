import { useState } from 'react'
import { Link } from 'react-router-dom'

import TrendChart from '@/components/admin/TrendChart'
import { useArticleStats, usePathStats, useStatsOverview, useVisitTrend } from '@/hooks/useDashboardStats'
import { describeLoadError } from '@/utils/loadError'
import AdminLayout from './AdminLayout'
import adminStyles from './admin.module.css'
import styles from './dashboard.module.css'

/**
 * 站点数据看板（第四期）。
 *
 * 三条口径写在界面上，不是藏在文档里 —— 数据页最容易出的问题是「数看着对，其实自己在骗自己」：
 * 1. 「今日」的数据最多滞后 5 分钟（服务端每 5 分钟回写一次）；
 * 2. 没有「7 日 UV」这个东西，所以界面上也不出现（每天的 UV 不能相加）；
 * 3. 文章维度是「按天去重的阅读数」，不是「被点开的次数」。
 */

const RANGES = [
  { label: '7 天', days: 7 },
  { label: '30 天', days: 30 },
  { label: '90 天', days: 90 },
]

const number = (value: number) => value.toLocaleString('zh-CN')

interface KpiProps {
  /** 指标键：同时作为 `data-kpi`，让测试与排查都能精确指到某一张卡 */
  metric: string
  label: string
  value: number
  unit?: string
  note: string
  delta?: number
}

function Kpi({ metric, label, value, unit, note, delta }: KpiProps) {
  return (
    <div className={styles.kpi} data-kpi={metric}>
      <div className={styles.kpiLabel}>
        <span>{label}</span>
        {delta !== undefined && (
          <span
            className={`${styles.delta} ${delta > 0 ? styles.deltaUp : styles.deltaDown}`}
            aria-label={`较昨日${delta > 0 ? '增加' : delta < 0 ? '减少' : '持平'}`}
          >
            {delta > 0 ? `较昨日 +${number(delta)}` : delta < 0 ? `较昨日 ${number(delta)}` : '与昨日持平'}
          </span>
        )}
      </div>
      <div className={styles.kpiValue} data-kpi-value={metric}>
        {number(value)}
        {unit !== undefined && <span className={styles.kpiUnit}>{unit}</span>}
      </div>
      <p className={styles.kpiNote}>{note}</p>
    </div>
  )
}

export default function AdminDashboardPage() {
  const [days, setDays] = useState(30)

  const overview = useStatsOverview()
  const trend = useVisitTrend(days)
  const articles = useArticleStats(days)
  const paths = usePathStats(days)

  const retryAll = () => {
    void overview.refetch()
    void trend.refetch()
    void articles.refetch()
    void paths.refetch()
  }

  const data = overview.data
  const topArticleView = articles.data?.reduce((peak, item) => Math.max(peak, item.periodView), 0) ?? 0
  const topPathView = paths.data?.reduce((peak, item) => Math.max(peak, item.pv), 0) ?? 0

  return (
    <AdminLayout>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>站点数据</h1>
          <p className={styles.subtitle}>访问量与文章阅读的每日汇总，用来回答「有人来吗、在看什么」。</p>
        </div>
        <div className={styles.ranges} role="group" aria-label="统计区间">
          {RANGES.map((range) => (
            <button
              key={range.days}
              type="button"
              className={
                range.days === days ? `${styles.rangeBtn} ${styles.rangeBtnActive}` : styles.rangeBtn
              }
              aria-pressed={range.days === days}
              onClick={() => setDays(range.days)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {overview.isPending && <p className={styles.state}>正在加载…</p>}

      {overview.isError && (
        <div className={styles.stateError} role="alert">
          <span>数据暂时打不开：{describeLoadError(overview.error)}</span>
          <button className={adminStyles.btn} type="button" onClick={retryAll}>
            再试一次
          </button>
        </div>
      )}

      {data !== undefined && (
        <>
          <section className={styles.kpis} aria-label="关键指标">
            <Kpi
              metric="todayPv"
              label="今日访问"
              value={data.todayPv}
              unit="次"
              note="数据每 5 分钟更新一次"
              delta={data.todayPv - data.yesterdayPv}
            />
            <Kpi
              metric="todayUv"
              label="今日访客"
              value={data.todayUv}
              unit="人"
              note="同一访客一天只算一次"
              delta={data.todayUv - data.yesterdayUv}
            />
            <Kpi metric="last7Pv" label="近 7 日访问" value={data.last7Pv} unit="次" note="含今天在内共 7 天" />
            <Kpi
              metric="totalView"
              label="累计阅读"
              value={data.totalView}
              unit="次"
              note="按天去重的阅读数，同一人同一天只算一次"
            />
          </section>

          <section className={`${styles.panel} ${styles.trend}`} aria-label="访问趋势">
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>访问趋势</h2>
              <span className={styles.panelHint}>近 {days} 天 · 悬停看某一天</span>
            </div>
            {trend.isPending && <p className={styles.state}>正在加载…</p>}
            {trend.isError && (
              <div className={styles.stateError} role="alert">
                <span>趋势暂时打不开：{describeLoadError(trend.error)}</span>
                <button className={adminStyles.btn} type="button" onClick={() => void trend.refetch()}>
                  再试一次
                </button>
              </div>
            )}
            {trend.data !== undefined && <TrendChart points={trend.data} />}
          </section>

          <div className={styles.columns}>
            <section className={styles.panel} aria-label="文章阅读排行">
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>文章阅读排行</h2>
                <span className={styles.panelHint}>近 {days} 天 · 前 10 篇</span>
              </div>
              {articles.isPending && <p className={styles.state}>正在加载…</p>}
              {articles.isError && (
                <div className={styles.stateError} role="alert">
                  <span>排行了打不开：{describeLoadError(articles.error)}</span>
                  <button
                    className={adminStyles.btn}
                    type="button"
                    onClick={() => void articles.refetch()}
                  >
                    再试一次
                  </button>
                </div>
              )}
              {articles.data !== undefined && articles.data.length === 0 && (
                <p className={styles.emptyPanel}>这段时间还没有文章被打开过。</p>
              )}
              {articles.data !== undefined && articles.data.length > 0 && (
                <div className={styles.tableScroll}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">#</th>
                        <th scope="col">标题</th>
                        <th scope="col" className={styles.numCell}>
                          期间
                        </th>
                        <th scope="col" className={styles.numCell}>
                          累计
                        </th>
                        <th scope="col" className={styles.barCell} aria-label="相对比例" />
                      </tr>
                    </thead>
                    <tbody>
                      {articles.data.map((item, index) => {
                        const deleted = item.slug === null
                        return (
                          <tr key={item.id}>
                            <td className={styles.rankIndex}>{index + 1}</td>
                            <td>
                              {deleted ? (
                                <span className={`${styles.rankTitle} ${styles.rankTitleMuted}`}>
                                  {item.title}
                                </span>
                              ) : (
                                <Link className={styles.rankTitle} to={`/admin/articles/${item.id}`}>
                                  {item.title}
                                </Link>
                              )}
                            </td>
                            <td className={styles.numCell}>{number(item.periodView)}</td>
                            <td className={styles.numCell}>{number(item.totalView)}</td>
                            <td className={styles.barCell}>
                              <div className={styles.barTrack}>
                                <div
                                  className={styles.barFill}
                                  style={{ width: `${(item.periodView / Math.max(topArticleView, 1)) * 100}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className={styles.panel} aria-label="热门页面">
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>热门页面</h2>
                <span className={styles.panelHint}>近 {days} 天 · 前 10 条</span>
              </div>
              {paths.isPending && <p className={styles.state}>正在加载…</p>}
              {paths.isError && (
                <div className={styles.stateError} role="alert">
                  <span>热门页面打不开：{describeLoadError(paths.error)}</span>
                  <button
                    className={adminStyles.btn}
                    type="button"
                    onClick={() => void paths.refetch()}
                  >
                    再试一次
                  </button>
                </div>
              )}
              {paths.data !== undefined && paths.data.length === 0 && (
                <p className={styles.emptyPanel}>这段时间还没有页面访问记录。</p>
              )}
              {paths.data !== undefined && paths.data.length > 0 && (
                <ul className={styles.pathList}>
                  {paths.data.map((item) => (
                    <li className={styles.pathRow} key={item.path}>
                      <span className={styles.pathName} title={item.path}>
                        {item.path}
                      </span>
                      <span className={styles.pathValue}>{number(item.pv)}</span>
                      <span className={styles.pathTrack}>
                        <span
                          className={styles.pathFill}
                          style={{
                            display: 'block',
                            width: `${(item.pv / Math.max(topPathView, 1)) * 100}%`,
                          }}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <p className={styles.footNote}>
            站内共有 {number(data.articleCount)} 篇内容，其中已发布 {number(data.publishedCount)} 篇。
            后台自身的访问不计入统计。
          </p>
        </>
      )}
    </AdminLayout>
  )
}
