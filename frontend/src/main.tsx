import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import App from './App'

import './styles/tokens.curated.css' // 提取基线（证据，保持原样）
import './styles/theme.jcpress.css' // 本站品牌层：青碧 Teal + 移动端 token
import './styles/global.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const container = document.getElementById('root')
if (!container) throw new Error('#root not found')

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* Ant Design 只在后台用，主题桥放在 AdminLayout / AdminRouteFallback 里 ——
          挂在这里会让 antd 核心无条件进首屏包（实测首屏 gzip 122KB → 272KB） */}
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
