/**
 * 「技术分享」左栏归属的布局断言（2026-10-16 用户要求：没进文章的页面不要左侧）。
 *
 * 守两件事，都是肉眼不可靠的：
 *  ① 列表页**不挂**目录栏、详情页**挂**——且列表页去掉左栏后，内容栏起点必须仍是第 4 列
 *     （不能因为少了一个 grid 子元素就把正文顶到第 1 列去）；
 *  ② 这个起点要与首页各区块的正文起点**逐像素相同**（全站共用一条装订线）。
 *
 * 用法：node .tmp/tools/probe-tech-rail.cjs   （需 dev server 在 8099）
 */
const { chromium } = require('playwright-core')

const BASE = 'http://127.0.0.1:8099'
const SLUG = 'phase-3-backend-retro'

const results = []
const check = (name, pass, detail) => {
  results.push({ name, pass, detail })
  console.log(`${pass ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const rect = (page, selector) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) }
  }, selector)

const main = async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })

  // ── ① 桌面 1280 ──
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } })

  const list = await desktop.newPage()
  await list.goto(`${BASE}/tech`, { waitUntil: 'networkidle', timeout: 60000 })
  await list.waitForTimeout(600)

  check(
    '列表页没有左栏目录',
    (await list.locator('nav[aria-label="技术分享目录"]').count()) === 0,
  )
  // 用外壳的直接子元素来判，而不是数全页 aside：页脚之类的地方也有 aside，
  // 数全页会把别处的栏算到这条上（第一版就这么误报过一次）
  const shellKids = await list.evaluate(() => {
    const wrap = document.querySelector('section[aria-labelledby="tech-title"]')
    const shell = wrap?.parentElement?.parentElement
    return shell ? Array.from(shell.children).map((c) => c.tagName) : null
  })
  check('列表页外壳只挂内容栏', JSON.stringify(shellKids) === '["DIV"]', JSON.stringify(shellKids))
  check('列表页没有窄屏「目录」折叠条', (await list.getByRole('button', { name: /目录/ }).count()) === 0)

  const listWrap = await rect(list, 'section[aria-labelledby="tech-title"]')
  const listTitle = await rect(list, '#tech-title')

  const detail = await desktop.newPage()
  await detail.goto(`${BASE}/tech/${SLUG}`, { waitUntil: 'networkidle', timeout: 60000 })
  await detail.waitForTimeout(600)

  const railCount = await detail.locator('nav[aria-label="技术分享目录"]').count()
  check('详情页有左栏目录', railCount === 1)
  const currentCount = await detail.locator('nav[aria-label="技术分享目录"] a[aria-current="page"]').count()
  check('详情页恰好一项高亮', currentCount === 1, `${currentCount} 项`)
  const railRect = await rect(detail, 'nav[aria-label="技术分享目录"]')
  const detailTitle = await rect(detail, 'article h1')
  check(
    '详情页左栏落在第 1–3 列、正文从第 4 列起',
    railRect && detailTitle && railRect.left < detailTitle.left - 200,
    `栏 left=${railRect?.left} 正文 left=${detailTitle?.left}`,
  )

  // ── ② 与首页装订线对齐 ──
  // 只取 section 的「正文」直接子元素（排除通栏标题与左栏导语，也排除 hero ——
  // hero 是 `.container` 不是 `.section`，它的内容是居中的，不在这条栅格上）
  const home = await desktop.newPage()
  await home.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 })
  await home.waitForTimeout(900)
  const homeLefts = await home.evaluate(() =>
    Array.from(
      new Set(
        Array.from(document.querySelectorAll('section.section > *'))
          .filter(
            (el) =>
              !el.classList.contains('sectionTitle') && !el.classList.contains('sectionLead'),
          )
          .map((el) => Math.round(el.getBoundingClientRect().left)),
      ),
    ).sort((a, b) => a - b),
  )
  check(
    '列表页 / 详情页正文起点 == 首页正文列（同一条装订线）',
    homeLefts.includes(listWrap.left) && homeLefts.includes(detailTitle.left),
    `首页正文列=${homeLefts.join(',')} 列表=${listWrap.left} 详情正文=${detailTitle.left}`,
  )
  check(
    '列表页标题与内容栏左边缘对齐',
    Math.abs(listTitle.left - listWrap.left) <= 1,
    `标题=${listTitle.left} 内容栏=${listWrap.left}`,
  )

  // ── ③ 窄屏 760：列表页也不该有折叠条 ──
  const narrow = await browser.newContext({ viewport: { width: 760, height: 900 } })
  const narrowList = await narrow.newPage()
  await narrowList.goto(`${BASE}/tech`, { waitUntil: 'networkidle', timeout: 60000 })
  await narrowList.waitForTimeout(500)
  const narrowToggle = await narrowList.getByRole('button', { name: /目录/ }).count()
  check('窄屏列表页没有目录折叠条', narrowToggle === 0, `${narrowToggle} 个`)

  const narrowDetail = await narrow.newPage()
  await narrowDetail.goto(`${BASE}/tech/${SLUG}`, { waitUntil: 'networkidle', timeout: 60000 })
  await narrowDetail.waitForTimeout(500)
  const narrowToggleDetail = await narrowDetail.getByRole('button', { name: /目录/ }).count()
  const narrowNavVisible = await narrowDetail.locator('nav[aria-label="技术分享目录"]').isVisible()
  check(
    '窄屏详情页保留折叠目录、且默认收起',
    narrowToggleDetail === 1 && narrowNavVisible === false,
    `折叠条 ${narrowToggleDetail} 个、目录可见=${narrowNavVisible}`,
  )

  await browser.close()

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} 通过`)
  process.exit(failed.length ? 1 : 0)
}

main().catch((error) => {
  console.error('断言失败：', error)
  process.exit(1)
})
