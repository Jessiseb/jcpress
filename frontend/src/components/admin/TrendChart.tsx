import { useId, useMemo, useState } from 'react'

import type { VisitTrendVO } from '@/api/types'
import styles from './trendChart.module.css'

/**
 * 访问趋势图（手写 SVG，不引图表库 —— openspec design D-E）。
 *
 * 为什么不用 echarts / recharts：这里要画的就是两条 30 点的折线，而那两个库
 * 打包后 100–300KB，还自带一套主题系统 —— 颜色必须跟着后台的 `--adm-*` 走，
 * 手写 SVG 可以直接 `stroke="var(--adm-primary)"`，亮暗主题自动跟随。
 *
 * 几条刻意的取舍：
 * · **折线不插值平滑**：数据是逐日的，贝塞尔曲线会在空日附近画出「本该是 0 却有个小鼓包」的假象；
 * · **纵轴从 0 起**：截断纵轴会让 3 次和 5 次的差别看起来像翻倍；
 * · **全零时不出图**：一块空坐标系会让人以为图挂了，直接给一句人话。
 */

const VIEW_W = 720
const VIEW_H = 240
const PAD_LEFT = 40
const PAD_RIGHT = 14
const PAD_TOP = 18
const PAD_BOTTOM = 28
const PLOT_W = VIEW_W - PAD_LEFT - PAD_RIGHT
const PLOT_H = VIEW_H - PAD_TOP - PAD_BOTTOM

/** 纵轴上限取「好看的整数」，否则会出现 137 这种刻度 */
function niceMax(value: number): number {
  if (value <= 4) return 4
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return step * magnitude
}

function formatDay(date: string): string {
  // 后端给 yyyy-MM-dd；轴上只要 MM-DD
  return date.length === 10 ? date.slice(5) : date
}

export default function TrendChart({ points }: { points: VisitTrendVO[] }) {
  // useId 生成的 id 带冒号（`:r0:`），在 `url(#...)` 里能用但在 CSS 选择器里不能，
  // 去掉冒号省掉一类「开发能跑、生产改样式就断」的隐患
  const gradientId = `trend-${useId().replace(/:/g, '')}`
  const [active, setActive] = useState<number | null>(null)

  const totalPv = useMemo(() => points.reduce((sum, point) => sum + point.pv, 0), [points])
  const totalUv = useMemo(() => points.reduce((sum, point) => sum + point.uv, 0), [points])
  const firstActiveDay = useMemo(
    () => points.findIndex((point) => point.pv > 0 || point.uv > 0),
    [points],
  )

  if (points.length === 0) {
    return <p className={styles.empty}>还没有可展示的区间。</p>
  }

  if (totalPv === 0 && totalUv === 0) {
    return (
      <p className={styles.empty}>
        这几天还没有访问记录。
        <br />
        等有人打开站点的页面，这里就会开始有数 —— 数据每 5 分钟落一次。
      </p>
    )
  }

  const max = niceMax(
    points.reduce((peak, point) => Math.max(peak, point.pv, point.uv), 0),
  )
  const x = (index: number) =>
    points.length === 1 ? PAD_LEFT + PLOT_W / 2 : PAD_LEFT + (index / (points.length - 1)) * PLOT_W
  const y = (value: number) => PAD_TOP + PLOT_H * (1 - value / max)

  const linePath = (key: 'pv' | 'uv') =>
    points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)} ${y(point[key])}`).join(' ')

  const areaPath = `${linePath('pv')} L${x(points.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`

  // 纵向刻度：0 / 1/3 / 2/3 / 上限。三分比四分更容易落在整数上（上限一般能被 3 整除的不多，
  // 但取整后读起来仍然顺），且一共只有 4 条线，不会把图切成格子纸。
  const ticks = [0, 1, 2, 3].map((step) => Math.round((max / 3) * step))

  // 横轴标签最多 6 个：再多就会挤成一团，而精确日期靠悬停看
  const labelStep = Math.max(1, Math.ceil(points.length / 6))
  const labelIndexes = points
    .map((_, index) => index)
    .filter((index) => index % labelStep === 0 || index === points.length - 1)

  const activePoint = active === null ? null : points[active]

  const onMove = (event: React.MouseEvent<SVGRectElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0) return
    const ratio = (event.clientX - rect.left) / rect.width
    const index = Math.round(ratio * (points.length - 1))
    setActive(Math.min(Math.max(index, 0), points.length - 1))
  }

  const summary = `近 ${points.length} 天访问趋势：累计 PV ${totalPv}，累计 UV ${totalUv}`

  return (
    <div className={styles.wrap}>
      {activePoint !== null && (
        <div
          className={styles.tooltip}
          style={{ left: `${Math.min(94, Math.max(6, (x(active ?? 0) / VIEW_W) * 100))}%` }}
        >
          <span className={styles.tooltipDate}>{activePoint.date}</span>
          <span className={styles.tooltipValue}>
            <span>访问</span>
            <strong>{activePoint.pv}</strong>
          </span>
          <span className={styles.tooltipValue}>
            <span>访客</span>
            <strong>{activePoint.uv}</strong>
          </span>
        </div>
      )}

      <svg
        className={styles.svg}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label={summary}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--adm-primary)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--adm-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              className={styles.gridLine}
              x1={PAD_LEFT}
              y1={y(tick)}
              x2={PAD_LEFT + PLOT_W}
              y2={y(tick)}
            />
            <text className={styles.axisText} x={PAD_LEFT - 8} y={y(tick) + 4} textAnchor="end">
              {tick}
            </text>
          </g>
        ))}

        {labelIndexes.map((index) => (
          <text
            className={styles.axisText}
            key={points[index].date}
            x={x(index)}
            y={VIEW_H - 8}
            textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
          >
            {formatDay(points[index].date)}
          </text>
        ))}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path className={styles.pvLine} d={linePath('pv')} />
        <path className={styles.uvLine} d={linePath('uv')} />

        {active !== null && (
          <>
            <rect
              className={styles.hoverBand}
              x={x(active) - 1}
              y={PAD_TOP}
              width={2}
              height={PLOT_H}
            />
            <circle
              className={styles.hoverDot}
              cx={x(active)}
              cy={y(points[active].pv)}
              r={3.5}
              fill="var(--adm-primary)"
            />
            <circle
              className={styles.hoverDot}
              cx={x(active)}
              cy={y(points[active].uv)}
              r={3.5}
              fill="var(--adm-warning)"
            />
          </>
        )}

        {/* 覆盖整个绘图区的命中层：只在一个 rect 上监听，比给每个点挂事件稳 */}
        <rect
          x={PAD_LEFT}
          y={PAD_TOP}
          width={PLOT_W}
          height={PLOT_H}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={() => setActive(null)}
        />
      </svg>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.legendMark} ${styles.legendMarkPv}`} aria-hidden="true" />
          访问次数
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendMark} ${styles.legendMarkUv}`} aria-hidden="true" />
          独立访客
        </span>
      </div>

      {firstActiveDay > 0 && (
        <p className={styles.note}>
          从 {points[firstActiveDay].date} 开始有记录，之前的日期还没有统计数据。
        </p>
      )}
    </div>
  )
}
