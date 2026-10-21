import type { CSSProperties } from 'react'
import { MapPin } from 'lucide-react'

import type { ExperienceVO } from '@/data/profile'
import { renderRich } from '@/utils/rich'
import styles from './ExperienceTimeline.module.css'

interface Props {
  experiences: ExperienceVO[]
}

const stagger = (step: number) => ({ '--reveal-delay': `${step * 70}ms` }) as CSSProperties

/** 每段默认露出的要点条数，其余折叠。CVTE 有 7 条，全摊开整块会到两屏。 */
const VISIBLE_POINTS = 3

/**
 * 按内容量决定折几条。
 *
 * 剩下的**只有 1 条时不折**：为了多看一眼去点一次「展开其余 1 条」，收益是负的 ——
 * 那行 summary 有 44px 触摸高度，比被它藏起来的那条要点还高。
 * 用友那段正好 4 条，就是这种情况（用户原话：「用友的实习经历不用收起，直接展示」）。
 * 阈值写成规则而不是「用友/粤建不折」的白名单：数据改了以后行为跟着内容走，
 * 不用回来改代码。
 */
function splitHighlights(highlights: string[]): { shown: string[]; folded: string[] } {
  if (highlights.length - VISIBLE_POINTS <= 1) return { shown: highlights, folded: [] }
  return {
    shown: highlights.slice(0, VISIBLE_POINTS),
    folded: highlights.slice(VISIBLE_POINTS),
  }
}

function formatMonth(value: string): string {
  return value.replace('-', '.')
}

function formatPeriod(experience: ExperienceVO): string {
  return `${formatMonth(experience.startDate)} - ${experience.endDate ? formatMonth(experience.endDate) : '至今'}`
}

/**
 * 公司图片：三家现在都是本地资源，且统一成 1:1 方图。
 *
 * 视源是**真实前台照片**（2026-10-16 用户提供，源 1280×1280 / 454KB →
 * `cvte.webp` 1080×1080 / 68KB）。
 * 用友与三和（2026-10-21 用户提供）给的分别是横排和竖排的白底 logo，
 * 不能直接塞进方框 —— `object-fit: cover` 会把横排 logo 两端切掉。
 * 所以先用 `.tmp/tools/make-company-logo.cjs` 裁掉四周白边、居中补成方形再转 webp。
 * **换图必须重跑那个脚本**，直接丢一张非方图进来会被裁边。
 *
 * 图片必须落在本地：移动端 4× 降速下远程大图解码会排进长任务；断网时退化成空白；
 * 还会把访客 IP 送给第三方图床。照片走 <img loading=lazy decoding=async>，
 * 不用 CSS background-image（背景图没法 lazy，也没法 async 解码）。
 */
function companyImage(company: string): string {
  if (company.includes('视源')) return '/companies/cvte.webp'
  if (company.includes('用友')) return '/companies/yonyou.webp'
  return '/companies/sanhe.webp'
}

/** 给 <img> 的 width/height 属性（纵横比提示，防加载完成时抖一下）。
 *  三张都是 1:1，写真实边长而不是写 1:1 占位值 —— 将来真混进一张非方图，
 *  这里会立刻对不上，比默默 cover 裁掉一截更容易发现。 */
function companyImageSize(company: string): { width: number; height: number } {
  if (company.includes('视源')) return { width: 1080, height: 1080 }
  if (company.includes('用友')) return { width: 256, height: 256 }
  return { width: 512, height: 512 }
}

/**
 * 实习经历：竖向时间轴，三段全部铺开。
 *
 * 前两版都是「一次只显示一段」+ 顶部切换条，问题是内容量差 2.5 倍
 * （CVTE 7 条 / 用友 4 条 / 粤建 3 条），卡片高度被最长那段钉死，
 * 短的两段底下空一大片；而且不点切换就只看得见三分之一的经历。
 * 现在每段按自己的内容定高，期间只出现在左侧轴上（不再和正文里的期间行重复）。
 *
 * `.visual` 的深色底和照片遮罩都去掉了：缩略图是 1:1 方图，
 * 与 CVTE 那张 1080×1080 方图同比例 —— 不裁边，那排 logo 完整落在里面。
 */
export default function ExperienceTimeline({ experiences }: Props) {
  return (
    <section
      className="container section"
      aria-labelledby="exp-title"
      data-rhythm="minor"
      data-full
    >
      <h2 id="exp-title" className="sectionTitle" data-reveal>
        实习经历
      </h2>
      <p className="sectionLead" data-reveal style={stagger(1)}>
        三段企业实习，从传统 Java 后端一路做到 AI Agent 工程。
      </p>

      <ol className={styles.timeline}>
        {experiences.map((experience, index) => {
          const { shown, folded } = splitHighlights(experience.highlights)
          const size = companyImageSize(experience.company)

          return (
            <li className={styles.item} key={experience.company} data-reveal style={stagger(index + 2)}>
              <span className={styles.axis}>{formatPeriod(experience)}</span>
              <span className={styles.node} aria-hidden="true" />

              <article className={styles.entry}>
                <header className={styles.head}>
                  {/* data-photo 是验收口径：内容图必须挂在登记过的宿主上，
                      否则 audit-behavior 的「图片全部登记」那条会亮红。 */}
                  <img
                    className={styles.thumb}
                    data-photo=""
                    src={companyImage(experience.company)}
                    alt={`${experience.company} 公司图片`}
                    width={size.width}
                    height={size.height}
                    loading="lazy"
                    decoding="async"
                  />
                  <div className={styles.headText}>
                    <h3 className={styles.company}>{experience.company}</h3>
                    <p className={styles.position}>{experience.position}</p>
                    <p className={styles.meta}>
                      <MapPin size={13} />
                      {experience.city} · {experience.department}
                    </p>
                  </div>
                </header>

                {experience.projectName ? (
                  <p className={styles.project}>
                    <span className={styles.projectName}>{experience.projectName}</span>
                    {experience.projectIntro}
                  </p>
                ) : null}

                <ul className={styles.points}>
                  {shown.map((line) => (
                    <li key={line} className={styles.point}>{renderRich(line)}</li>
                  ))}
                </ul>

                {folded.length > 0 && (
                  <details className={styles.more}>
                    <summary>
                      <span className={styles.moreOpen}>展开其余 {folded.length} 条</span>
                      <span className={styles.moreClose}>收起</span>
                    </summary>
                    <ul className={styles.points}>
                      {folded.map((line) => (
                        <li key={line} className={styles.point}>{renderRich(line)}</li>
                      ))}
                    </ul>
                  </details>
                )}

                <p className={styles.techStack}>{experience.techStack.join(' · ')}</p>
              </article>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
