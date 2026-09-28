import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'

import type { Theme } from '@/hooks/useTheme'
import { NAV_ITEMS } from './TopNav'
import styles from './MobileDrawer.module.css'

interface Props {
  open: boolean
  theme: Theme
  onClose: () => void
  onToggleTheme: () => void
}

/** 窄屏抽屉导航：频道 + 主题切换都在里面，遮罩点击与 ESC 都能关。 */
export default function MobileDrawer({ open, theme, onClose, onToggleTheme }: Props) {
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  return (
    <div className={`${styles.root} ${open ? styles.rootOpen : ''}`} aria-hidden={!open}>
      <div className={styles.mask} onClick={onClose} />

      <aside
        id="mobile-drawer"
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="导航菜单"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className={styles.head}>
          <span className={styles.title}>导航</span>
          <button type="button" className={styles.close} onClick={onClose} aria-label="关闭导航菜单">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) => (isActive ? `${styles.item} ${styles.itemActive}` : styles.item)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button type="button" className={styles.themeBtn} onClick={onToggleTheme}>
          {theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
        </button>
      </aside>
    </div>
  )
}
