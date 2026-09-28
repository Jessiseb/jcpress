import { profileData } from '@/data/profile'
import styles from './Footer.module.css'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.stats}>
          {profileData.stats.map((item) => (
            <div key={item.label} className={styles.stat}>
              <span className={styles.statValue}>{item.value}</span>
              <span className={styles.statLabel}>{item.label}</span>
            </div>
          ))}
        </div>

        <div className={styles.meta}>
          <p>
            © {year} 庄家希 · 基于 React + Vite 构建 · 主题色 青碧 Teal
          </p>
          <p className={styles.sub}>备案号待补充（国内节点需 ICP 备案，见规划 §12）</p>
        </div>
      </div>
    </footer>
  )
}
