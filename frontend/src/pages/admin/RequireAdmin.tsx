import { Navigate, useLocation } from 'react-router-dom'

import { getToken } from '@/api/client'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import styles from './admin.module.css'

/**
 * 登录守卫。三种状态各走各的：
 *  1. 本地无 token，或 `/me` 已经失败 → 跳登录页（把来源路径带上，登录后回原处）；
 *  2. `/me` 还在校验 → 显示「正在校验登录态…」，**不能**直接放行 children：
 *     否则会用空身份闪一下后台界面，随后才被 401 弹走 —— 那一下会让人以为登录成功了；
 *  3. `/me` 成功 → 放行。
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { me } = useAdminAuth()
  const location = useLocation()

  if (getToken() === null || me.isError) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }
  if (me.isPending) {
    return <p className={styles.state}>正在校验登录态…</p>
  }
  return <>{children}</>
}
