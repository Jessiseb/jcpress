/**
 * 路由渲染体检：逐条访问前端路由，确认**没有 Vite 编译错误遮罩**、页面确实渲染出了内容。
 *
 * 为什么需要它：模块级失败（首读被系统拦、语法错、路径解析错）只在浏览器里表现为
 * 一个遮罩 + 白屏，而 接口测试 / 健康检查 / tsc / vitest 全都测不到 —— 2026-10-16
 * 就踩到一次：Vite 冷进程首次读取 `AdminArticleEditPage.tsx` 被 Windows Defender
 * 实时防护拦成 `EPERM: operation not permitted`，首页正常、只有后台编辑页弹遮罩。
 *
 * 与 `probe-vite-modules.cjs` 的分工：那个爬模块图（覆盖面全、但只证明"能编译"），
 * 这个走真实浏览器（只覆盖 5 条路由、但能证明"渲染得出来且没遮罩"）。
 *
 * 用法：node .tmp/tools/probe-route-render.cjs
 * 退出码：0 = 全通过；1 = 有路由异常
 */
const { chromium } = require('playwright-core')

const BASE = 'http://127.0.0.1:8099'
const PASSWORD = 'jcpress@2026'

/** [路径, 期望出现的选择器, 说明] —— 选择器用来证明"真的渲染了"，不只是没报错 */
const ROUTES = [
  ['/', null, '首页'],
  ['/tech', null, '技术分享列表'],
  ['/admin/login', '#admin-username', '后台登录页'],
  ['/admin/articles', 'table', '后台文章列表'],
  ['/admin/articles/1', '.cm-content', '后台文章编辑页'],
]

let failed = 0
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? `  (${detail})` : ''}`)
  if (!ok) failed++
}

const main = async () => {
  const loginRes = await fetch(`${BASE}/api/v1/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: PASSWORD }),
  })
  const loginBody = await loginRes.json()
  const token = loginBody?.data?.token
  if (!token) throw new Error(`登录失败：${JSON.stringify(loginBody).slice(0, 160)}`)

  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  context.addInitScript((t) => sessionStorage.setItem('jcpress.admin.token', t), token)
  const page = await context.newPage()

  // 收集所有失败的网络请求 —— 模块被拦会以 500 出现，正好落进这个网
  const badResponses = []
  page.on('response', (res) => {
    if (res.status() >= 400) badResponses.push(`${res.status()} ${res.url().replace(BASE, '')}`)
  })
  page.on('requestfailed', (req) => {
    badResponses.push(`FAILED ${req.url().replace(BASE, '')} ${req.failure()?.errorText || ''}`)
  })
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 140)))

  for (const [route, selector, label] of ROUTES) {
    console.log(`\n[${label}] ${route}`)
    badResponses.length = 0
    pageErrors.length = 0

    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(700)

    const state = await page.evaluate(() => {
      const overlay = document.querySelector('vite-error-overlay')
      return {
        hasOverlay: !!overlay,
        overlayText: overlay ? (overlay.shadowRoot?.textContent || '').slice(0, 200) : '',
        textLength: (document.body.innerText || '').length,
        rootFilled: (document.getElementById('root')?.childElementCount || 0) > 0,
      }
    })

    check('无 Vite 编译遮罩', !state.hasOverlay, state.overlayText.replace(/\s+/g, ' '))
    check('React 已挂载且有内容', state.rootFilled && state.textLength > 60, `正文 ${state.textLength} 字`)
    if (selector) {
      const found = await page.locator(selector).count()
      check(`渲染出 ${selector}`, found > 0, `找到 ${found} 个`)
    }
    check('无失败请求', badResponses.length === 0, badResponses.slice(0, 4).join(' | '))
    check('无未捕获异常', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))
  }

  await browser.close()
  console.log(`\n${failed === 0 ? '✓ 全部通过' : `✗ 共 ${failed} 项未通过`}`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('体检异常：', error)
  process.exit(1)
})
