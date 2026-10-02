const { chromium } = require('playwright-core')

/**
 * 天体停靠探针（三期）：逐 scene 输出 ① 天体在 DOM 里的真实矩形
 * ② 该区块内所有文字元素的矩形，并判定两者是否相交。
 *
 * 改版式（新增/删除区块、调 rhythm）之后必须跑一次 —— 见 decisions.md #97 / #98。
 *
 * 用法：node .tmp/tools/probe-docking.cjs
 * 前置：dev server 在 5173 上跑着
 */
;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 60000 })
  // 关掉入场动画，避免元素还在位移时量矩形
  await page.evaluate(() => document.documentElement.removeAttribute('data-reveal'))
  await page.waitForTimeout(600)

  const sceneCount = await page.evaluate(
    () => document.querySelectorAll('main section[aria-labelledby]').length,
  )
  console.log(`区块数（= scene 数）= ${sceneCount}`)

  for (let scene = 0; scene < sceneCount; scene++) {
    await page.evaluate((index) => {
      const section = document.querySelectorAll('main section[aria-labelledby]')[index]
      section.scrollIntoView({ block: 'center' })
    }, scene)
    // 让停靠 transition（1400ms）走完
    await page.waitForTimeout(1700)

    const result = await page.evaluate((index) => {
      const field = document.querySelector('[data-celestial]')
      const section = document.querySelectorAll('main section[aria-labelledby]')[index]

      // 天体是 .field 下的两个直接子 div（.earth / .moon），类名被 CSS Modules 哈希过，
      // 所以按**结构**取「当前可见的那一颗」—— 按类名取会静默取空，探针就变成假绿。
      const balls = field
        ? Array.from(field.children).filter(
            (el) => el instanceof HTMLElement && getComputedStyle(el).display !== 'none',
          )
        : []
      const ball = balls[0] ?? null
      const ballRect = ball?.getBoundingClientRect()

      const texts = Array.from(section.querySelectorAll('h1,h2,h3,p,li,a,td,dt,dd'))
        .map((el) => ({ text: el.textContent.trim().slice(0, 24), rect: el.getBoundingClientRect() }))
        .filter((item) => item.text.length > 0 && item.rect.width > 0)

      const overlaps = ballRect
        ? texts.filter(
            (item) =>
              !(
                item.rect.right < ballRect.left ||
                item.rect.left > ballRect.right ||
                item.rect.bottom < ballRect.top ||
                item.rect.top > ballRect.bottom
              ),
          )
        : []

      return {
        scene: field?.getAttribute('data-scene'),
        ball: ballRect
          ? {
              x: Math.round(ballRect.x),
              y: Math.round(ballRect.y),
              w: Math.round(ballRect.width),
            }
          : null,
        overlaps,
      }
    }, scene)

    const b = result.ball
    console.log(`\nscene ${scene}（当前 data-scene=${result.scene}）`)
    console.log(`  天体矩形: ${b ? `x=${b.x} y=${b.y} w=${b.w}` : 'n/a'}`)
    console.log(`  压字 ${result.overlaps.length} 处${result.overlaps.length ? ' ← 必须挪' : ''}`)
    result.overlaps.slice(0, 5).forEach((item) => console.log(`    ✗ "${item.text}"`))
  }

  await browser.close()
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(2)
})
