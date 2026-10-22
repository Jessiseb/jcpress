import { App as AntdApp, ConfigProvider, theme as antdTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { useEffect, useState } from 'react'

/**
 * Ant Design 的主题桥（第四期改用组件库后新增）。
 *
 * 站内**只有一个主题真相**：`<html data-theme>`。它由 index.html 的首帧脚本写入、
 * 由 `useTheme()` 切换。所以这里不另起一个 React 状态去「记住」主题，而是监听这个
 * 属性 —— 两套状态同步的问题从根上不存在。
 *
 * 令牌映射的取舍：
 * · 只映射 `colorPrimary` / `borderRadius` / 字体，其余交给 antd 的 default / dark 算法。
 *   手写几十个 token 去「像本站」，维护成本高且一升级就跑偏；
 * · 前台与后台的主色不同（前台 accent #096fdc、后台 #1a6fc4），用 `variant` 区分，
 *   后台那层在 AdminLayout / AdminRouteFallback 里再包一次即可。
 */
function readTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

function useDocumentTheme(): 'light' | 'dark' {
  const [current, setCurrent] = useState<'light' | 'dark'>(readTheme)

  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return
    const observer = new MutationObserver(() => setCurrent(readTheme()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  return current
}

export interface AntdProviderProps {
  /** admin：后台主色与圆角；site：公开站（默认） */
  variant?: 'site' | 'admin'
  children: React.ReactNode
}

export function AntdProvider({ variant = 'site', children }: AntdProviderProps) {
  const mode = useDocumentTheme()

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: variant === 'admin' ? '#1a6fc4' : '#096fdc',
          borderRadius: 6,
          fontSize: 14,
          fontFamily: 'inherit',
        },
      }}
    >
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  )
}
