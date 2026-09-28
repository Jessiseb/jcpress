import { useCountUp, useInView } from '@/hooks/useCountUp'
import type { HighlightMetric } from '@/data/profile'
import styles from './HighlightStats.module.css'

interface Props {
  metrics: HighlightMetric[]
}

function MetricValue({ metric, active }: { metric: HighlightMetric; active: boolean }) {
  const isRange = metric.from !== undefined && metric.to !== undefined

  const from = useCountUp(metric.from ?? 0, active)
  const to = useCountUp(metric.to ?? metric.value ?? 0, active)

  if (isRange) {
    return (
      <span className={styles.value}>
        {from}
        <span className={styles.arrow}>→</span>
        {to}
        <span className={styles.suffix}>{metric.suffix}</span>
      </span>
    )
  }

  return (
    <span className={styles.value}>
      {to}
      <span className={styles.suffix}>{metric.suffix}</span>
    </span>
  )
}

/** 关键数字条：简历里最硬的 4 个量化结果。滚动进入视口时做一次 count-up。 */
export default function HighlightStats({ metrics }: Props) {
  const { ref, inView } = useInView<HTMLDivElement>()

  return (
    <section className={`container section ${styles.section}`} aria-labelledby="highlights-title">
      <h2 id="highlights-title" className="sectionTitle">
        拿得出手的数字
      </h2>
      <p className="sectionLead">四个来自真实生产环境的量化结果。</p>

      <div className={styles.grid} ref={ref}>
        {metrics.map((metric) => (
          <article key={metric.label} className={styles.card}>
            <MetricValue metric={metric} active={inView} />
            <h3 className={styles.label}>{metric.label}</h3>
            <p className={styles.caption}>{metric.caption}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
