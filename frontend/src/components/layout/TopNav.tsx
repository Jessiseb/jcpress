import { useState } from 'react'
import { NavLink } from 'react-router-dom'

import { profileData } from '@/data/profile'
import { useTheme } from '@/hooks/useTheme'
import MobileDrawer from './MobileDrawer'
import styles from './TopNav.module.css'

export const NAV_ITEMS = [
  { to: '/', label: '关于我' },
  { to: '/tech', label: '技术分享' },
  { to: '/algo', label: '算法笔记' },
  { to: '/projects', label: '项目笔记' },
] as const

/**
 * 顶栏：悬浮玻璃胶囊。
 *
 * 2026-09-28 改版：从「通栏 sticky 条」换成参照站的悬浮胶囊（设计方向 A/C 的签名元素之一）。
 * 外层的 sticky 壳只负责定位与顶部渐隐遮罩，视觉全部落在胶囊上。
 */
export default function TopNav() {
  const { theme, toggle } = useTheme()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      {/* data-scrim：外层这层顶部渐隐是「功能性遮罩」（保证滚动时胶囊边缘的文字可读），
          不是装饰性渐变 —— 断言套件的渐变护栏据此把它与「模板感渐变」区分开 */}
      <header className={styles.navbar} data-scrim="">
        <div className={styles.pill}>
          <NavLink to="/" className={styles.brand}>
            {/* 品牌标记：环母题的最小尺寸变体（4 圈同心环 + 中心点） */}
            <span className={styles.mark} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="8.6" stroke="currentColor" strokeWidth="1" opacity="0.32" />
                <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="1" opacity="0.5" />
                <circle cx="10" cy="10" r="3.4" stroke="currentColor" strokeWidth="1" opacity="0.75" />
                <circle cx="10" cy="10" r="1.1" fill="currentColor" />
              </svg>
            </span>
            <span className={styles.brandName}>jcpress</span>
          </NavLink>

          <nav className={styles.links} aria-label="主导航">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => (isActive ? `${styles.link} ${styles.linkActive}` : styles.link)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className={styles.actions}>
            {/* 胶囊右端的实心 CTA：与首屏主按钮共用全局按钮系统 */}
            <a className={`btn btnSolid btnSm ${styles.cta}`} href={`mailto:${profileData.profile.email}`}>
              发邮件
            </a>

            <button
              type="button"
              className={styles.iconBtn}
              onClick={toggle}
              aria-label={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
            >
              {theme === 'dark' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>

            <button
              type="button"
              className={styles.burger}
              onClick={() => setDrawerOpen(true)}
              aria-label="打开导航菜单"
              aria-expanded={drawerOpen}
              aria-controls="mobile-drawer"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onToggleTheme={toggle} theme={theme} />
    </>
  )
}
