const { chromium } = require('playwright-core')

/**
 * 首屏体积门禁（三期 V10）。
 *
 * 为什么要单独做：`npm run build` 在本环境的沙箱里跑不动（esbuild 子进程读盘被拒，
 * `winapi error #5`）。但 V10 要验的是「首屏 chunk 不得包含 react-markdown / codemirror /
 * 文章字体」—— 这件事在 **dev server 的运行期**同样可判：Vite dev 按 ESM 逐模块请求，
 * 网络面板里出现的模块集合就等于该路由的依赖闭包。
 *
 * 判据：
 *  ① 首屏（/ 路由，不滚动、不点任何东西）加载的模块里，不得出现
 *     react-markdown / remark-* / rehype-* / codemirror / @codemirror / 详情页 chunk；
 *  ② 首屏加载的字体资源里，不得出现 serif-sc-article-*；
 *  ③ 反向对照：进 /tech/<slug> 详情页时，这些模块与文章字体**必须**出现
 *     （否则说明它们压根没接上，①② 是假绿）。
 */

const ORIGIN = 'http://127.0.0.1:5173'

const FORBIDDEN_IN_FIRST_SCREEN = [
  { label: 'react-markdown', re: /react-markdown/i },
  { label: 'remark-*', re: /remark-/i },
  { label: 'rehype-*', re: /rehype-/i },
  { label: 'codemirror', re: /codemirror/i },
  { label: '文章字体 serif-sc-article', re: /serif-sc-article/i },
]

const expectInDetail = [
  { label: 'react-markdown', re: /react-markdown/i },
  { label: '文章字体 serif-sc-article', re: /serif-sc-article/i },
]

/**
 * codemirror 是**后台编辑器**专属（只读的详情页不该有它）。
 * 所以反向对照要落到 `/admin/articles/:id` 上 —— 那里必须能拉到 codemirror，
 * 否则只能说明这个依赖压根没打包进去，前面的「首屏不含」就是假绿。
 * `/admin/articles/:id` 需要登录态，探针里先注入 token 再进。
 */
const expectInAdminEditor = [{ label: 'codemirror', re: /codemirror/i }]

async function collect(browser, path, { scroll = false, init = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  if (init) await ctx.addInitScript(init)
  const page = await ctx.newPage()
  const seen = new Set()
  page.on('request', (r) => seen.add(r.url()))
  await page.goto(`${ORIGIN}${path}`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(800)
  if (scroll) {
    await page.evaluate(async () => {
      document.documentElement.style.scrollBehavior = 'auto'
      const max = document.documentElement.scrollHeight - innerHeight
      for (let y = 0; y <= max; y += 400) {
        window.scrollTo(0, y)
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)))
      }
    })
    await page.waitForTimeout(800)
  }
  await ctx.close()
  return seen
}

/** 真实登录一次，拿回后台 token（反向对照要进受保护的编辑器页）。 */
async function loginForToken(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  // 必须先有一个页面上下文，fetch 的相对路径才有 base URL 可解析
  await page.goto(`${ORIGIN}/admin/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const token = await page.evaluate(async () => {
    const res = await fetch('/api/v1/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'jcpress@2026' }),
    })
    const json = await res.json()
    return json?.data?.token ?? json?.data?.tokenValue ?? null
  })
  await ctx.close()
  return token
}

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  let failures = 0

  // ---- ① 首屏（首页，不滚动）----
  const homeUrls = await collect(browser, '/', { scroll: false })
  console.log(`\n=== / 首屏（不滚动）请求 ${homeUrls.size} 条资源 ===`)
  for (const f of FORBIDDEN_IN_FIRST_SCREEN) {
    const hits = [...homeUrls].filter((u) => f.re.test(u))
    const ok = hits.length === 0
    if (!ok) failures++
    console.log(`  ${ok ? '✔' : '✘'} 不含 ${f.label}${ok ? '' : ` —— 命中 ${hits.length} 条：${hits.slice(0, 3).join(' | ')}`}`)
  }

  // ---- ② 反向对照：详情页必须把这些拉起来 ----
  const detailUrls = await collect(browser, '/tech/phase-3-backend-retro')
  console.log(`\n=== /tech/phase-3-backend-retro 请求 ${detailUrls.size} 条资源 ===`)
  for (const f of expectInDetail) {
    const hits = [...detailUrls].filter((u) => f.re.test(u))
    const ok = hits.length > 0
    if (!ok) failures++
    console.log(`  ${ok ? '✔' : '✘'} 反向对照：详情页**应当**加载 ${f.label}${ok ? ` —— ${hits.length} 条` : ' —— 一条都没有，说明根本没接上'}`)
  }

  // ---- ③ 反向对照：后台编辑器必须能拉到 codemirror ----
  const token = await loginForToken(browser)
  if (!token) {
    failures++
    console.log('\n✘ 拿不到后台 token，后台编辑器反向对照无法进行')
  } else {
    // addInitScript 在页面脚本之前跑，把登录态直接塞进 sessionStorage
    const withToken = new Function(
      't',
      `sessionStorage.setItem('jcpress.admin.token', ${JSON.stringify(token)})`,
    )

    const listUrls = await collect(browser, '/admin/articles', { init: withToken })
    console.log(`\n=== /admin/articles（带 token）请求 ${listUrls.size} 条资源 ===`)

    const editorUrls = await collect(browser, '/admin/articles/1', { init: withToken })
    console.log(`\n=== /admin/articles/1（带 token）请求 ${editorUrls.size} 条资源 ===`)
    for (const f of expectInAdminEditor) {
      const hits = [...editorUrls].filter((u) => f.re.test(u))
      const ok = hits.length > 0
      if (!ok) failures++
      console.log(
        `  ${ok ? '✔' : '✘'} 反向对照：后台编辑器**应当**加载 ${f.label}${ok ? ` —— ${hits.length} 条` : ' —— 一条都没有'}`,
      )
    }

    // 详情页是**只读展示**，不该有 codemirror（这条曾经是我写错的判据，留在这里防止回退）
    const cmInDetail = [...detailUrls].filter((u) => /codemirror/i.test(u))
    const okDetail = cmInDetail.length === 0
    if (!okDetail) failures++
    console.log(`  ${okDetail ? '✔' : '✘'} 详情页（只读）不含 codemirror 编辑器${okDetail ? '' : ` —— ${cmInDetail.length} 条`}`)
  }

  // ---- ④ 首页（滚到底）也不该拉详情页的编辑器 ----
  const homeScrolled = await collect(browser, '/', { scroll: true })
  console.log(`\n=== / 滚到底 ${homeScrolled.size} 条资源 ===`)
  {
    const hits = [...homeScrolled].filter((u) => /codemirror|react-markdown/i.test(u))
    const ok = hits.length === 0
    if (!ok) failures++
    console.log(`  ${ok ? '✔' : '✘'} 首页滚到底仍不含 编辑器/Markdown 渲染器${ok ? '' : ` —— ${hits.slice(0, 3).join(' | ')}`}`)
  }

  await browser.close()
  console.log(failures === 0 ? '\n✔ V10 首屏体积：全部通过' : `\n✘ V10 未达标 ${failures} 项`)
  process.exit(failures > 0 ? 1 : 0)
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
