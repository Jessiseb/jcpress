import RingField from '@/components/layout/RingField'
import { profileData } from '@/data/profile'
import styles from './Footer.module.css'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className={styles.footer}>
      {/* 页脚是「下半场布景」：环只露出一段弧线。
          这里**不能**加 data-reveal —— useReveal 只观察首页那棵子树（HomePage 的 ref），
          页脚在它之外，带 data-reveal 的元素会被全局的隐藏态规则压成 opacity:0 且永不揭示
          （等于页脚环根本看不见）。这个坑是行为断言抓到的，肉眼看截图看不出来。 */}
      <div className={styles.ringLayer}>
        <RingField size={820} opacity={0.75} />
      </div>

      <div className={`container ${styles.inner}`}>
        {/* 收尾语 + 一个动作：把页脚从「版权声明」变成「一句人话 + 一个入口」 */}
        <div className={styles.closing}>
          <p className={styles.closingLine}>有合适的机会，随时找我。</p>
          <a className="btn btnOutline btnSm" href={`mailto:${profileData.profile.email}`}>
            发邮件
          </a>
        </div>

        {/* 统计值用一行文字带过，不再做成四张卡片 —— 页脚再摆一排数字卡会把整页拉回看板感 */}
        <p className={styles.stats}>
          {profileData.stats.map((item) => (
            <span key={item.label} className={styles.stat}>
              {item.label} <strong className={styles.statValue}>{item.value}</strong>
            </span>
          ))}
        </p>

        <div className={styles.meta}>
          <p>© {year} 庄家希 · 基于 React + Vite 构建</p>
          <p className={styles.sub}>备案号待补充（国内节点需 ICP 备案，见规划 §12）</p>
        </div>
      </div>
    </footer>
  )
}
