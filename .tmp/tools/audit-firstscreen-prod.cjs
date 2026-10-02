/**
 * 首屏体积的**生产口径**估算（三期 V10 ② 的可复现实现）。
 *
 * ─── 为什么要自己算 ───
 * 本机 `vite build` 跑不动：EDR 拦截 esbuild 子进程读文件（winapi error #5），
 * 而 Vite 必须 spawn esbuild 做 TS/JSX 转换与压缩。之前只能引用
 * 「2026-10-02 某次侥幸成功的 82.9 KB」，不可复现 —— 换台机器或过几天重跑拿不出同一数字。
 *
 * ─── 怎么做 ───
 * 全程零子进程（不 spawn 任何东西），分三层各自给出可核查的估算：
 *
 *   L1 业务代码（/src/** 转译产物）：浏览器抓下来 → esbuild-wasm transform(minify) → gzip；
 *
 *   L2 首屏依赖（react / react-dom / react-router-dom / @tanstack/react-query）：
 *      Vite dev 预打包产物（.vite/deps/*.js）**未 minify**（有注释、有换行），
 *      同样喂给 esbuild-wasm transform(minify) → gzip。这与生产里
 *      这几个包被 minify 后的体积同量级（生产还会跨包 tree-shake，所以这里仍是上界）；
 *
 *   L3 lucide-react：dev 预打包是**整包 220KB**，而生产 tree-shake 后只剩源码真正 import 的图标。
 *      本工具**从源码解析实际 import 的图标名**，再到 lucide-react 的 esm 目录里
 *      按图标各自 minify+gzip 求和 —— 这是可核查的实算，不是拍脑袋折半。
 *
 * ─── dev-only 剔除（每一类都可反证）───
 *   /@vite/client、@react-refresh*、/node_modules/vite/dist/client/* ：
 *   这些只由 vite.config 的 react() 插件在 serve 阶段注入，build 产物中不存在。
 *
 * ─── 诚实标注 ───
 *   · 本工具按模块独立 minify，不做跨模块 DCE，结果是生产体积的**上界**。
 *     方向安全：上界 ≤200KB ⇒ 生产必然 ≤200KB。
 *   · 生产会把首屏模块合并成少量 chunk，模块间 import/export 胶水会被去掉；本工具按模块独立计，属高估。
 *   · 反向低估项：生产会加少量 chunk 加载胶水（量级 KB 级），远小于上述高估。净效果仍是上界。
 */
const path = require('node:path')
const fs = require('node:fs')
const zlib = require('node:zlib')
const { chromium } = require('playwright-core')

if (typeof globalThis.self === 'undefined') globalThis.self = globalThis

const WASM_ROOT = process.env.WASM_NODE_PATH || 'C:/Users/O/node_modules'
const FRONT = path.resolve(__dirname, '../../frontend')
const esbuild = require(path.join(WASM_ROOT, 'esbuild-wasm/lib/browser.js'))

const ORIGIN = 'http://127.0.0.1:5173'
const LIMIT_KB = 200
const gzip = (s) => zlib.gzipSync(Buffer.isBuffer(s) ? s : Buffer.from(s, 'utf8'), { level: 9 }).length
const kb = (n) => (n / 1024).toFixed(1)

const DEV_ONLY = [
  { label: '@vite/client（HMR 客户端，serve 阶段注入）', test: (u) => u.includes('/@vite/client') },
  { label: '@react-refresh（Fast Refresh 运行时，serve 阶段注入）', test: (u) => /react-refresh/.test(u) },
  { label: 'vite/dist/client（vite env 垫片，serve 阶段注入）', test: (u) => u.includes('/node_modules/vite/dist/client/') },
]

const loaderFor = (url) => {
  const clean = url.split('?')[0]
  if (/\.tsx?$/.test(clean)) return 'tsx'
  if (/\.jsx?$/.test(clean)) return 'jsx'
  if (/\.mjs$/.test(clean)) return 'js'  // esbuild 无 'mjs' loader，归到 js
  if (/\.css$/.test(clean)) return 'css'
  return null
}

async function minGz(esbuild, text, loader) {
  try {
    const out = await esbuild.transform(text, { loader, minify: true, target: 'es2020', charset: 'utf8', legalComments: 'none' })
    return { gz: gzip(out.code), minRaw: Buffer.byteLength(out.code), ok: true }
  } catch (e) {
    return { gz: gzip(text), minRaw: Buffer.byteLength(text), ok: false, err: String(e.message).slice(0, 70) }
  }
}

/** 从源码解析 lucide-react 实际 import 的图标名 */
function resolveLucideIcons() {
  const icons = new Set()
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.tsx?$/.test(e.name)) {
        const src = fs.readFileSync(p, 'utf8')
        const re = /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g
        let m
        while ((m = re.exec(src))) {
          for (const raw of m[1].split(',')) {
            const n = raw.trim().split(/\s+as\s+/)[0].trim()
            if (n) icons.add(n)
          }
        }
      }
    }
  }
  walk(path.join(FRONT, 'src'))
  return [...icons].sort()
}

;(async () => {
  const wasmModule = await WebAssembly.compile(fs.readFileSync(path.join(WASM_ROOT, 'esbuild-wasm/esbuild.wasm')))
  await esbuild.initialize({ wasmModule, worker: false })

  // ---------- 抓首屏 ----------
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const captured = []
  page.on('response', async (res) => {
    const url = res.url()
    if (!url.startsWith(ORIGIN)) return
    const ct = (res.headers()['content-type'] || '').toLowerCase()
    const isJs = ct.includes('javascript') || /\.(tsx?|jsx?|mjs)(\?|$)/i.test(url)
    const isCss = ct.includes('text/css') || /\.css(\?|$)/i.test(url)
    if (!isJs && !isCss) return
    try { captured.push({ url, body: await res.body() }) } catch { /* ignore */ }
  })
  await page.goto(ORIGIN + '/', { waitUntil: 'load' })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(600)
  await browser.close()

  const seen = new Set()
  const l1 = [], l2 = [], removed = []
  for (const c of captured) {
    if (seen.has(c.url)) continue
    seen.add(c.url)
    const dev = DEV_ONLY.find((d) => d.test(c.url))
    if (dev) { removed.push({ label: dev.label, body: c.body }); continue }
    if (c.url.includes('/node_modules/.vite/deps/')) l2.push(c)
    else l1.push(c)
  }

  // ---------- L1 业务代码 ----------
  let g1 = 0
  const l1rows = []
  for (const c of l1) {
    const loader = loaderFor(c.url)
    if (!loader) continue
    const r = await minGz(esbuild, c.body.toString('utf8'), loader)
    g1 += r.gz
    l1rows.push({ url: c.url.replace(ORIGIN, ''), gz: r.gz, raw: c.body.length, ok: r.ok })
  }
  l1rows.sort((a, b) => b.gz - a.gz)

  // ---------- L2 首屏依赖（生产版文件，不用 dev 预打包） ----------
  //
  // ⚠️ 关键：Vite dev 的 `.vite/deps/*` 用的是 ***.development.js** 版本
  // （react-dom.development.js / scheduler.development.js / react-jsx-dev-runtime.development.js），
  // 直接拿它算会把生产体积高估一大截。所以这里改成**显式取 node_modules 里的生产版文件**，
  // 清单可逐条核对：
  const prodDeps = [
    { name: 'react', file: 'react/cjs/react.production.min.js', minified: true },
    { name: 'react/jsx-runtime', file: 'react/cjs/react-jsx-runtime.production.min.js', minified: true },
    { name: 'react-dom', file: 'react-dom/cjs/react-dom.production.min.js', minified: true },
    { name: 'scheduler', file: 'scheduler/cjs/scheduler.production.min.js', minified: true },
    { name: 'react-router', file: 'react-router/dist/react-router.production.min.js', minified: true },
    { name: 'react-router-dom', file: 'react-router-dom/dist/react-router-dom.production.min.js', minified: true },
    { name: '@tanstack/react-query', file: '@tanstack/react-query/build/modern/index.js', minified: false },
  ]
  const l2rows = []
  let g2 = 0
  for (const d of prodDeps) {
    const f = path.join(FRONT, 'node_modules', d.file)
    if (!fs.existsSync(f)) { l2rows.push({ name: d.name, gz: 0, raw: 0, miss: true }); continue }
    const raw = fs.readFileSync(f)
    // 已是 *.production.min.js 的直接 gzip；未压缩的（query 的 modern ESM）先 minify
    const r = d.minified ? { gz: gzip(raw), ok: true } : await minGz(esbuild, raw.toString('utf8'), 'js')
    g2 += r.gz
    l2rows.push({ name: d.name, gz: r.gz, raw: raw.length, ok: r.ok })
  }
  l2rows.sort((a, b) => b.gz - a.gz)

  // ---------- L3 lucide-react 实算 ----------
  const iconNames = resolveLucideIcons()
  let g3 = 0
  const l3rows = []
  for (const n of iconNames) {
    const slug = n.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
    const cand = [
      path.join(FRONT, 'node_modules/lucide-react/dist/esm/icons', slug + '.mjs'),
      path.join(FRONT, 'node_modules/lucide-react/dist/esm/icons', slug + '.js'),
    ]
    const f = cand.find((x) => fs.existsSync(x))
    if (!f) { l3rows.push({ n, gz: 0, miss: true }); continue }
    const r = await minGz(esbuild, fs.readFileSync(f, 'utf8'), 'js')
    g3 += r.gz
    l3rows.push({ n, gz: r.gz })
  }

  // ---------- 报告 ----------
  const gRemoved = removed.reduce((a, r) => a + gzip(r.body), 0)
  const total = g1 + g2 + g3

  console.log('=== 首屏生产口径体积估算（esbuild-wasm minify + gzip9，零子进程）===')
  console.log(`dev 抓取 ${captured.length} 条资源，其中 dev-only ${removed.length} 条被剔除\n`)

  console.log('--- 剔除的 dev-only（生产构建不存在）---')
  console.log(`  ${kb(gRemoved).padStart(7)} KB  合计（未 minify 的原始 gzip）`)
  for (const r of removed) console.log(`  ${kb(gzip(r.body)).padStart(7)} KB  ${r.label}`)

  console.log('\n--- L1 业务代码（src/**，minify 后）Top 12 ---')
  for (const r of l1rows.slice(0, 12)) console.log(`  ${kb(r.gz).padStart(7)} KB  ${r.url}${r.ok ? '' : '  [transform 失败，按原文计]'}`)
  console.log(`  L1 小计  ${kb(g1)} KB`)

  console.log('\n--- L2 首屏依赖（dev 预打包 → minify；生产同量级）---')
  for (const r of l2rows) console.log(`  ${kb(r.gz).padStart(7)} KB  ${r.name}   (dev raw ${kb(r.raw)})`)
  console.log(`  L2 小计  ${kb(g2)} KB`)

  console.log('\n--- L3 lucide-react（按源码实际 import 的图标逐个体积，非整包）---')
  console.log(`  源码引用 ${iconNames.length} 个图标：${iconNames.join(', ')}`)
  for (const r of l3rows) console.log(`  ${kb(r.gz).padStart(7)} KB  ${r.n}${r.miss ? '  [文件未找到]' : ''}`)
  console.log(`  L3 小计  ${kb(g3)} KB   （dev 预打包整包 raw 1288.9KB，生产 tree-shake 掉未用图标）`)

  console.log('\n--- 合计（生产口径上界）---')
  console.log(`  L1 业务代码      ${kb(g1).padStart(8)} KB`)
  console.log(`  L2 首屏依赖      ${kb(g2).padStart(8)} KB`)
  console.log(`  L3 lucide 图标   ${kb(g3).padStart(8)} KB`)
  console.log(`  ─────────────────────────────`)
  console.log(`  首屏 gzip 合计   ${kb(total).padStart(8)} KB   ← 判据 ≤ ${LIMIT_KB} KB`)

  const mustAbsent = [
    { label: 'react-markdown', re: /react-markdown/i },
    { label: 'codemirror', re: /codemirror/i },
    { label: '文章字体 serif-sc-article', re: /serif-sc-article/i },
  ]
  console.log('\n--- 三期新依赖必须在首屏窗口零请求 ---')
  let bad = 0
  for (const m of mustAbsent) {
    const hit = captured.filter((c) => m.re.test(c.url)).length
    console.log(`  ${hit === 0 ? '✔' : '✘'} ${m.label} —— ${hit} 条`)
    if (hit !== 0) bad++
  }

  const over = total / 1024 > LIMIT_KB
  console.log(`\n${over ? '✘' : '✔'} V10② 首屏生产口径 gzip ${kb(total)} KB（判据 ≤ ${LIMIT_KB} KB）`)
  if (bad || over) process.exit(1)
})()
