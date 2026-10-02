const { chromium } = require('playwright-core')

/**
 * 停靠几何测量：逐 scene 输出该区块内**所有文字元素的矩形**，
 * 用来人工找出「左侧/右侧空带」，据此写 [data-scene] 的 translate/scale。
 *
 * 输出的是原始数据，不做判定 —— 判定交给 probe-docking.cjs。
 */
;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 60000 })
  await page.evaluate(() => document.documentElement.removeAttribute('data-reveal-armed'))
  await page.waitForTimeout(600)

  const sceneCount = await page.evaluate(
    () => document.querySelectorAll('main section[aria-labelledby]').length,
  )
  const VH = 900
  const VW = 1280

  for (let scene = 0; scene < sceneCount; scene++) {
    await page.evaluate((index) => {
      document
        .querySelectorAll('main section[aria-labelledby]')
        [index].scrollIntoView({ block: 'center' })
    }, scene)
    await page.waitForTimeout(1700)

    const rows = await page.evaluate((index) => {
      const section = document.querySelectorAll('main section[aria-labelledby]')[index]
      return Array.from(section.querySelectorAll('h1,h2,h3,p,li,table,dl,ul'))
        .map((el) => {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) return null
          return {
            tag: el.tagName,
            text: el.textContent.trim().slice(0, 26),
            l: Math.round(r.left),
            r: Math.round(r.right),
            t: Math.round(r.top),
            b: Math.round(r.bottom),
          }
        })
        .filter(Boolean)
    }, scene)

    console.log(`\n===== scene ${scene} =====`)
    rows.forEach((x) => console.log(`  ${x.tag.padEnd(4)} x${x.l}..${x.r}  y${x.t}..${x.b}  "${x.text}"`))

    // 空带分析：找出「没有任何文字元素占据」的 x 区间（按 40px 网格）
    const grid = new Array(Math.ceil(VW / 40)).fill(true)
    rows.forEach((x) => {
      for (let gx = Math.max(0, Math.floor(x.l / 40)); gx < Math.min(grid.length, Math.ceil(x.r / 40)); gx++) {
        grid[gx] = false
      }
    })
    const freeBands = []
    let start = -1
    grid.forEach((free, i) => {
      if (free && start < 0) start = i
      if (!free && start >= 0) {
        freeBands.push(`${start * 40}..${i * 40}`)
        start = -1
      }
    })
    if (start >= 0) freeBands.push(`${start * 40}..${VW}`)
    console.log(`  → 纵向全高无文字的空带（x）: ${freeBands.join(' | ') || '无'}`)
  }

  await browser.close()
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(2)
})
