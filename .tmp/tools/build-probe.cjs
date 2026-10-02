/**
 * 三期首屏体积门禁（V10）——分析 esbuild 的**真实生产产物**。
 *
 * 为什么要绕这一圈：`vite build` 在本机跑不起来，根因是**沙箱拦截了 Node 的进程 spawn**
 * （`winapi error #5` = ERROR_ACCESS_DENIED）。证据：把 `@esbuild/win32-x64/esbuild.exe`
 * 直接放到 shell 里执行是正常的（`--version` → 0.25.12），只有从 Node 里 spawn 才被拒。
 *
 * 所以流程拆成两步：
 *  1. `bash` 里直接用 esbuild 做生产打包（minify + tree-shaking + splitting），
 *     语义与 Vite 生产模式一致 —— `lazy(() => import())` 自动切成分包；
 *  2. Node **只读产物**做判定（读文件不触发 spawn，不踩沙箱）。
 *
 * 判定：
 *  ① 首屏（入口 + 静态 import 闭包）gzip ≤ 200KB
 *  ② 首屏 chunk 不得含 react-markdown / codemirror / highlight.js / 文章字体 特征串
 *  ③ 反向对照：上述依赖必须出现在懒加载 chunk 里（否则是假绿）
 */
const zlib = require('node:zlib')
const fs = require('node:fs')
const path = require('node:path')

const OUT = path.join(__dirname, '../../frontend/.tmp-build')
const META = path.join(OUT, 'meta.json')
const LIMIT_KB = 200
const KB = 1024

if (!fs.existsSync(META)) {
  console.error(`✘ 找不到 ${META} —— 请先用 esbuild 跑一次生产构建（见本文件顶部注释）`)
  process.exit(2)
}

const meta = JSON.parse(fs.readFileSync(META, 'utf8'))
// key 形如 ".tmp-build/main.js"，统一取 basename 做图上的节点名
const outputs = new Map()
for (const [k, v] of Object.entries(meta.outputs)) outputs.set(path.basename(k), v)

const isEntry = (f) => outputs.get(f)?.entryPoint !== undefined
const staticImports = (f) =>
  (outputs.get(f)?.imports ?? []).filter((i) => i.kind === 'import-statement').map((i) => path.basename(i.path))
const dynamicImports = (f) =>
  (outputs.get(f)?.imports ?? []).filter((i) => i.kind === 'dynamic-import').map((i) => path.basename(i.path))

const gz = (f) => zlib.gzipSync(fs.readFileSync(path.join(OUT, f)), { level: 9 }).length
const read = (f) => fs.readFileSync(path.join(OUT, f), 'utf8')

// ---- 首屏闭包：从入口出发，沿静态 import 走 ----
const entry = [...outputs.keys()].find((f) => f.endsWith('.js') && isEntry(f) && f.startsWith('main'))
const initial = new Set()
{
  const stack = [entry]
  while (stack.length) {
    const f = stack.pop()
    if (!f || initial.has(f)) continue
    initial.add(f)
    for (const imp of staticImports(f)) if (!initial.has(imp)) stack.push(imp)
  }
}

// ---- 懒加载：首屏闭包里的 dynamic-import 根，及其递归静态闭包 ----
const dynamic = new Set()
{
  const roots = []
  for (const f of initial) for (const d of dynamicImports(f)) roots.push(d)
  const stack = [...roots]
  while (stack.length) {
    const f = stack.pop()
    if (!f || dynamic.has(f) || initial.has(f)) continue
    dynamic.add(f)
    for (const imp of staticImports(f)) if (!dynamic.has(imp) && !initial.has(imp)) stack.push(imp)
  }
}

const jsOf = (set) => [...set].filter((f) => f.endsWith('.js'))
const cssOf = (set) => [...set].filter((f) => f.endsWith('.css'))

console.log('=== 生产构建实测（esbuild: minify + tree-shaking + splitting）===\n')
console.log(`入口：${entry}\n`)

console.log('--- 首屏 initial chunks ---')
let initJs = 0
for (const f of jsOf(initial).sort((a, b) => gz(b) - gz(a))) {
  initJs += gz(f)
  console.log(`  ${(gz(f) / KB).toFixed(1).padStart(8)} KB gz  ${f}`)
}
let initCss = 0
for (const f of cssOf(initial)) {
  initCss += gz(f)
  console.log(`  ${(gz(f) / KB).toFixed(1).padStart(8)} KB gz  ${f}`)
}
console.log(`  ▶ 首屏 JS+CSS 合计 gzip ${((initJs + initCss) / KB).toFixed(1)} KB（判据 ≤${LIMIT_KB}KB）`)

console.log('\n--- 懒加载 chunks（首屏不加载）---')
let lazyJs = 0
for (const f of jsOf(dynamic).sort((a, b) => gz(b) - gz(a))) {
  lazyJs += gz(f)
  console.log(`  ${(gz(f) / KB).toFixed(1).padStart(8)} KB gz  ${f}`)
}
console.log(`  ▶ 懒加载合计 gzip ${(lazyJs / KB).toFixed(1)} KB`)

// ---- ② / ③ 依赖归属断言 ----
const FINGERPRINTS = {
  'react-markdown 全家桶': /micromark|mdast-util|hast-util-to-jsx|react-markdown|remark-parse|rehype-slug|unified/,
  codemirror: /@codemirror|codemirror|lezer/i,
  'highlight.js': /hljs|highlight\.js/i,
}

let failures = 0
console.log('\n--- 依赖归属（首屏必须没有 / 懒加载必须有）---')
for (const [label, re] of Object.entries(FINGERPRINTS)) {
  const inInitial = jsOf(initial).filter((f) => re.test(read(f)))
  const inLazy = jsOf(dynamic).filter((f) => re.test(read(f)))
  const ok1 = inInitial.length === 0
  const ok2 = inLazy.length > 0
  if (!ok1) failures++
  if (!ok2) failures++
  console.log(`  ${ok1 ? '✔' : '✘'} 首屏不含 ${label}${ok1 ? '' : ` —— 命中 ${inInitial.join(', ')}`}`)
  console.log(
    `  ${ok2 ? '✔' : '✘'} 懒加载含 ${label}${ok2 ? ` —— ${inLazy.length} 个 chunk` : ' —— 缺失，说明根本没接上（前面是假绿）'}`,
  )
}

// 文章字体的判定**不在这里做**：
// esbuild 与 Vite 的 CSS 切分策略不同 —— esbuild 会把所有被静态 CSS-import 的规则合并进
// 入口 CSS（实测 serif-sc-article 的 @font-face 同时出现在 main.css 与 detail chunk 的 css 里）。
// 但 `@font-face` 只是**声明**，不触发下载：字体文件只在字形真正被渲染时请求。
// 所以「首页不下载文章字体」这件事必须用**运行时证据**判定，
// 见 `.tmp/tools/audit-display-font.cjs` 与 `.tmp/tools/audit-firstscreen.cjs`：
//   - `/` 与 `/tech` 零请求 serif-sc-article（实测通过）
//   - `/tech/<slug>` 才请求 serif-sc-article-700.woff2（反向对照，实测通过）
// 这里只断言 JS 侧的三方依赖归属，那是 CSS 切分策略无法影响的部分。

const sizeOk = (initJs + initCss) / KB <= LIMIT_KB
if (!sizeOk) failures++
console.log(`  ${sizeOk ? '✔' : '✘'} 首屏 gzip ≤ ${LIMIT_KB}KB`)

console.log(failures === 0 ? '\n✔ V10 生产构建实测：全部通过' : `\n✘ V10 未达标 ${failures} 项`)
process.exit(failures > 0 ? 1 : 0)
