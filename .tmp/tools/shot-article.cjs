/**
 * 单篇文章详情页截图（按 slug 指定）。
 *
 * 用途：导入新文章后确认前台真能打开、h2/表格/代码块都渲染出来。
 * 用法：node .tmp/tools/shot-article.cjs <slug>
 * 输出：.tmp/tools/shot-article-<slug>-{light,dark}.png
 */
const { chromium } = require('playwright-core')

const BASE = 'http://127.0.0.1:8099'
const slug = process.argv[2] || 'java-thread-basics'

const main = async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })

  const shots = [
    { scheme: 'light', width: 1280, height: 1000, tag: 'light' },
    { scheme: 'dark', width: 1280, height: 1000, tag: 'dark' },
    { scheme: 'light', width: 390, height: 844, tag: 'mobile' },
  ]

  for (const shot of shots) {
    const ctx = await browser.newContext({
      viewport: { width: shot.width, height: shot.height },
      colorScheme: shot.scheme,
    })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/tech/${slug}`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(900)

    // 遮罩/报错是这里最该抓的：导入的 Markdown 里若有非法语法，页面会白
    const info = await page.evaluate(() => ({
      h1: document.querySelector('h1') ? document.querySelector('h1').textContent.trim() : null,
      h2: Array.from(document.querySelectorAll('article h2, .prose h2, h2')).map((el) => el.textContent.trim()),
      code: document.querySelectorAll('pre').length,
      tables: document.querySelectorAll('table').length,
      tags: Array.from(document.querySelectorAll('a[href^="/tech?tag"], [data-tag]')).map((el) => el.textContent.trim()),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      overlay: !!document.querySelector('vite-error-overlay'),
    }))
    console.log(`[${shot.tag} ${shot.width}] h1=${info.h1}`)
    console.log(`  h2=${info.h2.length} 个：${info.h2.join(' / ')}`)
    console.log(`  代码块=${info.code} 表格=${info.tables} 横向溢出=${info.overflow}px 报错遮罩=${info.overlay}`)

    const out = `.tmp/tools/shot-article-${slug}-${shot.tag}.png`
    await page.screenshot({ path: out, fullPage: false })
    console.log(`  → ${out}`)
    await ctx.close()
  }

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
