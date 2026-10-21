/**
 * 技术分享详情页的「正文度量」实测（2026-10-20 用户：中间的主要内容有点窄）。
 *
 * 量的是宽度分配，不是观感：
 *   容器宽 / 左栏目录宽 / 内容栏宽 / 正文实际宽 / 右栏 TOC 宽，以及正文每行能放多少汉字。
 *
 * 用法：node .tmp/tools/probe-article-measure.cjs [slug]
 */
const { chromium } = require('playwright-core')

const BASE = 'http://127.0.0.1:8099'
const slug = process.argv[2] || 'java-thread-basics'

const measure = (page) =>
  page.evaluate(() => {
    const pick = (sel) => document.querySelector(sel)
    const box = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return Math.round(r.width)
    }
    const shell = pick('[class*="shell"]')
    const rail = pick('nav[aria-label="技术分享目录"]')
    const content = pick('[class*="content"]')
    const layout = pick('[class*="layout"]')
    const prose = pick('[class*="prose"]') || pick('article')
    const toc = pick('aside[class*="aside"]') || pick('[class*="aside"]')
    const p = prose ? pick('[class*="prose"] p') || prose.querySelector('p') : null

    const cs = prose ? getComputedStyle(prose) : null
    const fs = cs ? parseFloat(cs.fontSize) : 0

    return {
      viewport: window.innerWidth,
      shell: box(shell),
      rail: box(rail),
      content: box(content),
      layout: box(layout),
      prose: box(prose),
      toc: box(toc),
      fontSize: fs,
      // 中文正文一个字宽约 1em，每行字数 ≈ 正文宽 / 字号
      charsPerLine: fs ? +(box(prose) / fs).toFixed(1) : 0,
      proseMax: cs ? cs.maxWidth : null,
      lineHeight: cs ? cs.lineHeight : null,
      pWidth: box(p),
    }
  })

const main = async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })

  for (const width of [1280, 1440, 1920]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/tech/${slug}`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(700)
    const m = await measure(page)
    console.log(
      `${String(width).padStart(4)} 视口 | 容器 ${m.shell} | 左栏 ${m.rail} | 内容栏 ${m.content} | ` +
        `正文 ${m.prose} (max ${m.proseMax}) | TOC ${m.toc} | 字号 ${m.fontSize} | 每行 ≈ ${m.charsPerLine} 汉字`,
    )
    await ctx.close()
  }

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
