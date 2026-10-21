// 「联系我」区块验收：GitHub 入口是否在、六条入口的排布与溢出情况。
const path = require('path')
const { chromium } = require('playwright-core')

const main = async () => {
  const b = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  for (const [w, h, tag] of [[1280, 1000, 'desktop'], [900, 900, 'tablet'], [390, 844, 'mobile']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } })
    const p = await ctx.newPage()
    await p.goto('http://127.0.0.1:8099/', { waitUntil: 'networkidle', timeout: 60000 })
    await p.waitForTimeout(800)
    const sec = p.locator('section[aria-labelledby="contact-title"]')
    await sec.scrollIntoViewIfNeeded()
    await p.waitForTimeout(500)

    const gh = p.locator('a[href="https://github.com/Jessiseb"]')
    const ghCount = await gh.count()
    const ghText = ghCount ? (await gh.first().innerText()).trim() : '(缺失)'
    const ghBox = ghCount ? await gh.first().boundingBox() : null

    const rows = p.locator('section[aria-labelledby="contact-title"] dl > div')
    const n = await rows.count()
    const labels = []
    for (let i = 0; i < n; i++) labels.push((await rows.nth(i).locator('dt').innerText()).trim())

    const primary = await p.locator('section[aria-labelledby="contact-title"] a[href^="tel:"]').first().boundingBox()

    const overflowX = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    // 单独检查区块内部有没有被撑破（整页没溢出不代表这里没裁）
    const secOverflow = await sec.evaluate((el) => el.scrollWidth - el.clientWidth)

    // 触摸目标：每行 ≥44（.line 与 .value 都是 44）
    const shortRows = []
    for (let i = 0; i < n; i++) {
      const box = await rows.nth(i).boundingBox()
      if (box.height < 44) shortRows.push(`${labels[i]}=${Math.round(box.height)}`)
    }

    console.log(
      `${tag} ${w}px | GitHub ${ghCount} 处「${ghText}」 ` +
        `${ghBox ? `h${Math.round(ghBox.height)}` : ''} | 入口 ${n} 条 [${labels.join(' ')}] ` +
        `| 号码顶部 ${Math.round(primary.y)} GitHub 顶部 ${ghBox ? Math.round(ghBox.y) : '-'} ` +
        `| 行高不足 ${shortRows.length ? shortRows.join(',') : '无'} | 横向溢出 ${overflowX} / 区块内 ${secOverflow}`,
    )

    if (tag !== 'mobile') await sec.screenshot({ path: path.resolve(__dirname, `contact-${tag}.png`) })
    await ctx.close()
  }
  await b.close()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
