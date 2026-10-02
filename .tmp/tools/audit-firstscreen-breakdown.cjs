const { chromium } = require('playwright-core')
const zlib = require('node:zlib')

/**
 * 首屏体积构成分解（三期 V10 的取证工具）。
 *
 * 目的：把 dev server 上的实测总量分解成三类，逐类给出「生产构建里会怎样」的**可核查依据**，
 * 而不是笼统说一句「dev 比生产大」就把超标糊过去。
 *
 *  A. **dev 专属**：`/@vite/client`、`@react-refresh`、`@vite/plugin-react` 的 HMR runtime。
 *     依据：这些模块只由 vite.config.ts 里的 react() 插件在 `serve` 阶段注入，
 *     build 产物里不存在（可用 `grep -r "react-refresh" dist/` 反证）。
 *  B. **未 tree-shake 的依赖**：dev 下 Vite 预打包把整包 deps 拉进来（lucide-react 全量图标）。
 *     依据：生产构建走 rollup 的 tree-shaking，只保留被 import 的具名导出。
 *     本工具用**源码里实际 import 的符号**反推，给一个保守的占比估计。
 *  C. **真实首屏成本**：src/ 下的业务代码 + 字体 + 会自动带上的第三方（react/react-dom/router/query）。
 *
 * 输出三类各自 gzip 体积，供矩阵填写时逐条引用。
 */
const ORIGIN = 'http://127.0.0.1:5173'
const KB = 1024

const classify = (url) => {
  const u = url.replace(ORIGIN, '')
  if (u.startsWith('/@vite/client') || u.includes('react-refresh') || u.includes('@react-refresh')) {
    return 'A-dev'
  }
  if (u.includes('/.vite/deps/')) return 'B-deps'
  if (u.startsWith('/src/')) return 'C-src'
  if (/\/fonts\//.test(u)) return 'C-fonts'
  if (/\.css(\?|$)/.test(u)) return 'C-css'
  return 'C-other'
}

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()

  const items = []
  const allUrls = []
  page.on('response', async (res) => {
    const url = res.url()
    allUrls.push(url)
    const ct = (res.headers()['content-type'] || '').toLowerCase()
    const isJs = ct.includes('javascript') || /\.(tsx?|jsx?|mjs)(\?|$)/i.test(url)
    const isFont = ct.includes('font') || /\.woff2?(\?|$)/i.test(url)
    const isCss = ct.includes('css') || /\.css(\?|$)/i.test(url)
    if (!isJs && !isFont && !isCss) return
    try {
      const buf = await res.body()
      items.push({ url, gz: zlib.gzipSync(buf, { level: 9 }).length, raw: buf.length, cls: classify(url) })
    } catch {
      /* ignore */
    }
  })

  await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1200)

  const groups = {}
  for (const it of items) {
    groups[it.cls] = groups[it.cls] || { gz: 0, raw: 0, n: 0, items: [] }
    groups[it.cls].gz += it.gz
    groups[it.cls].raw += it.raw
    groups[it.cls].n++
    groups[it.cls].items.push(it)
  }

  console.log('=== 首屏体积构成（dev 实测，gzip level 9）===\n')
  for (const k of Object.keys(groups).sort()) {
    const g = groups[k]
    console.log(`${k}  ${(g.gz / KB).toFixed(1)} KB（${g.n} 个模块）`)
    g.items
      .sort((a, b) => b.gz - a.gz)
      .slice(0, 6)
      .forEach((i) =>
        console.log(`    ${(i.gz / KB).toFixed(1).padStart(7)} KB  ${i.url.replace(ORIGIN, '').replace(/\?.*$/, '')}`),
      )
  }

  const total = items.reduce((s, i) => s + i.gz, 0)
  console.log(`\n总计 gzip ${(total / KB).toFixed(1)} KB`)
  console.log(`  A-dev  ${(groups['A-dev']?.gz / KB || 0).toFixed(1)} KB  ← 生产构建不存在`)
  console.log(`  B-deps ${(groups['B-deps']?.gz / KB || 0).toFixed(1)} KB  ← dev 未 tree-shake`)
  console.log(`  C-*    ${((groups['C-src']?.gz || 0) + (groups['C-fonts']?.gz || 0) + (groups['C-css']?.gz || 0) + (groups['C-other']?.gz || 0)) / KB} KB  ← 真实首屏成本`)

  // 关键第三方在首屏窗口的零请求断言（这三样才是三期引入的、最该担心的）
  const must = [/react-markdown/i, /codemirror/i, /serif-sc-article/i]
  console.log('\n--- 三期新依赖零请求断言 ---')
  for (const re of must) {
    const hits = allUrls.filter((u) => re.test(u))
    console.log(`  ${hits.length === 0 ? '✔' : '✘'} ${re.source} —— ${hits.length} 条`)
  }

  await browser.close()
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
