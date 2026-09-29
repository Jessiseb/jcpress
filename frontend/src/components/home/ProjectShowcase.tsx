import { useState } from 'react'
import type { CSSProperties } from 'react'

import type { ProjectVO } from '@/data/profile'
import { useSpotlight } from '@/hooks/useSpotlight'
import { renderRich } from '@/utils/rich'
import { withLatinEmphasis } from '@/utils/latin'
import spot from '@/styles/spotlight.module.css'
import styles from './ProjectShowcase.module.css'

interface Props {
  projects: ProjectVO[]
}

const stagger = (step: number) => ({ '--reveal-delay': `${step * 70}ms` }) as CSSProperties

const STATUS_LABEL: Record<ProjectVO['status'], string> = {
  ONGOING: '进行中',
  ONLINE: '已上线',
  ARCHIVED: '已归档',
}

interface RowProps {
  project: ProjectVO
  index: number
  open: boolean
  onToggle: () => void
}

/**
 * 单行。抽成子组件有两个理由：
 *  1. `useSpotlight` 需要「每行一个 ref」，写在 map 里共用同一个 ref 是不行的；
 *  2. 行内的展开状态由父级统一管理（同时只展开一行），行本身保持无状态。
 */
function ProjectRow({ project, index, open, onToggle }: RowProps) {
  const ref = useSpotlight<HTMLDivElement>()
  const panelId = `project-panel-${project.slug}`

  return (
    <div ref={ref} className={`${spot.host} ${styles.row}`}>
      <span className={styles.idx}>{String(index + 1).padStart(2, '0')}</span>

      <h3 className={styles.name}>{withLatinEmphasis(project.name)}</h3>

      <span className={styles.meta}>
        {project.role} · {STATUS_LABEL[project.status]}
      </span>

      <button
        type="button"
        className={`btn btnOutline btnSm ${styles.toggle}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        {open ? '收起' : '展开'}
      </button>

      <div id={panelId} className={styles.panel} hidden={!open}>
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

        <p className={styles.tech}>{project.techStack.join(' · ')}</p>

        {project.repoUrl ? (
          <a
            className={`btn btnGhost ${styles.repo}`}
            href={project.repoUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            去 Gitee 看看 →
          </a>
        ) : null}
      </div>
    </div>
  )
}

/**
 * 项目经历：编辑式表格（ID / 项目 / 角色 · 状态 / 展开）。
 *
 * 为什么不是卡片墙：参照站的「作品表」靠对齐制造秩序，信息密度更高，也少一层模板感。
 * 为什么没有「年份」列：现有 ProjectVO 里没有对应字段，凭空编年份就是假数据。
 * 交互：展开由 <button aria-expanded> 点击 / 回车触发 —— hover 只做视觉强调
 *   （指针聚光 + 左侧蓝条），不作任何信息的唯一入口。
 */
export default function ProjectShowcase({ projects }: Props) {
  const [openSlug, setOpenSlug] = useState<string | null>(null)

  return (
    <section
      className="container section"
      aria-labelledby="projects-title"
      data-rhythm="major"
    >
      <h2 id="projects-title" className="sectionTitle" data-reveal>
        项目经历
        {/* 环母题的中尺寸变体：这一块是首页的信息重心，给它一枚区块标记 */}
        <span className={styles.badge} data-ring="" aria-hidden="true" />
      </h2>
      <p className="sectionLead" data-reveal style={stagger(1)}>
        两个从 0 到 1 自研的项目，都由我负责后端与整体方案。展开看难点与取舍。
      </p>

      {/* data-glass + .panel：与「关键数字」并列的第二处（也是最后一处）面板 */}
      <div className={`panel ${styles.table}`} data-glass="" data-reveal style={stagger(2)}>
        <div className={styles.head} aria-hidden="true">
          <span>ID</span>
          <span>项目</span>
          <span>角色 · 状态</span>
          <span />
        </div>

        {projects.map((project, index) => (
          <ProjectRow
            key={project.slug}
            project={project}
            index={index}
            open={openSlug === project.slug}
            onToggle={() => setOpenSlug(openSlug === project.slug ? null : project.slug)}
          />
        ))}
      </div>
    </section>
  )
}
