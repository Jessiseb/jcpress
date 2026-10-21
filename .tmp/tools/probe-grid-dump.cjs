/** 一次性探针：dump 首页 section 直接子元素的栅格位置，以及 /tech 上 aside 的来源。 */
const { chromium } = require('playwright-core')
const BASE = 'http://127.0.0.1:8099'

const main = async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })

  const home = await ctx.newPage()
  await home.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 })
  await home.waitForTimeout(900)
  const dump = await home.evaluate(() =>
    Array.from(document.querySelectorAll('section')).map((s, i) => ({
      i,
      cls: s.className,
      kids: Array.from(s.children).map((c) => ({
        tag: c.tagName,
        cls: String(c.className).slice(0, 40),
        left: Math.round(c.getBoundingClientRect().left),
      })),
    })),
  )
  console.log(JSON.stringify(dump, null, 1).slice(0, 3000))

  const list = await ctx.newPage()
  await list.goto(`${BASE}/tech`, { waitUntil: 'networkidle', timeout: 60000 })
  await list.waitForTimeout(600)
  const asides = await list.evaluate(() =>
    Array.from(document.querySelectorAll('aside')).map((a) => ({
      cls: String(a.className).slice(0, 40),
      html: a.outerHTML.slice(0, 90),
    })),
  )
  console.log('\n=== /tech 上的 aside ===')
  console.log(JSON.stringify(asides, null, 1))

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
