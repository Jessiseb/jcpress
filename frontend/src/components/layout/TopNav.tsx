import { useState } from 'react'
import { NavLink } from 'react-router-dom'

import { useTheme } from '@/hooks/useTheme'
import MobileDrawer from './MobileDrawer'
import styles from './TopNav.module.css'

export const NAV_ITEMS = [
  { to: '/', label: '关于我' },
  { to: '/tech', label: '技术分享' },
  { to: '/algo', label: '算法笔记' },
  { to: '/projects', label: '项目笔记' },
] as const

export default function TopNav() {
  const { theme, toggle } = useTheme()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <header className={styles.navbar}>
        <div className={styles.inner}>
          <NavLink to="/" className={styles.brand}>
            {/* 品牌标记：环母题的最小尺寸变体（4 圈同心环 + 中心点）。
                换掉原来的实色「庄」方块 —— 环是全站的图案语言，logo 是它出现的第一处。 */}
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
