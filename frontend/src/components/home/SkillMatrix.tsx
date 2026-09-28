import type { SkillGroupVO } from '@/data/profile'
import styles from './SkillMatrix.module.css'

interface Props {
  groups: SkillGroupVO[]
}

/** 熟练度点阵：level 1-5，实心点数量即熟练度。 */
function LevelDots({ level }: { level: number }) {
  return (
    <span className={styles.dots} aria-label={`熟练度 ${level} / 5`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <span key={step} className={step <= level ? styles.dotOn : styles.dot} />
      ))}
    </span>
  )
}

export default function SkillMatrix({ groups }: Props) {
  return (
    <section className={`container section ${styles.section}`} aria-labelledby="skills-title">
      <h2 id="skills-title" className="sectionTitle">
        技术栈
      </h2>
      <p className="sectionLead">熟悉 / 掌握 / 了解三档，按简历原文标注，不夸大。</p>

      <div className={styles.grid}>
        {groups.map((group) => (
          <article key={group.category} className={styles.card}>
            <h3 className={styles.groupTitle}>{group.category}</h3>
            <ul className={styles.items}>
              {group.items.map((item) => (
                <li key={item.name} className={styles.item}>
                  <span className={styles.itemName}>{item.name}</span>
                  <LevelDots level={item.level} />
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}
