import { Skeleton, SkeletonRegion } from '@/components/common/Skeleton'
import styles from './dashboard.module.css'

/**
 * 看板的三种骨架（第四期优化）。
 *
 * 尺寸全部贴着真实内容：指标卡的高度由同一套 `.kpi` 类撑出来，趋势图用
 * `aspect-ratio: 720 / 240` 与真实 SVG 的 viewBox 一致 —— 数据回来时是「填内容」，
 * 不是「版式重新排一遍」。
 */

/** 整页骨架：总览还没到时用（四张卡 + 趋势 + 两个榜单） */
export function DashboardSkeleton() {
  return (
    <SkeletonRegion label="正在加载站点数据">
      {/* 标题区**不占位**：页面里的 `.head`（标题 + 区间切换）是无条件渲染的，
          骨架里再来一份就会多出 60px，把下面的图往下推 —— 第一版就这么错了 */}
      <div className={styles.kpis}>
        {[0, 1, 2, 3].map((index) => (
          <div className={styles.kpi} key={index}>
            {/* 行高对齐实测值（label 19 / value 32 / note 37），换内容时下面的图不挪位 */}
            <div className={styles.kpiLabel} style={{ minHeight: 19 }}>
              <Skeleton width={64} height={12} radius={3} />
              <Skeleton width={52} height={11} radius={3} />
            </div>
            <Skeleton width={88} height={32} radius={5} />
            {/* 口径小字通常折两行（「按天去重的阅读数，同一人同一天只算一次」），
                这里就按两行占位 —— 差一行会让下面整块上下挪十几像素 */}
            <div className={styles.kpiNoteSkeleton}>
              <Skeleton height={14} radius={3} />
              <Skeleton height={14} radius={3} width="62%" />
            </div>
          </div>
        ))}
      </div>

      <section className={`${styles.panel} ${styles.trend}`}>
        <div className={styles.panelHead}>
          <Skeleton width={72} height={14} radius={4} />
          <Skeleton width={104} height={11} radius={3} />
        </div>
        <ChartSkeleton />
      </section>

      <div className={styles.columns}>
        {[0, 1].map((index) => (
          <section className={styles.panel} key={index}>
            <div className={styles.panelHead}>
              <Skeleton width={96} height={14} radius={4} />
              <Skeleton width={88} height={11} radius={3} />
            </div>
            <RankSkeleton />
          </section>
        ))}
      </div>
    </SkeletonRegion>
  )
}

/**
 * 趋势图骨架：比例与 TrendChart 的 720×240 一致，并叠四条横向参考线 ——
 * 一块纯灰方块看不出「这里要来的是图」，加了网格线之后一眼就知道是图表位。
 */
export function ChartSkeleton() {
  return (
    <div className={styles.chartWrap} aria-hidden="true">
      <Skeleton className={styles.chartSkeleton} radius={8} />
      <div className={styles.chartGrid}>
        {[0, 1, 2, 3].map((line) => (
          <span key={line} />
        ))}
      </div>
    </div>
  )
}

/** 榜单骨架：一行一条，末行短一截（跟真实榜单一样，不会排满整宽） */
export function RankSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className={styles.rankSkeleton} aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div className={styles.rankSkeletonRow} key={index}>
          <Skeleton width={14} height={11} radius={3} />
          <Skeleton height={12} radius={3} width={index === rows - 1 ? '58%' : '86%'} />
          <Skeleton width={38} height={11} radius={3} />
        </div>
      ))}
    </div>
  )
}
