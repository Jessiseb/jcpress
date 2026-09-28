import type { AwardVO, EducationVO } from '@/data/profile'
import styles from './EducationAwards.module.css'

interface Props {
  education: EducationVO
  awards: AwardVO[]
}

export default function EducationAwards({ education, awards }: Props) {
  return (
    <section className={`container section ${styles.section}`} aria-labelledby="edu-title">
      <h2 id="edu-title" className="sectionTitle">
        教育与荣誉
      </h2>
      <p className="sectionLead">专业排名前 3，五项国家级 / 省级竞赛奖项。</p>

      <article className={styles.eduCard}>
        <div className={styles.eduHead}>
          <div>
            <h3 className={styles.school}>{education.school}</h3>
            <p className={styles.major}>
              {education.major} · {education.degree}
            </p>
          </div>
          <div className={styles.eduMeta}>
            <span className={styles.period}>{education.period}</span>
            <span className={styles.rank}>{education.rank}</span>
          </div>
        </div>

        <ul className={styles.campus}>
          {education.campus.map((item) => (
            <li key={item} className={styles.campusItem}>
              {item}
            </li>
          ))}
        </ul>
      </article>

      <ul className={styles.awards}>
        {awards.map((award) => (
          <li key={award.name} className={styles.award}>
            <span className={styles.awardYear}>{award.year}</span>
            <span className={styles.awardName}>{award.name}</span>
            <span className={styles.awardLevel}>{award.level}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
