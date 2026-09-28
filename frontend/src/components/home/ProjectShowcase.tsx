import type { ProjectVO } from '@/data/profile'
import { renderRich } from '@/utils/rich'
import styles from './ProjectShowcase.module.css'

interface Props {
  projects: ProjectVO[]
}

const STATUS_LABEL: Record<ProjectVO['status'], string> = {
  ONGOING: '进行中',
  ONLINE: '已上线',
  ARCHIVED: '已归档',
}

export default function ProjectShowcase({ projects }: Props) {
  return (
    <section className={`container section ${styles.section}`} aria-labelledby="projects-title">
      <h2 id="projects-title" className="sectionTitle">
        项目经历
      </h2>
      <p className="sectionLead">两个从 0 到 1 的项目，都是后端负责人。</p>

      <div className={styles.grid}>
        {projects.map((project) => (
          <article key={project.slug} className={project.isFeatured ? styles.card : `${styles.card} ${styles.cardMore}`}>
            <header className={styles.head}>
              <h3 className={styles.name}>{project.name}</h3>
              <span className={styles.status}>{STATUS_LABEL[project.status]}</span>
            </header>

            <p className={styles.role}>{project.role}</p>
            <p className={styles.summary}>{project.summary}</p>

            {project.highlights.length > 0 ? (
              <ul className={styles.highlights}>
                {project.highlights.map((line) => (
                  <li key={line} className={styles.highlight}>
                    {renderRich(line)}
                  </li>
                ))}
              </ul>
            ) : null}

            <ul className={styles.tags}>
              {project.techStack.map((tech) => (
                <li key={tech} className={styles.tag}>
                  {tech}
                </li>
              ))}
            </ul>

            {project.repoUrl ? (
              <a className={styles.link} href={project.repoUrl} target="_blank" rel="noreferrer noopener">
                去 Gitee 看看 →
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}
