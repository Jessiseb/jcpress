import { Link } from 'react-router-dom'

import type { ProfileVO } from '@/data/profile'
import styles from './Hero.module.css'

interface Props {
  profile: ProfileVO
}

export default function Hero({ profile }: Props) {
  return (
    <section className={`container ${styles.hero}`}>
      <div className={styles.text}>
        <p className={styles.kicker}>{profile.location} · AI 应用开发</p>

        <h1 className={styles.name}>{profile.displayName}</h1>

        <p className={styles.headline}>{profile.headline}</p>

        <ul className={styles.keywords}>
          {profile.keywords.map((keyword) => (
            <li key={keyword} className={styles.keyword}>
              {keyword}
            </li>
          ))}
        </ul>

        <p className={styles.summary}>{profile.summary}</p>

        <div className={styles.ctas}>
          <Link to="/tech" className={styles.primary}>
            看技术分享 →
          </Link>
          <a href={profile.resumePdfUrl} className={styles.secondary} download>
            下载简历 PDF
          </a>
        </div>
      </div>

      <div className={styles.avatarWrap}>
        {/* 简历 PDF 无头像：用姓名首字渐变占位，替换成图片时把这里换掉即可 */}
        <div className={styles.avatar} aria-label={`${profile.displayName} 的头像占位`} role="img">
          庄
        </div>
        <div className={styles.contact}>
          <span>{profile.email}</span>
        </div>
      </div>
    </section>
  )
}
