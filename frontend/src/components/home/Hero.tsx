import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'

import type { ProfileVO } from '@/data/profile'
import { useSpotlight } from '@/hooks/useSpotlight'
import { withLatinEmphasis } from '@/utils/latin'
import styles from './Hero.module.css'

interface Props {
  profile: ProfileVO
}

/** 入场错峰：70ms 一档（frontend-design 基准 60–120ms） */
const stagger = (step: number) => ({ '--reveal-delay': `${step * 70}ms` }) as CSSProperties

/**
 * 首屏。信息只有五段：地点 → 姓名 + 定位 → 一句话 → 自述 → 动作。
 *
 * 2026-09-29：字体统一（见 docs/design-visual-language.md §4.4）；
 * 两个动作改用全局按钮系统（.btn + .btnSolid/.btnOutline），主按钮带指针跟随聚光。
 *
 * 2026-09-29（二期）：**首屏环装置退役**，背景改由全站的流线布景层承担
 * （`components/visual/FlowField`，挂在 App 上）。图案纪律因此从「只有一种」变成「两层」：
 * 流线是布景层（可流动），环退为标记层（顶栏 / 项目徽标 / 页脚，静止）。
 * 首屏不再需要 `isolation` 与「环层垫在 z-index:-1」这套结构。
 *
 * 刻意保留的克制：只有一个实心按钮，第二个动作降级成描边胶囊。
 */
export default function Hero({ profile }: Props) {
  // VO 约定：headline 形如「职位 · 一句话」。两段分别用：职位做 h1 第二行，一句话做描述段。
  const [position = profile.headline, tagline = ''] = profile.headline.split(' · ')

  // 主按钮的指针聚光：整个首屏只有一个会「发光」的元素，多一个就变成廉价特效
  const primaryRef = useSpotlight<HTMLAnchorElement>()

  return (
    <section className={`container ${styles.hero}`} aria-labelledby="hero-title">
      <p className={styles.kicker} data-reveal style={stagger(1)}>
        {profile.location} · AI 应用开发
      </p>

      <h1 id="hero-title" className={styles.name} data-reveal style={stagger(2)}>
        <span className={styles.nameMain} data-gradient="">
          {profile.displayName}
        </span>
        {/* data-weight：显式声明这一行**故意**是 500（姓名才是 700）。
            评审指出「展示字元素的计算字重为 700」这条规格在 h1 内部其实并存两档，
            口径只覆盖了一半 —— 因此这里把它标出来，并让断言按**文本节点**而不是元素判。 */}
        <span className={styles.nameSub} data-weight="500">
          {position}
        </span>
      </h1>

      <p className={styles.headline} data-reveal style={stagger(3)}>
        {withLatinEmphasis(tagline)}
      </p>

      <p className={styles.summary} data-reveal style={stagger(4)}>
        {profile.summary}
      </p>

      <div className={styles.actions} data-reveal style={stagger(5)}>
        {/* data-spot：这枚按钮的悬浮聚光是「交互反馈」，不是装饰性渐变 ——
            断言套件的渐变护栏据此把它与「模板感渐变」区分开 */}
        <Link
          ref={primaryRef}
          to="/tech"
          data-spot=""
          className={`btn btnSolid btnSpot ${styles.arrow}`}
        >
          看技术分享
        </Link>
        <a href={profile.resumePdfUrl} className="btn btnOutline" download>
          下载简历 PDF
        </a>
      </div>
    </section>
  )
}
