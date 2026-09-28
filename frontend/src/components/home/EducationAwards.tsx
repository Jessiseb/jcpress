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
    <section className={`container section ${styles.section}`} aria-labelledby="edu-title">
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

      <ul className={styles.awards}>
        {awards.map((award, index) => (
          <li key={award.name} className={styles.award} data-reveal style={stagger(index + 3)}>
            <span className={styles.awardYear}>{award.year}</span>
            <span className={styles.awardName}>{award.name}</span>
            <span className={styles.awardLevel}>{award.level}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
