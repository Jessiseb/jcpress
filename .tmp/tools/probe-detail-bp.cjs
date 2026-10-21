const { chromium } = require('playwright-core')
const main = async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  for (const width of [1080, 1079, 1024, 768]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } })
    const page = await ctx.newPage()
    await page.goto('http://127.0.0.1:8099/tech/java-thread-basics', { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)
    const m = await page.evaluate(() => {
      const prose = document.querySelector('[class*="prose"]')
      const p = prose.querySelector('p')
      const rail = document.querySelector('nav[aria-label="技术分享目录"]')
      const toc = document.querySelector('nav[aria-label="本页目录"]')
      const vis = (el) => (el ? el.getBoundingClientRect().width > 0 : false)
      return {
        proseW: Math.round(prose.getBoundingClientRect().width),
        chars: +(p.clientWidth / parseFloat(getComputedStyle(p).fontSize)).toFixed(1),
        railVisible: vis(rail),
        tocVisible: vis(toc),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }
    })
    console.log(String(width).padStart(5), JSON.stringify(m))
    await page.screenshot({ path: `.tmp/tools/bp-${width}.png` })
    await ctx.close()
  }
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
