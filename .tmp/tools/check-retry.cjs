const { chromium } = require('playwright-core')

// 后端从「挂了」到「活过来」：点重试之后列表必须真的出来，而不是只有按钮样式
const BODY = (list) =>
  JSON.stringify({
    code: 0,
    message: 'ok',
    data: { list, page: 1, size: 20, total: list.length, pages: 1 },
    traceId: null,
  })

const card = (i) => ({
  id: String(i),
  title: '第 ' + i + ' 篇文章',
  slug: 'a' + i,
  summary: '摘要',
  coverUrl: null,
  categoryName: 'Java 后端',
  categorySlug: 'java-backend',
  tags: [],
  readingMinutes: 6,
  viewCount: 3,
  top: 0,
  publishTime: '2026-10-02 09:00:00',
})

;(async () => {
  const b = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
  const p = await ctx.newPage()

  let alive = false
  await p.route('**/api/**', (route) => {
    if (!alive) {
      return route.fulfill({ status: 502, contentType: 'text/html', body: '<html><body>502</body></html>' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: BODY([card(1), card(2)]) })
  })

  await p.goto('http://127.0.0.1:5175/tech', { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('[role="alert"]', { timeout: 15000 })
  console.log('1) 错误态出现：', await p.locator('[role="alert"]').innerText().then((t) => t.replace(/\n+/g, ' | ')))

  alive = true
  await p.getByRole('button', { name: '再试一次' }).click()
  await p.waitForSelector('a[href^="/tech/a"]', { timeout: 15000 })
  console.log('2) 点重试后列表恢复：', await p.locator('a[href^="/tech/a"]').count(), '条')
  console.log('3) 错误态已消失：', (await p.locator('[role="alert"]').count()) === 0)

  await ctx.close()
  await b.close()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
