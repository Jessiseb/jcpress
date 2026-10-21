import { useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, Bot, BriefcaseBusiness, CalendarDays, MapPin } from 'lucide-react'

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

function companyMark(company: string): string {
  if (company.includes('视源')) return 'CVTE'
  if (company.includes('用友')) return '用友'
  if (company.includes('粤建')) return '粤建'
  return company.slice(0, 2)
}

function companyTone(company: string): string {
  if (company.includes('视源')) return styles.cvte
  if (company.includes('用友')) return styles.yonyou
  return styles.yuejian
}

/**
 * 公司图片。
 *
 * 视源（CVTE）已是**真实公司照片**（2026-10-16 用户提供前台实拍，本机转 webp：
 * 源 1280×1280 / 454KB → `public/companies/cvte.webp` 1080×1080 / **68KB**，
 * 比原来的 Unsplash 占位图还小）。其余两家暂时仍是占位图，等真实照片到位再换。
 *
 * 为什么真实照片必须落在本地（原注释里的三条理由，现在兑现了）：
 *  ① 移动端性能：`audit-perf.cjs` 的 4× 降速下，远程大图解码会直接排进长任务；
 *  ② 离线 / 内网环境下会退化成空白 —— 答辩现场断网就是白板；
 *  ③ 远程图还会把访客的 IP 送给第三方图床。
 * 照片本身走 <img loading=lazy decoding=async>，不用 CSS background-image
 * （背景图没法 lazy，也没法 async 解码）。
 */
function companyImage(company: string): string {
  // 用户提供的实拍（MAXHUB / seewo 希沃 前台墙）。改名换图时记得同步下面 <img> 的
  // width/height —— 那两个数字是给浏览器算纵横比用的，写错会在加载完成时抖一下。
  if (company.includes('视源')) return '/companies/cvte.webp'
  if (company.includes('用友')) return 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=560&h=840&q=70'
  return 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=560&h=840&q=70'
}

/**
 * 实习经历：左图 + 右文的整幅特写（data-full 让正文通栏，见 global.css）。
 * 顶部标签切换 + 底部左右箭头切换，两处都驱动同一个 activeIndex。
 */
export default function ExperienceTimeline({ experiences }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)
  const active = experiences[activeIndex]

  if (!active) return null

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

      <div className={styles.experienceTabs} data-reveal style={stagger(2)} role="tablist" aria-label="实习经历列表">
        {experiences.map((experience, index) => (
          <button
            key={experience.company}
            type="button"
            className={`${styles.tab} ${index === activeIndex ? styles.tabActive : ''}`}
            onClick={() => setActiveIndex(index)}
            role="tab"
            aria-selected={index === activeIndex}
            /* 标签上只印简称（CVTE / 用友 / 粤建），全名走 aria-label。
               不用「视觉隐藏但留在 DOM 里」的 srOnly 兜底：audit-behavior 的
               「全页无文字溢出」会把它判成溢出（scrollWidth 160 > clientWidth 1）。 */
            aria-label={`${experience.company} · ${formatPeriod(experience)}`}
          >
            <span>{companyMark(experience.company)}</span>
            <small>{formatPeriod(experience)}</small>
          </button>
        ))}
      </div>

      <div className={styles.switcher} data-reveal style={stagger(3)}>
        {/* 图片上不放文字。原因不只是观感：`.tmp/tools/audit-contrast.cjs` 的有效背景
            只能沿祖先链取 background-color（不认 background-image），
            飘在照片上的白字会被算成「白底白字」而必然不达标 —— 而且那个判定是对的，
            照片任意一帧都可能把文字吃掉。所以编号落在底部一块**不透明**的实底上。 */}
        <div className={`${styles.visual} ${companyTone(active.company)}`} data-photo="">
          {/* 照片走 <img> 而不是 CSS 背景：能吃到 loading=lazy 与 decoding=async，
              移动端 4× 降速时不会把大图解码排进首屏长任务。
              width/height 写的是**当前这张真实照片**的像素（1080×1080 方形）；
              另两家仍是 560×840 的占位图 —— 这两个数字对布局没有影响
              （`.visualPhoto` 是 absolute + 100%/100%，尺寸由 CSS 说了算），
              它只是给浏览器一个纵横比提示，换图时同步一下即可。 */}
          <img
            className={styles.visualPhoto}
            src={companyImage(active.company)}
            alt={`${active.company} 公司图片`}
            width={1080}
            height={1080}
            loading="lazy"
            decoding="async"
          />
          {/* 压暗用**实色**罩，不用渐变：渐变宿主是登记制（audit-behavior 的
              「渐变只出现在流线 / 面板 / 环装置 / 姓名 / 顶栏遮罩 / 聚光宿主上」），
              这里只是给照片降亮度的功能性遮罩，没资格占一个渐变名额。 */}
          <span className={styles.visualShade} aria-hidden="true" />
          <span className={styles.visualGlow} aria-hidden="true" />
          {/* 2026-10-16 用户要求去掉底部的公司简称大字（原来这里是 clamp 到 6rem 的
              「CVTE」）。这个大字是多余的：照片本身就是 CVTE 前台实拍，画面里已经有
              CVTE / Dream·Future 的 logo，纸面上再印一遍是重复；而且它把底部那块实底
              撑高了一倍，白占照片的可见区。现在这块底只剩编号一行（实测 70px，原先是
              大字的字号在占高度）。
              公司标识不走这里也不丢：顶部切换条、右侧正文的 h3 全名都写着。 */}
          <div className={styles.plate} data-plate="">
            <span className={styles.visualCaption}>
              WORK EXPERIENCE / {String(activeIndex + 1).padStart(2, '0')}
            </span>
          </div>
        </div>

        <article key={`${active.company}-${activeIndex}`} className={styles.body}>
          <div className={styles.companyHeading}>
            <div>
              <span className={styles.eyebrow}>实习经历 · {String(activeIndex + 1).padStart(2, '0')} / {String(experiences.length).padStart(2, '0')}</span>
              <h3 className={styles.company}>{active.company}</h3>
              <p className={styles.position}>{active.position}</p>
            </div>
            <span className={styles.roleIcon} aria-hidden="true">
              {active.projectName ? <Bot size={20} /> : <BriefcaseBusiness size={20} />}
            </span>
          </div>

          <div className={styles.metaBar}>
            <span className={styles.periodRow}><CalendarDays size={15} /><span className={styles.period}>{formatPeriod(active)}</span></span>
            <span className={styles.metaRow}><MapPin size={14} /><span className={styles.meta}>{active.city} · {active.department}</span></span>
          </div>

          {active.projectName ? (
            <p className={styles.project}>
              <span className={styles.projectName}>{active.projectName}</span>
              {active.projectIntro}
            </p>
          ) : null}

          <ul className={styles.highlights}>
            {active.highlights.map((line) => (
              <li key={line} className={styles.highlight}>{renderRich(line)}</li>
            ))}
          </ul>

          <p className={styles.tech}>{active.techStack.join(' · ')}</p>

          <div className={styles.controls}>
            <div className={styles.dots} aria-label="选择实习经历">
              {experiences.map((experience, index) => (
                <button key={experience.company} type="button" className={`${styles.dot} ${index === activeIndex ? styles.dotActive : ''}`} onClick={() => setActiveIndex(index)} aria-label={`查看${experience.company}`} aria-pressed={index === activeIndex} />
              ))}
            </div>
            <div className={styles.arrows}>
              <button type="button" className={styles.arrow} onClick={() => setActiveIndex((activeIndex - 1 + experiences.length) % experiences.length)} aria-label="上一段经历"><ArrowLeft size={18} /></button>
              <button type="button" className={styles.arrow} onClick={() => setActiveIndex((activeIndex + 1) % experiences.length)} aria-label="下一段经历"><ArrowRight size={18} /></button>
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}
