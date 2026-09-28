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
    const step = 300
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 90))
    }
    window.scrollTo(0, 0)
    await new Promise((r) => setTimeout(r, 700))
  })
}

;(async () => {
  const out = process.argv[2]
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })

  const views = [
    { name: 'desktop-light', width: 1280, height: 900, scheme: 'light' },
    { name: 'mobile-light', width: 390, height: 844, scheme: 'light' },
    { name: 'mobile-dark', width: 390, height: 844, scheme: 'dark' },
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
    await page.screenshot({
      path: `${out}/${PREFIX}${v.name}-hero.png`,
      clip: { x: 0, y: 0, width: v.width, height: Math.min(v.height, 700) },
    })
    await page.screenshot({ path: `${out}/${PREFIX}${v.name}-full.png`, fullPage: true })

    await ctx.close()
  }

  await browser.close()
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
