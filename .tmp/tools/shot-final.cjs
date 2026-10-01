const { chromium } = require('playwright-core')

const BASE = process.argv[3] || 'http://127.0.0.1:5173/'
// 文件名前缀：同一套视口要拍多个页面时用来区分（如 tech-desktop-light-full.png）
const PREFIX = process.argv[4] || ''

/**
 * 验收截图分两种，不能混：
 *  A. 静态版式 —— 先滚一遍触发入场，再摘掉 data-reveal 让隐藏态失效，
 *     确保拍到的是最终状态，而不是动画中间态（整页截图会把视口拉高，
 *     那一刻元素刚开始淡入，直接拍会拍到空白）。
 *  B. 动效验证 —— 不摘属性，滚到目标位置后等 900ms，确认元素确实浮现出来了。
 */
async function scrollThrough(page) {
  await page.evaluate(async () => {
    // 页面全局开了 scroll-behavior: smooth，程序化 scrollTo 会变成动画，
    // 快速连续调用只会互相打断、永远走不到底。截图前先关掉。
    document.documentElement.style.scrollBehavior = 'auto'
    // 每步让出**两帧**：连续 scrollTo 落在同一帧上时，IntersectionObserver 只在更新渲染时
    // 采样一次交点，「没进视口 → 已经滚过去」的区块会永远停在隐藏态（截图里就是一张空白）。
    // audit-behavior.cjs 里同一个坑踩过一次，写在那里更详细。
    const step = 200
    const max = document.documentElement.scrollHeight - innerHeight
    for (let y = 0; y <= max; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 40))))
    }
    window.scrollTo(0, 0)
    await new Promise((r) => setTimeout(r, 700))
  })
}

/**
 * 把流线布景层**冻结在一帧代表态**上，供证据截图使用。
 *
 * 为什么必须这么做（二期踩到的两个互斥问题）：
 *  ① 页面上有常驻无限动画时，Chromium 的截图会拍到**空白/陈旧帧**（实测首屏图 122KB 全空
 *     vs 正常 220KB）。加 `animations: 'disabled'` 能修好捕获 —— 但它会把**无限动画重置到初始态**，
 *     所有流线的 `stroke-dashoffset` 归零、相位全部对齐，拍出来是「所有线段挤在左边缘」的假象。
 *  ② 所以：先把每条线的 dashoffset 按索引铺开（确定性，模拟动画跑到中段的分布），
 *     再把动画关掉，最后用 `animations: 'disabled'` 拍。
 * 这样首屏证据图既**内容完整**，又**图案分布真实**；它不是「动画中间态」，而是一帧被定格的代表态。
 */
async function freezeFlowFrame(page) {
  await page.evaluate(() => {
    const paths = Array.from(document.querySelectorAll('[data-flow] path'))
    paths.forEach((p, idx) => {
      p.style.animation = 'none'
      // 0.37 与 1 互质，索引一铺开就均匀散在一个周期里
      p.style.strokeDashoffset = String(-((idx * 0.37) % 1))
      p.style.strokeDasharray = '0.62 0.38'
      p.style.opacity = '0.5'
    })
  })
}

;(async () => {
  const out = process.argv[2]
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })

  const views = [
    { name: 'desktop-light', width: 1280, height: 900, scheme: 'light' },
    { name: 'mobile-light', width: 390, height: 844, scheme: 'light' },
    { name: 'mobile-dark', width: 390, height: 844, scheme: 'dark' },
    // 375：规划 §2.8 的四档里最小的一档（二期补进来，一期只用 390 覆盖）
    { name: 'mobile375-light', width: 375, height: 812, scheme: 'light' },
    { name: 'tablet-light', width: 768, height: 1024, scheme: 'light' },
  ]

  for (const v of views) {
    const ctx = await browser.newContext({
      viewport: { width: v.width, height: v.height },
      deviceScaleFactor: 1,
      colorScheme: v.scheme,
    })
    const page = await ctx.newPage()
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(700)

    // ---- A/B 之前：确认入场序列确实接管了 ----
    const revealState = await page.evaluate(() => ({
      armed: document.documentElement.getAttribute('data-reveal'),
      total: document.querySelectorAll('[data-reveal]').length,
      hidden: document.querySelectorAll('[data-reveal]').length
        ? Array.from(document.querySelectorAll('[data-reveal]')).filter(
            (el) => getComputedStyle(el).opacity !== '1',
          ).length
        : 0,
    }))

    await scrollThrough(page)

    const revealed = await page.evaluate(
      () => document.querySelectorAll('[data-reveal].is-revealed').length,
    )

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      pageHeight: document.body.scrollHeight,
    }))

    console.log(
      `${v.name}: armed=${revealState.armed} revealNodes=${revealState.total} ` +
        `hiddenOnLoad=${revealState.hidden} revealedAfterScroll=${revealed} | ` +
        `scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth} ` +
        `overflow=${overflow.scrollWidth > overflow.clientWidth ? 'YES !!' : 'no'} pageHeight=${overflow.pageHeight}`,
    )

    // ---- A. 摘掉隐藏态后拍静态版式 ----
    await page.evaluate(() => document.documentElement.removeAttribute('data-reveal'))
    await page.waitForTimeout(250)

    // ⚠️ `animations: 'disabled'` 是二期必须加的：页面上多了一层**常驻 CSS 动画**的
    // position:fixed 流线布景层之后，Chromium 的截图会拍到空白/陈旧帧
    // （实测 fullPage 64KB vs 正常 573KB、首屏 122KB 全空 vs 正常 220KB）。
    // 前提是先用 freezeFlowFrame() 把流线定格在一帧代表态 —— 否则
    // `animations: 'disabled'` 会把相位全部归零，图案退化成「挤在左边缘」的假象。
    await freezeFlowFrame(page)
    await page.waitForTimeout(200)
    await page.screenshot({
      path: `${out}/${PREFIX}${v.name}-hero.png`,
      clip: { x: 0, y: 0, width: v.width, height: Math.min(v.height, 700) },
      animations: 'disabled',
    })
    await page.screenshot({
      path: `${out}/${PREFIX}${v.name}-full.png`,
      fullPage: true,
      animations: 'disabled',
    })

    await ctx.close()
  }

  await browser.close()
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
