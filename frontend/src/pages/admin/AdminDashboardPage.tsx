import { Alert, Button, Card, Col, Empty, Row, Segmented, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import type { ArticleStatsVO, PathStatsVO } from '@/api/types'
import TrendChart from '@/components/admin/TrendChart'
import { useArticleStats, usePathStats, useStatsOverview, useVisitTrend } from '@/hooks/useDashboardStats'
import { describeLoadError } from '@/utils/loadError'
import AdminLayout from './AdminLayout'
import styles from './dashboard.module.css'

/**
 * 站点数据看板（第四期，改用 Ant Design）。
 *
 * 三条口径写在界面上，不是藏在文档里 —— 数据页最容易出的问题是「数看着对，其实自己在骗自己」：
 * 1. 「今日」的数据最多滞后 5 分钟（服务端每 5 分钟回写一次）；
 * 2. 没有「7 日 UV」这个东西，所以界面上也不出现（每天的 UV 不能相加）；
 * 3. 文章维度是「按天去重的阅读数」，不是「被点开的次数」。
 *
 * **加载态不再是手写的灰块**：`Card loading` / `Table loading` 由组件库负责，
 * 卡片盒子与列宽本身不变，所以数据回来时是「填内容」而不是「换版式」。
 * （手写骨架的两次返工见 dev-journal 70.3 —— 那两次都是在跟真实行高对表。）
 */

const RANGES = [
  { label: '7 天', value: 7 },
  { label: '30 天', value: 30 },
  { label: '90 天', value: 90 },
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
  loading: boolean
}

function Kpi({ metric, label, value, unit, note, delta, loading }: KpiProps) {
  return (
    <Card size="small" loading={loading} className={styles.kpiCard} data-kpi={metric}>
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
    </Card>
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

  const articleColumns: ColumnsType<ArticleStatsVO> = [
    {
      title: '#',
      dataIndex: 'id',
      width: 44,
      render: (_value, _row, index) => <span className={styles.rankIndex}>{index + 1}</span>,
    },
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
      render: (_value, row) =>
        row.slug === null ? (
          <span className={styles.rankTitleMuted}>{row.title}</span>
        ) : (
          <Link to={`/admin/articles/${row.id}`}>{row.title}</Link>
        ),
    },
    { title: '期间', dataIndex: 'periodView', width: 76, align: 'right' },
    { title: '累计', dataIndex: 'totalView', width: 76, align: 'right' },
  ]

  const pathColumns: ColumnsType<PathStatsVO> = [
    { title: '路径', dataIndex: 'path', ellipsis: true },
    { title: '访问', dataIndex: 'pv', width: 72, align: 'right' },
  ]

  return (
    <AdminLayout>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>站点数据</h1>
          <p className={styles.subtitle}>访问量与文章阅读的每日汇总，用来回答「有人来吗、在看什么」。</p>
        </div>
        <Segmented
          value={days}
          onChange={(value) => setDays(Number(value))}
          options={RANGES}
          aria-label="统计区间"
        />
      </div>

      {overview.isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 14 }}
          message={`数据暂时打不开：${describeLoadError(overview.error)}`}
          action={
            <Button size="small" onClick={retryAll}>
              再试一次
            </Button>
          }
        />
      )}

      {/* `aria-busy`：antd 的 `Card loading` 只给视觉骨架，读屏需要这个标记才知道「还在加载」 */}
      <Row gutter={[14, 14]} aria-busy={overview.isPending}>
        <Col xs={24} sm={12} xl={6}>
          <Kpi
            metric="todayPv"
            label="今日访问"
            value={data?.todayPv ?? 0}
            unit="次"
            note="数据每 5 分钟更新一次"
            delta={data === undefined ? undefined : data.todayPv - data.yesterdayPv}
            loading={overview.isPending}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Kpi
            metric="todayUv"
            label="今日访客"
            value={data?.todayUv ?? 0}
            unit="人"
            note="同一访客一天只算一次"
            delta={data === undefined ? undefined : data.todayUv - data.yesterdayUv}
            loading={overview.isPending}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Kpi
            metric="last7Pv"
            label="近 7 日访问"
            value={data?.last7Pv ?? 0}
            unit="次"
            note="含今天在内共 7 天"
            loading={overview.isPending}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Kpi
            metric="totalView"
            label="累计阅读"
            value={data?.totalView ?? 0}
            unit="次"
            note="按天去重的阅读数，同一人同一天只算一次"
            loading={overview.isPending}
          />
        </Col>
      </Row>

      <Card
        size="small"
        title="访问趋势"
        extra={<span className={styles.panelHint}>近 {days} 天 · 悬停看某一天</span>}
        style={{ marginTop: 14 }}
        loading={trend.isPending}
      >
        {trend.isError ? (
          <Alert
            type="error"
            showIcon
            message={`趋势暂时打不开：${describeLoadError(trend.error)}`}
            action={
              <Button size="small" onClick={() => void trend.refetch()}>
                再试一次
              </Button>
            }
          />
        ) : (
          trend.data !== undefined && <TrendChart points={trend.data} />
        )}
      </Card>

      <Row gutter={[14, 14]} style={{ marginTop: 14 }}>
        <Col xs={24} xl={15}>
          <Card
            size="small"
            title="文章阅读排行"
            extra={<span className={styles.panelHint}>近 {days} 天 · 前 10 篇</span>}
          >
            {articles.isError ? (
              <Alert
                type="error"
                showIcon
                message={`排行了打不开：${describeLoadError(articles.error)}`}
                action={
                  <Button size="small" onClick={() => void articles.refetch()}>
                    再试一次
                  </Button>
                }
              />
            ) : (
              <Table<ArticleStatsVO>
                size="small"
                rowKey="id"
                loading={articles.isPending}
                columns={articleColumns}
                dataSource={articles.data ?? []}
                pagination={false}
                // 加载中不给空态文案：否则「正在取数」会被读成「一篇文章都没人看」
                locale={{
                  emptyText: articles.isPending ? (
                    ''
                  ) : (
                    <Empty description="这段时间还没有文章被打开过。" />
                  ),
                }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={9}>
          <Card
            size="small"
            title="热门页面"
            extra={<span className={styles.panelHint}>近 {days} 天 · 前 10 条</span>}
          >
            {paths.isError ? (
              <Alert
                type="error"
                showIcon
                message={`热门页面打不开：${describeLoadError(paths.error)}`}
                action={
                  <Button size="small" onClick={() => void paths.refetch()}>
                    再试一次
                  </Button>
                }
              />
            ) : (
              <Table<PathStatsVO>
                size="small"
                rowKey="path"
                loading={paths.isPending}
                columns={pathColumns}
                dataSource={paths.data ?? []}
                pagination={false}
                locale={{
                  emptyText: paths.isPending ? (
                    ''
                  ) : (
                    <Empty description="这段时间还没有页面访问记录。" />
                  ),
                }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {data !== undefined && (
        <p className={styles.footNote}>
          站内共有 {number(data.articleCount)} 篇内容，其中已发布 {number(data.publishedCount)} 篇。
          后台自身的访问不计入统计。
        </p>
      )}
    </AdminLayout>
  )
}
