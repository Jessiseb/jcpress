import { Tooltip } from 'antd'

import type { HourStatsVO } from '@/api/types'
import styles from './hourBars.module.css'

/**
 * 访问时段分布（24 根柱子）。
 *
 * 为什么手写而不是引图表库：这里要的是「24 个竖直矩形 + 悬停一个提示」，
 * antd 没有柱状图组件（`@ant-design/charts` 是独立包，为这点图形再加一百多 KB 不划算），
 * 而 24 个 div + `height: %` 已经是最短路径。
 *
 * 三条口径：
 * 1. **只显示次数（PV），不显示人数**：小时的独立访客逐小时相加会把人算 24 次；
 * 2. **0 次的小时也留 2px 的底**：完全空掉会让人以为这一格缺数据；
 * 3. **峰值那根实心**：回答「几点人最多」不用读数字。
 */
export default function HourBars({ points, days }: { points: HourStatsVO[]; days: number }) {
  const total = points.reduce((sum, point) => sum + point.pv, 0)

  if (total === 0) {
    return (
      <p className={styles.empty}>
        这几天还没有访问记录。
        <br />
        等有人打开页面，这里会按小时显示他们几点来的。
      </p>
    )
  }

  const max = points.reduce((peak, point) => Math.max(peak, point.pv), 0)
  // 用对象引用比较峰值：数值相等的小时有好几个，只高亮最靠前的那个
  const peak = points.find((point) => point.pv === max)

  return (
    <div className={styles.wrap}>
      <div
        className={styles.bars}
        role="img"
        aria-label={`近 ${days} 天访问时段分布，最忙的是 ${peak?.hour ?? 0} 点，共 ${max} 次`}
      >
        {points.map((point) => (
          <Tooltip
            key={point.hour}
            title={`${point.hour}:00–${point.hour}:59 · ${point.pv} 次`}
            mouseEnterDelay={0}
          >
            <div className={styles.col} data-hour={point.hour} data-pv={point.pv}>
              <span
                className={point === peak ? `${styles.bar} ${styles.barPeak}` : styles.bar}
                style={{ height: `${(point.pv / max) * 100}%` }}
              />
            </div>
          </Tooltip>
        ))}
      </div>

      <div className={styles.axis} aria-hidden="true">
        <span>0 点</span>
        <span>6 点</span>
        <span>12 点</span>
        <span>18 点</span>
        <span>23 点</span>
      </div>

      <p className={styles.summary}>
        近 {days} 天合计 {total} 次，最忙的是{' '}
        <span className={styles.peak}>{peak?.hour ?? 0}:00</span>（{max} 次）
      </p>
    </div>
  )
}
