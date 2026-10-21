/**
 * 截「后端挂了」的三处错误态：/tech 列表、文章详情、首页「最新技术分享」。
 *
 * 手法：静态产物由 vite preview（5175）提供，`/api/**` 全部用 route 拦成 502
 * 并回 HTML 错误页 —— 这正是 nginx 在后端进程挂掉时给浏览器的那一坨
 * （`proxy_pass` 连不上 → nginx 自己的 502 页面）。比「不拦、让它 404」更接近真实。
 */
const { chromium } = require('playwright-core')
const path = require('path')
const fs = require('fs')

const OUT = process.argv[2]
const BASE = process.argv[3] || 'http://127.0.0.1:5175'

const cases = [
  { name: 'tech-list', url: '/tech', w: 1280, h: 900, scheme: 'light' },
  { name: 'tech-list-mobile', url: '/tech', w: 390, h: 844, scheme: 'light' },
  { name: 'article', url: '/tech/java-string-pool', w: 1280, h: 900, scheme: 'light' },
  { name: 'home', url: '/', w: 1280, h: 900, scheme: 'light' },
  { name: 'home-dark', url: '/', w: 390, h: 844, scheme: 'dark' },
]

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })

  for (const c of cases) {
    const ctx = await browser.newContext({
      viewport: { width: c.w, height: c.h },
      colorScheme: c.scheme,
      deviceScaleFactor: 2,
    })
    const page = await ctx.newPage()
    await page.route('**/api/**', (route) =>
      route.fulfill({
        status: 502,
        contentType: 'text/html',
        body: '<html><head><title>502 Bad Gateway</title></head><body><h1>502 Bad Gateway</h1></body></html>',
      }),
    )
    await page.goto(BASE + c.url, { waitUntil: 'domcontentloaded' })
    // 等错误态出现（query 默认 retry:1，会先失败一次再重试）
    await page.waitForSelector('[role="alert"]', { timeout: 15000 }).catch(() => null)
    await page.waitForTimeout(900)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(300)

    await page.screenshot({ path: path.join(OUT, c.name + '.png') })
    const text = await page.evaluate(
      () => document.querySelector('[role="alert"]')?.innerText?.replace(/\n+/g, ' | ') ?? '(no alert)',
    )
    console.log(c.name.padEnd(18), '→', text)
    await ctx.close()
  }

  await browser.close()
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
