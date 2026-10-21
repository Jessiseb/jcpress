/**
 * 「技术分享」整段截图：列表页 / 详情页 × 亮暗，另加一张窄屏。
 *
 * 为什么单独出一个：这段版面 2026-10-16 改成了「左栏目录 + 内容栏」，
 * 断点与三栏关系靠肉眼看截图确认最快（宽度、粘顶、当前项高亮、窄屏折叠）。
 *
 * 用法：node .tmp/tools/shot-tech.cjs
 */
const { chromium } = require('playwright-core')

const BASE = 'http://127.0.0.1:8099'
const SLUG = 'phase-3-backend-retro'

const SHOTS = [
  ['tech-list-light', '/tech', 'light', 1280],
  ['tech-list-dark', '/tech', 'dark', 1280],
  ['tech-detail-light', `/tech/${SLUG}`, 'light', 1280],
  ['tech-list-narrow', '/tech', 'light', 760],
]

const main = async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  for (const [name, path, scheme, width] of SHOTS) {
    const ctx = await browser.newContext({
      viewport: { width, height: 900 },
      colorScheme: scheme,
    })
    const page = await ctx.newPage()
    await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(900)
    const out = `.tmp/tools/shot-${name}.png`
    await page.screenshot({ path: out })
    console.log(`✔ ${out}`)
    await ctx.close()
  }
  await browser.close()
}

main().catch((error) => {
  console.error('截图失败：', error)
  process.exit(1)
})
