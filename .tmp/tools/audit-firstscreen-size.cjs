const { chromium } = require('playwright-core')
const zlib = require('node:zlib')

/**
 * 首屏体积实测（三期 V10 的量化判据：首屏 gzip ≤200KB）。
 *
 * 本环境 `vite build` 跑不动（esbuild 子进程读盘被拒，winapi error #5），
 * 所以改为**实测 dev server 的首屏传输**：
 *
 *  Vite dev 的特点是「按 ESM 逐模块请求」，每个模块返回的都是**转换后**的 JS。
 *  这恰好等价于 Vite 生产构建里「首屏静态 chunk」的模块集合 —— 因为 lazy() 的
 *  动态 import 只有在路由真正被访问时才会发请求。
 *
 *  所以：打开 `/`，**不滚动、不点任何东西**，把首屏期间发出的所有 `.tsx/.ts/.js`
 *  模块响应体抓下来，做 gzip（level 9）累加。这个数字是**真实传输量的上界**
 *  （dev 不做 minify 也不 tree-shake，比生产产物大），判据方向安全：
 *  只要它 ≤200KB，生产构建必然 ≤200KB。
 *
 *  ⚠️ 只统计「首屏窗口」内发出的模块：用 `domcontentloaded` + 网络静默作为截止点，
 *  并且**显式排除** react-markdown / codemirror / 文章字体 —— 这三样是三期新引入的、
 *  最可能被误打包进首屏的依赖，必须单独确认它们在首屏窗口内**零请求**。
 */
const ORIGIN = 'http://127.0.0.1:5173'
const LIMIT_KB = 200

const mustBeAbsent = [
  { label: 'react-markdown', re: /react-markdown/i },
  { label: 'codemirror', re: /codemirror/i },
  { label: '文章字体 serif-sc-article', re: /serif-sc-article/i },
]

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()

  const moduleBodies = [] // { url, body }
  const allUrls = []

  page.on('response', async (res) => {
    const url = res.url()
    allUrls.push(url)
    const ct = (res.headers()['content-type'] || '').toLowerCase()
    const isJs = ct.includes('javascript') || /\.(tsx?|jsx?|mjs)(\?|$)/i.test(url)
    const isFont = ct.includes('font') || /\.woff2?(\?|$)/i.test(url)
    if (!isJs && !isFont) return
    try {
      const buf = await res.body()
      moduleBodies.push({ url, body: buf, isFont, ct })
    } catch {
      /* 304 / 已释放的响应体忽略 */
    }
  })

  await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle', timeout: 60000 })
  // 再等一小会儿，确保 React 水合期间发出的懒加载也计进来
  await page.waitForTimeout(1200)

  const KB = 1024
  let rawTotal = 0
  let gzTotal = 0
  const big = []

  for (const m of moduleBodies) {
    rawTotal += m.body.length
    const gz = zlib.gzipSync(m.body, { level: 9 }).length
    gzTotal += gz
    big.push({ url: m.url, raw: m.body.length, gz })
  }
  big.sort((a, b) => b.gz - a.gz)

  console.log(`=== 首屏（/ 不滚动）实用模块响应 ${moduleBodies.length} 条，总请求 ${allUrls.length} 条 ===`)
  console.log('--- gzip 体积 Top 12 ---')
  big.slice(0, 12).forEach((b) => {
    const short = b.url.replace(ORIGIN, '').replace(/\?.*$/, '')
    console.log(`  ${(b.gz / KB).toFixed(1).padStart(8)} KB  ${short}`)
  })

  console.log(
    `\n首屏 raw ${(rawTotal / KB).toFixed(1)} KB → gzip ${(gzTotal / KB).toFixed(1)} KB（判据 ≤${LIMIT_KB}KB）`,
  )

  let failures = 0
  console.log('\n--- 三期新依赖必须在首屏窗口零请求 ---')
  for (const f of mustBeAbsent) {
    const hits = allUrls.filter((u) => f.re.test(u))
    const ok = hits.length === 0
    if (!ok) failures++
    console.log(`  ${ok ? '✔' : '✘'} ${f.label}${ok ? ' 零请求' : ` —— 命中 ${hits.length} 条：${hits.slice(0, 2).join(' | ')}`}`)
  }

  const sizeOk = gzTotal / KB <= LIMIT_KB
  if (!sizeOk) failures++
  console.log(`  ${sizeOk ? '✔' : '✘'} 首屏 gzip ≤ ${LIMIT_KB}KB`)

  await browser.close()
  console.log(failures === 0 ? '\n✔ V10 首屏体积实测：全部通过' : `\n✘ V10 未达标 ${failures} 项`)
  process.exit(failures > 0 ? 1 : 0)
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
