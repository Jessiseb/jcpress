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
 * 2026-09-28 二次修订：从「编辑式行列表」改成**四列数字块**（参照站的数据区形态）——
 * 用户明确要求「不要取舍，要有气场」，行列表太平。改动边界：
 *  - 仍然是 `<dl>` 语义（label 是 dt，数值与出处是 dd），测试与断言口径不变；
 *  - **没有卡片**：不着色、不描边、不投影，靠字号与留白分栏，避免退回看板感；
 *  - **仍然不做 count-up**（滚动数字是明确的 AI 味信号，上一轮已删，不恢复）。
 */
export default function HighlightStats({ metrics }: Props) {
  return (
    <section
      className="container section"
      aria-labelledby="highlights-title"
      data-rhythm="major"
      data-wide=""
    >
      <h2 id="highlights-title" className="sectionTitle" data-reveal>
        拿得出手的数字
      </h2>
      <p className="sectionLead" data-reveal style={stagger(1)}>
        四个来自真实生产环境的量化结果，每一项都能回指到具体项目与责任范围。
      </p>

      {/* data-glass + .panel：二期的「有限面板化」——只给这一类区块与项目经历用（#46 的修订）。
          面板本身不做入场：里面的四个 cell 各自有 data-reveal（嵌套 reveal 会出现父子双重淡入）。 */}
      <dl className={`panel ${styles.list}`} data-glass="">
        {metrics.map((metric, index) => (
          <div key={metric.label} className={styles.cell} data-reveal style={stagger(index + 2)}>
            <dt className={styles.label}>{metric.label}</dt>
            {/* data-display：标记「这一处是展示字」（二期）。
                700 档子集的字符表就是按这个标记 + h1/h2 收集的；
                frontend/scripts/audit-display-font.cjs 依赖它做覆盖断言。 */}
            <dd className={styles.value} data-display="">
              {formatValue(metric)}
            </dd>
            <dd className={styles.caption}>{metric.caption}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
