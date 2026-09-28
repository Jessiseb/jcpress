const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

/**
 * 字符表收集：把子集需要的中文字符精确到「页面上真正渲染出来的字」。
 *
 * 为什么不扫源码：源码里有大量中文注释，会把子集从 ~530 字撑到 ~960 字，
 * 白白多出上百 KB 下载。DOM 里的文本才是用户看得见的。
 *
 * 覆盖范围：4 个路由 + 404 的可见文本、aria-label / title / alt / placeholder 属性
 * （读屏与提示文案也要有字形），以及交互后才出现的文案（展开/收起、已复制、空态）。
 *
 * 前置：dev server 在 5173 上跑着。
 * 用法：npm run fonts:chars  → 写 frontend/.tmp/fonts/chars.txt
 */

const ROUTES = ['/', '/tech', '/algo', '/projects', '/no-such-page']
const BASE = process.env.FONT_PROBE_BASE || 'http://127.0.0.1:5173'

// 交互态 / 状态文案：默认渲染时不可见，但可能出现，必须包含
const EXTRA =
  '展开收起已复制复制分钟共篇更新至切换主题亮暗打开关闭菜单回到首页页面不存在链接可能写错了或者还没搬过来列表接口接通这页暂时是空的先看项目与实习经历边已经把两个自研取舍写得比较细内容整理中数据结构算法档位可参考笔记每个背景架构复盘已有概要就能看到亮点'

const isWanted = (cp) =>
  (cp >= 0x3000 && cp <= 0x303f) ||
  (cp >= 0x4e00 && cp <= 0x9fff) ||
  (cp >= 0xff00 && cp <= 0xffef) ||
  cp === 0x2018 ||
  cp === 0x2019 ||
  cp === 0x201c ||
  cp === 0x201d ||
  cp === 0x2026

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  const chars = new Set(EXTRA)

  for (const route of ROUTES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 60000 })
    // 摘掉入场隐藏态，并把折叠面板全部展开 —— 折叠状态下的文案也要有字形
    await page.evaluate(() => {
      document.documentElement.removeAttribute('data-reveal')
      document.querySelectorAll('button[aria-expanded="false"]').forEach((b) => b.click())
    })
    await page.waitForTimeout(300)

    const texts = await page.evaluate(() => {
      const attrs = ['aria-label', 'title', 'alt', 'placeholder']
      const values = [document.body.innerText]
      for (const el of document.querySelectorAll('*')) {
        for (const a of attrs) {
          const v = el.getAttribute(a)
          if (v) values.push(v)
        }
      }
      return values
    })

    for (const text of texts) {
      for (const ch of text) {
        if (isWanted(ch.codePointAt(0))) chars.add(ch)
      }
    }
    await ctx.close()
    console.log(`✔ ${route}`)
  }

  await browser.close()

  const list = [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0))
  const outDir = path.resolve(__dirname, '../.tmp/fonts')
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'chars.txt'), list.join(''), 'utf8')
  console.log(`唯一中文字符：${list.length} 个 → frontend/.tmp/fonts/chars.txt`)
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
