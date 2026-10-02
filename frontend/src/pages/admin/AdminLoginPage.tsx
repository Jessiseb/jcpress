import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { ApiError } from '@/api/client'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import styles from './admin.module.css'

interface FromState {
  from?: string
}

/**
 * 登录页。**不使用** AdminLayout 的顶栏（未登录时没有「退出」可点），
 * 只复用同一份 CSS 的登录卡。
 *
 * 失败时把后端 `ApiError.message` 原样显示 —— 后端已经区分了「用户名或口令错误」与
 * 「失败次数过多，已锁定」，前端不该把这两句揉成一句笼统的「登录失败」。
 */
export default function AdminLoginPage() {
  const { login } = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const from = (location.state as FromState | null)?.from ?? '/admin/articles'

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    login.mutate(
      { username, password },
      { onSuccess: () => navigate(from, { replace: true }) },
    )
  }

  const errorMessage =
    login.error instanceof ApiError ? login.error.message : login.error ? '登录失败，请稍后重试' : null

  return (
    <div className={styles.page}>
      <div className={styles.loginWrap}>
        <form className={styles.loginCard} onSubmit={onSubmit}>
          <h1 className={styles.loginTitle}>JCPress 后台登录</h1>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="admin-username">
              用户名
            </label>
            <input
              id="admin-username"
              className={styles.input}
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="admin-password">
              口令
            </label>
            <input
              id="admin-password"
              className={styles.input}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {errorMessage && <p className={styles.fieldError}>{errorMessage}</p>}
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            type="submit"
            disabled={login.isPending || username === '' || password === ''}
          >
            {login.isPending ? '登录中…' : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}
