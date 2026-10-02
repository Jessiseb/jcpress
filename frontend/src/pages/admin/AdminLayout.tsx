import { Link, useNavigate } from 'react-router-dom'

import { getToken } from '@/api/client'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import styles from './admin.module.css'

/**
 * 后台外壳：一条顶栏 + 内容区。**不套公开站的 TopNav / Footer / 天体层** —— 那三样是
 * 面向访客的门面，出现在后台只会让人以为「还在自己网站里」。这里就是一块朴素的工具台。
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { me, logout } = useAdminAuth()
  const navigate = useNavigate()

  const onLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => navigate('/admin/login', { replace: true }),
    })
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <span className={styles.brand}>JCPress 后台</span>
        <Link className={styles.btn} to="/admin/articles">
          文章
        </Link>
        <Link className={styles.btn} to="/">
          回到前台
        </Link>
        <span className={styles.topbarSpacer} />
        {/* 有 token 才显示身份/退出；否则（正在跳登录页的路上）不渲染半截 UI */}
        {getToken() !== null && (
          <>
            <span className={styles.who}>{me.data ? `${me.data.nickname}（${me.data.username}）` : ''}</span>
            <button className={styles.btn} type="button" onClick={onLogout} disabled={logout.isPending}>
              {logout.isPending ? '退出中…' : '退出'}
            </button>
          </>
        )}
      </div>
      {children}
    </div>
  )
}
