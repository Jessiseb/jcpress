import type { CSSProperties } from 'react'

import type { AwardVO, EducationVO } from '@/data/profile'
import styles from './EducationAwards.module.css'

interface Props {
  education: EducationVO
  awards: AwardVO[]
}

const stagger = (step: number) => ({ '--reveal-delay': `${step * 70}ms` }) as CSSProperties

export default function EducationAwards({ education, awards }: Props) {
  return (
    <section
      className="container section"
      aria-labelledby="edu-title"
      data-rhythm="minor"
    >
      <h2 id="edu-title" className="sectionTitle" data-reveal>
        教育与荣誉
      </h2>
      <p className="sectionLead" data-reveal style={stagger(1)}>
        在校期间的专业排名与五项国家级 / 省级竞赛奖项。
      </p>

      <article className={styles.edu} data-reveal style={stagger(2)}>
        <h3 className={styles.school}>{education.school}</h3>
        <p className={styles.major}>
          {education.major} · {education.degree}
        </p>
        <p className={styles.meta}>
          {education.period} · {education.rank}
        </p>
        <ul className={styles.campus}>
          {education.campus.map((item) => (
            <li key={item} className={styles.campusItem}>
              {item}
            </li>
          ))}
        </ul>
      </article>

      {/* r3：奖项从「年份分组」改成**逐条时间线**。
          r2 的年份组头把五项同为 2025 的奖项压成一个组，扫读时看不出「一共拿了几个」；
          现在每条一节点：左列右对齐放元数据（年份加粗 / 等级灰色小字），
          中列是轴线与空心圆点，右列放奖项名。年份与等级仍与每条奖项同组可见。
          这条改动**覆盖** r2 的「年份字号大于奖项名」判据 ——
          `openspec/specs/homepage/spec.md` 与 `.tmp/tools/audit-behavior.cjs` 已同步改写。 */}
      <ol className={styles.timeline}>
        {awards.map((award, index) => (
          <li
            key={award.name}
            className={styles.award}
            data-award=""
            data-reveal
            style={stagger(index + 3)}
          >
            <div className={styles.stamp}>
              <span className={styles.awardYear} data-year="">
                {award.year}
              </span>
              <span className={styles.awardLevel}>{award.level}</span>
            </div>

            {/* 圆点由 CSS 画：轴线在 --node-x，节点列中心与之重合 */}
            <span className={styles.node} aria-hidden="true" />

            <span className={styles.awardName} data-award-name="">
              {award.name}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
