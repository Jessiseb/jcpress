const { chromium } = require('playwright-core')

/**
 * 环周期校准探针：同一区域，分别把 --ds-ring-period 设成 9 / 24 / 46px 各拍一张裁图。
 * 用途：判断 1:1 渲染下环的真实间距，以及 7–9px 是否与像素网格打架（摩尔纹）。
 * 结果看图决定最终取值，并把结论回写 docs/design-visual-language.md §2.1。
 */
;(async () => {
  const out = process.argv[2] || 'C:/Users/O/Desktop/myproject/jcpress/.tmp/ring-v1'
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })

  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
    const page = await ctx.newPage()
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 60000 })
    // 静态版式：摘掉入场隐藏态，否则拍到的是淡入中间态
    await page.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t)
      document.documentElement.removeAttribute('data-reveal')
    }, theme)
    await page.waitForTimeout(300)

    for (const period of ['9px', '24px', '46px']) {
      await page.evaluate((p) => {
        document.documentElement.style.setProperty('--ds-ring-period', p)
      }, period)
      await page.waitForTimeout(250)
      await page.screenshot({
        path: `${out}/period-${theme}-${parseInt(period, 10)}.png`,
        clip: { x: 300, y: 90, width: 680, height: 340 },
      })
      console.log(`✔ ${out}/period-${theme}-${parseInt(period, 10)}.png`)
    }
    await ctx.close()
  }

  await browser.close()
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
