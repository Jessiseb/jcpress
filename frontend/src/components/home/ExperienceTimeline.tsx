import type { CSSProperties } from 'react'

import type { ExperienceVO } from '@/data/profile'
import { renderRich } from '@/utils/rich'
import styles from './ExperienceTimeline.module.css'

interface Props {
  experiences: ExperienceVO[]
}

const stagger = (step: number) => ({ '--reveal-delay': `${step * 70}ms` }) as CSSProperties

function formatMonth(value: string): string {
  return value.replace('-', '.')
}

function formatPeriod(experience: ExperienceVO): string {
  return `${formatMonth(experience.startDate)} - ${experience.endDate ? formatMonth(experience.endDate) : '至今'}`
}

/**
 * 实习经历。左栏放时间与地点，右栏放正文 —— 两栏结构本身就是「时间线」，
 * 不需要再画轴线、圆点或卡片，那些装饰在移动端还会全部塌掉。
 */
export default function ExperienceTimeline({ experiences }: Props) {
  return (
    <section
      className="container section"
      aria-labelledby="exp-title"
      data-rhythm="minor"
    >
      <h2 id="exp-title" className="sectionTitle" data-reveal>
        实习经历
      </h2>
      <p className="sectionLead" data-reveal style={stagger(1)}>
        三段企业实习，从传统 Java 后端一路做到 AI Agent 工程。
      </p>

      <ol className={styles.list}>
        {experiences.map((experience, index) => (
          <li
            key={`${experience.company}-${experience.startDate}`}
            className={styles.item}
            data-reveal
            style={stagger(index + 2)}
          >
            <div className={styles.rail}>
              <span className={styles.period}>{formatPeriod(experience)}</span>
              <span className={styles.meta}>
                {experience.city} · {experience.department}
              </span>
            </div>

            <article className={styles.body}>
              <h3 className={styles.company}>{experience.company}</h3>
              <p className={styles.position}>{experience.position}</p>

              {experience.projectName ? (
                <p className={styles.project}>
                  <span className={styles.projectName}>{experience.projectName}</span>
                  {experience.projectIntro}
                </p>
              ) : null}

              <ul className={styles.highlights}>
                {experience.highlights.map((line) => (
                  <li key={line} className={styles.highlight}>
                    {renderRich(line)}
                  </li>
                ))}
              </ul>

              <p className={styles.tech}>{experience.techStack.join(' · ')}</p>
            </article>
          </li>
        ))}
      </ol>
    </section>
  )
}
