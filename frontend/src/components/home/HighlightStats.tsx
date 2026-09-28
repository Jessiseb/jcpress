import type { CSSProperties } from 'react'

import type { HighlightMetric } from '@/data/profile'
import styles from './HighlightStats.module.css'

interface Props {
  metrics: HighlightMetric[]
}

const stagger = (step: number) => ({ '--reveal-delay': `${step * 80}ms` }) as CSSProperties

/** 单值与区间两种形态统一成一行可读文本。 */
function formatValue(metric: HighlightMetric): string {
  if (metric.from !== undefined && metric.to !== undefined) {
    return `${metric.from}${metric.suffix} → ${metric.to}${metric.suffix}`
  }
  return `${metric.value ?? 0}${metric.suffix}`
}

/**
 * 简历里最硬的四个量化结果。
 *
 * 刻意不做「超大数字 + 数字滚动」—— 那是仪表盘的语汇，也是 AI 生成页面的标志性手法。
 * 这里改成编辑式列表：数值与正文同级字号，靠等宽数字和强调色对齐，信息密度高但不出声。
 */
export default function HighlightStats({ metrics }: Props) {
  return (
    <section className={`container section ${styles.section}`} aria-labelledby="highlights-title">
      <h2 id="highlights-title" className="sectionTitle" data-reveal>
        拿得出手的数字
      </h2>
      <p className="sectionLead" data-reveal style={stagger(1)}>
        四个来自真实生产环境的量化结果，每一项都能回指到具体项目与责任范围。
      </p>

      <dl className={styles.list}>
        {metrics.map((metric, index) => (
          <div key={metric.label} className={styles.row} data-reveal style={stagger(index + 2)}>
            <dt className={styles.label}>{metric.label}</dt>
            <dd className={styles.value}>{formatValue(metric)}</dd>
            <dd className={styles.caption}>{metric.caption}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
