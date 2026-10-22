import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { reportPageView } from '@/api/stats'

/**
 * 把当前 pathname 规范化成上报用的路径；返回 null 表示这条不该上报。
 *
 * 规则（spec `stats-collection`）：
 * · 剥 query 与 hash —— `/tech?tag=java` 与 `/tech` 是同一页；
 * · 去掉末尾斜杠（根路径除外）；
 * · `/admin` 及其子路径不上报 —— 站主自己翻后台不该算进「访客」。
 *
 * 服务端还会再做一遍同样的规范化（不信任客户端），这里做的意义是让
 * 「同一页只产生一种 key」这件事在源头也成立。
 */
export function normalizeVisitPath(raw: string): string | null {
  if (typeof raw !== 'string') return null
  let path = raw.trim()
  const cut = path.search(/[?#]/)
  if (cut >= 0) {
    path = path.slice(0, cut)
  }
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1)
  }
  if (!path.startsWith('/')) return null
  if (path === '/admin' || path.startsWith('/admin/')) return null
  return path
}

/**
 * 路由级访问采集。挂一次即可（App 根组件）。
 *
 * 依赖只写 `pathname`：query 变了但路径没变时**不重复上报** —— 筛选、翻页在
 * `/tech?page=2` 这种形式上就是同一页的视图变化，记成两次访问会把热门页面灌满。
 *
 * 注意 React 18 的 StrictMode 在开发环境会把 effect 跑两遍（本地看到的 PV 是 2 倍），
 * 生产构建不会。不为此加「已上报过」的模块级缓存：那会让「回到同一页」永远记不上，
 * 属于用真问题换假问题。
 */
export function usePageView(): void {
  const { pathname } = useLocation()

  useEffect(() => {
    const path = normalizeVisitPath(pathname)
    if (path === null) return
    reportPageView(path)
  }, [pathname])
}
