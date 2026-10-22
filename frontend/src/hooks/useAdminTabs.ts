import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { ADMIN_HOME, ADMIN_HOME_TITLE, resolveAdminRoute } from '@/pages/admin/adminMenu'

const STORAGE_KEY = 'jcpress.admin.tabs'

export interface AdminTab {
  path: string
  title: string
  /** 常驻标签（文章列表）不可关 —— 全关掉就没地方落脚了 */
  closable: boolean
}

/** 常驻标签：第四期起是「数据看板」（跟 `ADMIN_HOME` 走，不再写死文章列表） */
const HOME_TAB: AdminTab = { path: ADMIN_HOME, title: ADMIN_HOME_TITLE, closable: false }

/**
 * 读回上次的标签。两层防御：
 *  · 存储里可能是别的版本写下的结构，逐条校验形状，不信任 `JSON.parse` 的结果；
 *  · 常驻标签必须存在 —— 万一存储里被删掉了，补回来。
 */
function readTabs(): AdminTab[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw === null) return [HOME_TAB]
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return [HOME_TAB]
    const tabs = parsed.filter((item): item is AdminTab => {
      if (typeof item !== 'object' || item === null) return false
      const candidate = item as Partial<AdminTab>
      return typeof candidate.path === 'string' && typeof candidate.title === 'string'
    })
    const home = tabs.find((tab) => tab.path === HOME_TAB.path)
    return [home ?? HOME_TAB, ...tabs.filter((tab) => tab.path !== HOME_TAB.path)]
  } catch {
    // 隐私模式下 sessionStorage 读写会抛；标签栏是便利功能，不该让它拖垮页面
    return [HOME_TAB]
  }
}

function writeTabs(tabs: AdminTab[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tabs))
  } catch {
    // 同上：写不进去就算了
  }
}

/** 登出时调用 —— 否则换个人登录会看到上一个人打开过哪些页面。 */
export function clearAdminTabs() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // 同上
  }
}

/**
 * 若依式多标签页。
 *
 * 刻意**不重置已有标签的顺序**：每次跳回来都把该标签挪到末尾的话，标签会随点击乱跳，
 * 反而找不到。新页面一律追加到末尾。
 */
export function useAdminTabs() {
  const location = useLocation()
  const navigate = useNavigate()
  const [tabs, setTabs] = useState<AdminTab[]>(readTabs)

  useEffect(() => {
    const meta = resolveAdminRoute(location.pathname)
    if (meta.title === '') return
    setTabs((prev) => {
      if (prev.some((tab) => tab.path === location.pathname)) return prev
      const next = [
        ...prev,
        { path: location.pathname, title: meta.title, closable: location.pathname !== HOME_TAB.path },
      ]
      writeTabs(next)
      return next
    })
  }, [location.pathname])

  const close = useCallback(
    (path: string) => {
      const index = tabs.findIndex((tab) => tab.path === path)
      if (index < 0) return
      const next = tabs.filter((tab) => tab.path !== path)
      writeTabs(next)
      setTabs(next)
      // 关掉的正是当前页 → 退到左边一个；左边没有（关的是第一个）就退到右边那个
      if (path === location.pathname) {
        const fallback = next[index - 1] ?? next[index] ?? HOME_TAB
        navigate(fallback.path)
      }
    },
    [tabs, location.pathname, navigate],
  )

  /** 关闭其他：只留常驻标签 + 指定的那一个。 */
  const closeOthers = useCallback((path: string) => {
    setTabs((prev) => {
      const kept = prev.find((tab) => tab.path === path)
      const next = [HOME_TAB, ...(kept && kept.path !== HOME_TAB.path ? [kept] : [])]
      writeTabs(next)
      return next
    })
  }, [])

  return { tabs, close, closeOthers }
}
