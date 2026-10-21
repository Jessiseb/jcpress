const { chromium } = require('playwright-core')
const main = async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 900 } })
  const page = await ctx.newPage()
  await page.goto('http://127.0.0.1:8099/tech/java-thread-basics', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: /目录/ }).click()
  await page.waitForTimeout(300)
  const m = await page.evaluate(() => {
    const toc = document.querySelector('nav[aria-label="本页目录"]')
    const cat = document.querySelector('nav[aria-label="技术分享目录"]')
    const r = (el) => (el ? Math.round(el.getBoundingClientRect().top) : null)
    return { tocVisible: !!toc, tocTop: r(toc), catTop: r(cat), catVisible: !!cat }
  })
  console.log(JSON.stringify(m))
  await page.screenshot({ path: '.tmp/tools/rail-open-1024.png' })
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
