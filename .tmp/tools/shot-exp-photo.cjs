/**
 * 「实习经历」照片位的截图（2026-10-16 换真实公司照片后看裁切）。
 *
 * 只截 [data-photo] 那块：全屏截图里这块只有几百像素高，裁掉哪里根本看不清，
 * 而这次的判断依据恰恰是「照片的哪一部分被 cover 切掉了」。
 * 另加一张整个 .switcher（判断左栏照片变矮后与右栏文字的整体关系）。
 *
 * 用法：node .tmp/tools/shot-exp-photo.cjs
 */
const { chromium } = require('playwright-core')

const BASE = 'http://127.0.0.1:8099'
const SHOTS = [
  ['exp-photo-1280', 1280, 900, 'light', '[data-photo]'],
  ['exp-photo-1024', 1024, 900, 'light', '[data-photo]'],
  ['exp-photo-768', 768, 900, 'light', '[data-photo]'],
  ['exp-photo-390', 390, 844, 'light', '[data-photo]'],
  ['exp-photo-1280-dark', 1280, 900, 'dark', '[data-photo]'],
  ['exp-block-1280', 1280, 900, 'light', 'section[data-full]'],
]

const main = async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  for (const [name, w, h, scheme, selector] of SHOTS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'center' }), selector)
    await page.waitForTimeout(900)
    const el = page.locator(selector).first()
    const out = `.tmp/tools/shot-${name}.png`
    await el.screenshot({ path: out })
    console.log(`✔ ${out}`)
    await ctx.close()
  }
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
