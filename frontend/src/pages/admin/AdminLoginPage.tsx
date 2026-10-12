import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { ApiError } from '@/api/client'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import styles from './admin.module.css'

interface FromState {
  from?: string
}

/**
 * 登录页。**不使用** AdminLayout 的外壳（未登录时没有「用户菜单 / 标签页」可谈），
 * 只复用同一份 CSS 的令牌层与登录卡。
 *
 * 两条约束：
 *  · 页面上不得出现 `<table>` / `<header>` —— `audit-behavior` 的三期#12 用的是
 *    「有没有表格 / 有没有公开站顶栏」来判断「后台已被弹到登录页且视觉隔离」；
 *  · 失败时把后端 `ApiError.message` 原样显示 —— 后端已经区分了「用户名或口令错误」与
 *    「失败次数过多，已锁定」，前端不该把这两句揉成一句笼统的「登录失败」。
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
    login.error instanceof ApiError
      ? login.error.message
      : login.error
        ? '登录失败，请稍后重试'
        : null

  return (
    <div className={`${styles.adminScope} ${styles.loginPage}`}>
      <form className={styles.loginCard} onSubmit={onSubmit}>
        <div className={styles.loginBrand}>
          <span className={styles.loginLogo} aria-hidden="true">
            JC
          </span>
          <span className={styles.loginName}>JCPress</span>
        </div>
        <h1 className={styles.loginTitle}>管理后台</h1>
        <p className={styles.loginSub}>登录后可撰写、发布与管理技术文章</p>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="admin-username">
            用户名
          </label>
          <input
            id="admin-username"
            className={styles.input}
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
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
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {errorMessage && <p className={styles.fieldError}>{errorMessage}</p>}

        <button
          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBlock}`}
          type="submit"
          disabled={login.isPending || username === '' || password === ''}
        >
          {login.isPending ? '登录中…' : '登录'}
        </button>

        <p className={styles.loginFoot}>JCPress Admin · 单作者站点，不开放注册</p>
      </form>
    </div>
  )
}
