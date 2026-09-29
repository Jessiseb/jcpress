import type { CSSProperties } from 'react'

import type { AwardVO, EducationVO } from '@/data/profile'
import styles from './EducationAwards.module.css'

interface Props {
  education: EducationVO
  awards: AwardVO[]
}

const stagger = (step: number) => ({ '--reveal-delay': `${step * 70}ms` }) as CSSProperties

export default function EducationAwards({ education, awards }: Props) {
  // 按年份分组（保持传入顺序：数据层已按年份倒序）
  const awardsByYear = awards.reduce<Record<string, AwardVO[]>>((acc, award) => {
    ;(acc[award.year] ??= []).push(award)
    return acc
  }, {})

  return (
    <section
      className="container section"
      aria-labelledby="edu-title"
      data-rhythm="major"
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

      {/* r2：奖项按年份分组 —— 年份当组头（展示衬线大字号），奖项在其下。
          这么改的直接原因：本期五项奖项年份全是 2025，逐行重复同一个年份既冗长、
          也把「2025 是丰收年」这个真正有信息量的事实埋掉了。
          年份仍与每条奖项同组可见，等级仍在每条上（spec 的「带年份与等级」不受影响）。 */}
      <div className={styles.awards}>
        {Object.entries(awardsByYear).map(([year, list], groupIndex) => (
          <section
            key={year}
            className={styles.yearGroup}
            data-reveal
            style={stagger(groupIndex + 3)}
          >
            <span className={styles.year} data-year="">
              {year}
            </span>
            <ul className={styles.yearAwards}>
              {list.map((award) => (
                <li key={award.name} className={styles.award} data-award="">
                  <span className={styles.awardName}>{award.name}</span>
                  <span className={styles.awardLevel}>{award.level}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  )
}
