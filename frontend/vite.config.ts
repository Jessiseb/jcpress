import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    // 前端与后端**同源**：/api 一把代理过去（后端 context-path 就是 /api，不需要 rewrite）。
    // 上传的图片 URL 是 /api/uploads/... —— 也被这一条覆盖，不必单独再配。
    // 这样 dev 与生产（Nginx 同源）走同一种寻址方式，CORS 从根上不存在。
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
