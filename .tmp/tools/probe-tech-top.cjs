/**
 * 「技术分享列表页首屏顶部间距」探针（2026-10-19 用户：「这个位置有点低」）。
 *
 * 不靠肉眼判断「低了几像素」，直接量：

 *   navbar 底边 → 页面 h1 顶边 的净间距，在三个页面各量一次：
 *     /            首页 hero 的 h1
 *     /tech        列表页的 h1（用户圈的那块）
 *     /tech/:slug  详情页的 h1
 *
 * 另量列表页 h1 上方都堆了什么（shell padding / 环 badge 高度 / 两者之和），
 * 好判断该减哪一层而不是乱调。
 *
 * 用法：node .tmp/tools/probe-tech-top.cjs   （需 dev server 在 8099）
 */
const { chromium } = require('playwright-core')

const BASE = 'http://127.0.0.1:8099'
const SLUG = 'phase-3-backend-retro'

const results = []
const check = (name, pass, detail) => {
  results.push({ name, pass, detail })
  console.log(`${pass ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`)
}

/** 量导航底边与「可见的第一个 h1」顶边，以及 h1 之上各层的盒子 */
const measure = (page) =>
  page.evaluate(() => {
    const nav = document.querySelector('header')
    const navRect = nav.getBoundingClientRect()
    const h1 = document.querySelector('main h1') || document.querySelector('h1')
    const h1Rect = h1.getBoundingClientRect()
    const shell = h1.closest('section') || h1.parentElement
    const shellStyle = getComputedStyle(shell)

    // h1 之前、同一父级里的兄弟元素（环 badge 之类）
    const siblings = Array.from(shell.children)
      .filter((el) => el !== h1 && el.compareDocumentPosition(h1) === Node.DOCUMENT_POSITION_FOLLOWING)
      .map((el) => {
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        return {
          cls: el.className || el.tagName,
          h: Math.round(r.height),
          marginTop: cs.marginTop,
          marginBottom: cs.marginBottom,
        }
      })

    return {
      navBottom: Math.round(navRect.bottom),
      navHeight: Math.round(navRect.height),
      h1Top: Math.round(h1Rect.top),
      gap: Math.round(h1Rect.top - navRect.bottom),
      shellPadTop: shellStyle.paddingTop,
      shellCls: shell.className,
      siblings,
      scrollY: Math.round(window.scrollY),
    }
  })

const main = async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })

  const rows = []
  for (const [label, path] of [
    ['首页     /', '/'],
    ['列表页   /tech', '/tech'],
    ['详情页   /tech/:slug', `/tech/${SLUG}`],
  ]) {
    const page = await ctx.newPage()
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(700)
    const m = await measure(page)
    rows.push({ label, ...m })
    console.log(`\n${label}`)
    console.log(`  导航底边 y=${m.navBottom}（高 ${m.navHeight}）`)
    console.log(`  h1 顶边 y=${m.h1Top}  →  净间距 ${m.gap}px`)
    console.log(`  外壳 padding-top=${m.shellPadTop}  (${String(m.shellCls).slice(0, 40)})`)
    console.log(`  h1 之前的兄弟：${JSON.stringify(m.siblings)}`)
    await page.close()
  }

  const home = rows[0]
  const list = rows[1]
  const detail = rows[2]

  console.log('\n—— 判据 ——')
  check(
    '列表页 h1 净间距 ≤ 首页 h1 净间距 + 8px（不该在首屏比首页更空）',
    list.gap <= home.gap + 8,
    `列表=${list.gap} 首页=${home.gap}`,
  )
  check('列表页 h1 净间距落在 100–120px（与首页同档）', list.gap >= 100 && list.gap <= 120, `${list.gap}px`)
  check('详情页 h1 净间距仍在 85–105px（这次没动它）', detail.gap >= 85 && detail.gap <= 105, `${detail.gap}px`)

  const fail = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - fail}/${results.length} 通过`)
  await browser.close()
  process.exit(fail ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
