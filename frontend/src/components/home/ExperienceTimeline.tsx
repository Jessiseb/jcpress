import type { ExperienceVO } from '@/data/profile'
import { renderRich } from '@/utils/rich'
import styles from './ExperienceTimeline.module.css'

interface Props {
  experiences: ExperienceVO[]
}

function formatMonth(value: string): string {
  return value.replace('-', '.')
}

function formatPeriod(experience: ExperienceVO): string {
  return `${formatMonth(experience.startDate)} - ${experience.endDate ? formatMonth(experience.endDate) : '至今'}`
}

export default function ExperienceTimeline({ experiences }: Props) {
  return (
    <section className={`container section ${styles.section}`} aria-labelledby="exp-title">
      <h2 id="exp-title" className="sectionTitle">
        实习经历
      </h2>
      <p className="sectionLead">三段企业实习，从传统后端一路做到 AI Agent。</p>

      <ol className={styles.timeline}>
        {experiences.map((experience) => (
          <li key={`${experience.company}-${experience.startDate}`} className={styles.item}>
            <span className={styles.dot} aria-hidden="true" />

            <article className={styles.card}>
              <header className={styles.head}>
                <div>
                  <h3 className={styles.company}>{experience.company}</h3>
                  <p className={styles.position}>
                    {experience.department} · {experience.position}
                  </p>
                </div>
                <span className={styles.period}>{formatPeriod(experience)}</span>
              </header>

              {experience.projectName ? (
                <p className={styles.project}>
                  <span className={styles.projectName}>{experience.projectName}</span>
                  {experience.projectIntro ? <span className={styles.projectIntro}>{experience.projectIntro}</span> : null}
                </p>
              ) : null}

              <ul className={styles.highlights}>
                {experience.highlights.map((line) => (
                  <li key={line} className={styles.highlight}>
                    {renderRich(line)}
                  </li>
                ))}
              </ul>

              <ul className={styles.tags}>
                {experience.techStack.map((tech) => (
                  <li key={tech} className={styles.tag}>
                    {tech}
                  </li>
                ))}
              </ul>
            </article>
          </li>
        ))}
      </ol>
    </section>
  )
}
