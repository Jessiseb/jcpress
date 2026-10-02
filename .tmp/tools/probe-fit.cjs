const { chromium } = require('playwright-core')

/**
 * 停靠几何测量（2D）：逐 scene 在「球心候选网格」上评估
 * 「若球放在这里，会压到哪些文字」。输出每个 scene 的最优（压字最少）的几个位置。
 *
 * 与 probe-docking.cjs 的分工：
 *   - 本脚本用来**找位置**（改版式后重新配 [data-scene] 时跑）；
 *   - probe-docking.cjs 用来**验收**（配好后断言 压字 = 0）。
 *
 * 球尺寸取该 scene 的 --bs 实际渲染宽（由 CSS 决定）；这里直接读当前球宽，
 * 只评估候选 y/x，不含 scale 变化。
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
  const VW = 1280
  const VH = 900

  for (let scene = 0; scene < sceneCount; scene++) {
    await page.evaluate((index) => {
      document
        .querySelectorAll('main section[aria-labelledby]')
        [index].scrollIntoView({ block: 'center' })
    }, scene)
    await page.waitForTimeout(1600)

    const res = await page.evaluate(
      ({ index, VW, VH }) => {
        const section = document.querySelectorAll('main section[aria-labelledby]')[index]
        const field = document.querySelector('[data-celestial]')
        const ball = field
          ? Array.from(field.children).find(
              (el) => el instanceof HTMLElement && getComputedStyle(el).display !== 'none',
            )
          : null
        const ballW = ball ? ball.getBoundingClientRect().width : 256
        const R = ballW / 2

        // 该区块的文字矩形（排除 h2/h3 的整行——它们横跨全宽，用其内联文本盒更公平；
        // 这里保留真实矩形，判定时按实际相交算）
        const rects = Array.from(section.querySelectorAll('h1,h2,h3,p,li,a,td,dt,dd,table,dl,ul'))
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0 && r.height > 0)
          .map((r) => ({ l: r.left, r: r.right, t: r.top, b: r.bottom }))

        // 球心候选：x 两侧（左空带 / 右空带），y 每 6vh 一格
        const cands = []
        const xs = [0.09 * VW, 0.91 * VW] // 左缘 / 右缘（与 --dx 的 35vw 落点接近）
        for (const cx of xs) {
          for (let cy = 0.15 * VH; cy <= 0.9 * VH; cy += 0.05 * VH) {
            const left = cx - R
            const right = cx + R
            const top = cy - R
            const bottom = cy + R
            const hits = rects.filter(
              (r) => !(r.r < left || r.l > right || r.b < top || r.t > bottom),
            ).length
            cands.push({ cx: Math.round(cx), cy: Math.round(cy), hits })
          }
        }
        cands.sort((a, b) => a.hits - b.hits)
        // 左右各取最优两个，便于在「保持 M/m 侧向交替」与「压字 0」之间取舍
        const left = cands.filter((c) => c.cx < VW / 2).slice(0, 3)
        const right = cands.filter((c) => c.cx >= VW / 2).slice(0, 3)
        return { ballW: Math.round(ballW), left, right }
      },
      { index: scene, VW, VH },
    )

    console.log(`\nscene ${scene}  球宽=${res.ballW}px`)
    console.log('  [左]')
    res.left.forEach((c) =>
      console.log(`    x=${c.cx} y=${c.cy} (${c.cx / VW * 100 | 0}vw, ${c.cy / VH * 100 | 0}vh)  压字 ${c.hits}`),
    )
    console.log('  [右]')
    res.right.forEach((c) =>
      console.log(`    x=${c.cx} y=${c.cy} (${c.cx / VW * 100 | 0}vw, ${c.cy / VH * 100 | 0}vh)  压字 ${c.hits}`),
    )
  }

  await browser.close()
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(2)
})
