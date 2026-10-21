import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { getToken } from '@/api/client'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { clearAdminTabs, useAdminTabs } from '@/hooks/useAdminTabs'
import { ADMIN_MENU, resolveAdminRoute } from './adminMenu'
import styles from './admin.module.css'

const SIDEBAR_KEY = 'jcpress.admin.sidebar.collapsed'
/** 必须与 admin.module.css 里的窄屏断点（960px）保持一致。 */
const NARROW_QUERY = '(max-width: 959px)'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * 窄屏判定。`matchMedia` 在 jsdom 里可能不存在（vitest 要渲染本组件），
 * 所以这里做了特性检测 —— 拿不到就一律当宽屏，**不能让外壳因为环境缺 API 而崩**。
 */
function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => {
    if (typeof window.matchMedia !== 'function') return false
    return window.matchMedia(NARROW_QUERY).matches
  })

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(NARROW_QUERY)
    const onChange = () => setNarrow(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return narrow
}

/**
 * 后台外壳：深色侧边栏 + 顶栏（折叠键 / 面包屑 / 用户下拉）+ 标签页条 + 内容区。
 *
 * 两条硬约束写在这里，改样式前先读一遍：
 *  1. **不能出现 `<header>` / `<footer>` / `<table>`**。视觉隔离断言用的是
 *     `document.querySelector('header')`，用了 header 就等于把自己当成公开站顶栏，
 *     `audit-behavior` 的三期#12 会直接红。
 *  2. 侧边栏 / 标签页 / 面包屑全部由 `adminMenu.ts` 驱动，不在 JSX 里写死路由。
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { me, logout } = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { tabs, close, closeOthers } = useAdminTabs()
  const narrow = useIsNarrow()

  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  const meta = resolveAdminRoute(location.pathname)

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
    } catch {
      // 存不下就存不下：折叠状态不值得为它报错
    }
  }, [collapsed])

  // 换页就收起移动端抽屉与用户下拉，否则它们会挂在下一页上；
  // 同时把内容区滚回顶部 —— 滚动容器是 `.body` 而不是 window，浏览器那套
  // 「前进后退恢复滚动位置」管不到它，从长页面切到短页面会停在空白处。
  // 用 `scrollTop = 0` 而不是 `scrollTo()`：jsdom 没实现 Element.scrollTo，
  // 在单测里会直接抛 TypeError，把整页渲染带崩（这两个写法语义一样）。
  useEffect(() => {
    setDrawerOpen(false)
    setMenuOpen(false)
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }, [location.pathname])

  const toggleNav = () => {
    if (narrow) setDrawerOpen((open) => !open)
    else setCollapsed((value) => !value)
  }

  const onLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        clearAdminTabs()
        navigate('/admin/login', { replace: true })
      },
    })
  }

  // 有 token 才渲染身份区；否则（正在跳登录页的路上）不渲染半截 UI
  const subscribed = getToken() !== null
  const displayName = me.data?.nickname ?? me.data?.username ?? ''
  const initial = displayName.slice(0, 1).toUpperCase()

  return (
    <div className={`${styles.adminScope} ${styles.shell}`}>
      {narrow && drawerOpen && (
        <button
          className={styles.drawerBackdrop}
          type="button"
          aria-label="收起导航"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <aside
        className={styles.sidebar}
        data-collapsed={!narrow && collapsed ? 'true' : 'false'}
        data-open={narrow && drawerOpen ? 'true' : 'false'}
      >
        <div className={styles.sideBrand}>
          <span className={styles.sideLogo} aria-hidden="true">
            JC
          </span>
          <span className={styles.sideBrandText}>JCPress 后台</span>
        </div>

        <nav className={styles.sideNav}>
          <Link className={styles.sideTop} to="/">
            <span>回到前台</span>
            <span className={styles.sideTopMark} aria-hidden="true">
              &#8599;
            </span>
          </Link>

          {ADMIN_MENU.map((group) => (
            <div className={styles.sideGroup} key={group.label}>
              <div className={styles.sideGroupLabel}>{group.label}</div>
              {group.items.map((item) =>
                item.enabled && item.to !== undefined ? (
                  <Link
                    key={item.label}
                    to={item.to}
                    className={
                      item.to === meta.activePath
                        ? `${styles.sideItem} ${styles.sideItemActive}`
                        : styles.sideItem
                    }
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span key={item.label} className={`${styles.sideItem} ${styles.sideItemOff}`}>
                    <span>{item.label}</span>
                    <span className={styles.sideItemTag}>开发中</span>
                  </span>
                ),
              )}
            </div>
          ))}
        </nav>
      </aside>

      <div className={styles.main}>
        <div className={styles.topbar}>
          <button
            className={styles.iconBtn}
            type="button"
            aria-label={narrow ? '打开导航' : collapsed ? '展开侧边栏' : '收起侧边栏'}
            aria-expanded={narrow ? drawerOpen : !collapsed}
            onClick={toggleNav}
          >
            <span className={styles.burger} aria-hidden="true" />
          </button>

          <div className={styles.crumb}>
            <span className={styles.crumbHome}>首页</span>
            {meta.breadcrumb.map((part) => (
              <span className={styles.crumbItem} key={part}>
                {part}
              </span>
            ))}
          </div>

          <span className={styles.spacer} />

          {subscribed && (
            <div className={styles.userBox}>
              <button
                className={styles.userBtn}
                type="button"
                aria-label="用户菜单"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span className={styles.avatar} aria-hidden="true">
                  {initial}
                </span>
                <span className={styles.userName}>{displayName}</span>
                <span className={styles.caret} aria-hidden="true" />
              </button>
              {menuOpen && (
                <div className={styles.userMenu}>
                  <Link className={styles.userMenuItem} to="/">
                    回到前台
                  </Link>
                  <button
                    className={styles.userMenuItem}
                    type="button"
                    onClick={onLogout}
                    disabled={logout.isPending}
                  >
                    {logout.isPending ? '退出中…' : '退出登录'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {menuOpen && (
          <button
            className={styles.popoverBackdrop}
            type="button"
            aria-label="关闭用户菜单"
            onClick={() => setMenuOpen(false)}
          />
        )}

        <div className={styles.tabsBar}>
          {tabs.map((tab) => (
            <span
              key={tab.path}
              className={
                tab.path === location.pathname ? `${styles.tab} ${styles.tabActive}` : styles.tab
              }
            >
              <Link className={styles.tabLink} to={tab.path}>
                {tab.title}
              </Link>
              {tab.closable && (
                <button
                  className={styles.tabClose}
                  type="button"
                  aria-label={`关闭 ${tab.title}`}
                  onClick={() => close(tab.path)}
                >
                  <span aria-hidden="true">&#215;</span>
                </button>
              )}
            </span>
          ))}
          <span className={styles.spacer} />
          {tabs.length > 1 && (
            <button
              className={styles.tabsAction}
              type="button"
              onClick={() => closeOthers(location.pathname)}
            >
              关闭其他
            </button>
          )}
        </div>

        <div className={styles.body} ref={bodyRef}>{children}</div>
      </div>
    </div>
  )
}
