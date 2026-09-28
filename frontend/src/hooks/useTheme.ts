import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'jcpress-theme'

export type Theme = 'light' | 'dark'

function readInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  const attr = document.documentElement.getAttribute('data-theme')
  return attr === 'dark' ? 'dark' : 'light'
}

/**
 * 主题切换。初始值由 index.html 的内联脚本在首帧前写入 `data-theme`，
 * 这里只做「读取 + 切换」，不在首屏读 localStorage（规划 §5.2 预渲染约束）。
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* 隐私模式下 localStorage 不可写，忽略 */
    }
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggle }
}
