/**
 * 后台左导航固定性验收（2026-10-21）。
 *
 * 用户报的现象：「我在滑动的时候，左边的导航应该是固定的，现在也会跟着滑动」。
 * 根因是 `.shell` 用 `min-height: 100vh` 让**整页**滚，侧边栏只是被 flex 拉伸的普通项。
 * 现在改成 `.shell { height: 100vh; overflow: hidden }` + `.body { overflow-y: auto }`。
 *
 * 这条探针要守住的是「滚动发生在内容区里」这件事本身 —— 只看截图看不出来，
 * 因为两种布局在静止时长得一模一样。
 *
 * 用法：node .tmp/tools/probe-admin-scroll.cjs   （需 8099 有服务）
 */
const { chromium } = require('playwright-core')

const BASE = 'http://127.0.0.1:8099'
const results = []
const check = (name, pass, detail) => {
  results.push({ name, pass })
  console.log(`${pass ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const ME = {
  code: 0,
  message: 'ok',
  data: { id: '1', username: 'probe', nickname: '探针', role: 'ADMIN' },
  traceId: null,
}

const openAdmin = async (browser, viewport) => {
  const ctx = await browser.newContext({ viewport })
  await ctx.addInitScript(() => sessionStorage.setItem('jcpress.admin.token', 'probe-token'))
  await ctx.route('**/api/v1/admin/auth/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ME) }),
  )
  const page = await ctx.newPage()
  await page.goto(`${BASE}/admin/articles/new`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForSelector('.cm-content', { timeout: 30000 })
  return { ctx, page }
}

/** 侧栏 / 顶栏 / 标签条 的视口坐标 + 各层滚动量 */
const measure = (page) =>
  page.evaluate(() => {
    const rect = (el) => (el ? Math.round(el.getBoundingClientRect().top) : null)
    const side = document.querySelector('aside')
    const topbar = document.querySelector('[class*="topbar"]')
    const tabs = document.querySelector('[class*="tabsBar"]')
    const body = document.querySelector('[class*="body"]')
    return {
      sideTop: rect(side),
      topbarTop: rect(topbar),
      tabsTop: rect(tabs),
      windowScrollY: Math.round(window.scrollY),
      bodyScrollTop: body ? Math.round(body.scrollTop) : null,
      bodyScrollable: body ? body.scrollHeight - body.clientHeight : null,
      docScrollable: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    }
  })

const main = async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })

  // ── 桌面：滚内容区，左栏与顶栏都不许动 ──
  const { ctx, page } = await openAdmin(browser, { width: 1360, height: 800 })
  const before = await measure(page)

  check('页面本身不可滚（滚动交给内容区）', before.docScrollable <= 0, `文档可滚 ${before.docScrollable}px`)
  check('内容区是有滚动的（页面够长）', before.bodyScrollable > 400, `内容区可滚 ${before.bodyScrollable}px`)

  // 滚到底（不是「滚 700」—— 内容区能滚多少由内容高度决定，写死数字等于假设页面高度）
  await page.evaluate(() => {
    const body = document.querySelector('[class*="body"]')
    body.scrollTo({ top: body.scrollHeight, behavior: 'instant' })
  })
  await page.waitForTimeout(300)
  const after = await measure(page)

  check('滚动后左导航停在原位', after.sideTop === before.sideTop, `${before.sideTop} → ${after.sideTop}`)
  check('滚动后顶栏停在原位', after.topbarTop === before.topbarTop, `${before.topbarTop} → ${after.topbarTop}`)
  check('滚动后标签条停在原位', after.tabsTop === before.tabsTop, `${before.tabsTop} → ${after.tabsTop}`)
  check('window.scrollY 始终为 0', after.windowScrollY === 0, String(after.windowScrollY))
  check(
    '滚到底的是内容区自己（scrollTop = 可滚距离）',
    after.bodyScrollTop === before.bodyScrollable && after.bodyScrollTop > 300,
    `${after.bodyScrollTop}/${before.bodyScrollable}`,
  )

  await page.screenshot({ path: '.tmp/tools/admin-scroll-desktop.png' })

  // ── 换页：内容区要回到顶部 ──
  await page.click('a[href="/admin/articles"], [class*="sideItem"] >> text=文章列表')
  await page.waitForTimeout(900)
  const nav = await page.evaluate(() => {
    const body = document.querySelector('[class*="body"]')
    return { path: location.pathname, scrollTop: body ? Math.round(body.scrollTop) : null }
  })
  check('切到别的页面后内容区回顶部', nav.scrollTop === 0, `${nav.path} scrollTop=${nav.scrollTop}`)
  await ctx.close()

  // ── 窄屏：侧栏变抽屉，内容区仍是唯一滚动容器 ──
  const { ctx: ctx2, page: page2 } = await openAdmin(browser, { width: 390, height: 780 })
  const m2 = await measure(page2)
  await page2.evaluate(() => {
    const body = document.querySelector('[class*="body"]')
    body.scrollTo({ top: 400, behavior: 'instant' })
  })
  await page2.waitForTimeout(250)
  const m3 = await measure(page2)
  check('窄屏页面同样不可滚', m2.docScrollable <= 0, `文档可滚 ${m2.docScrollable}px`)
  check('窄屏内容区能滚', m3.bodyScrollTop >= 390, String(m3.bodyScrollTop))
  check('窄屏无横向溢出', await page2.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 0)
  await page2.screenshot({ path: '.tmp/tools/admin-scroll-mobile.png' })
  await ctx2.close()

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} 通过`)
  process.exit(failed.length ? 1 : 0)
}

main().catch((error) => {
  console.error('断言失败：', error)
  process.exit(1)
})
