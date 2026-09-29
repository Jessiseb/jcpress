const { chromium } = require('playwright-core')

/**
 * 令牌探针：确认 theme.jcpress.css 的新令牌真的进了计算样式。
 *
 * 注意：自定义属性（--x）的计算值**不做颜色规范化** —— 浏览器返回的是
 * var() 替换后、去除首尾空白的原始 token 串（`rgb(20 22 26 / 12%)` 原样返回，
 * 不会变成 `rgba(20, 22, 26, 0.12)`）。所以这里按「原样字符串」比对。
 * 主题不依赖系统色：直接把 <html data-theme> 设成目标值再读，避免测试受环境影响。
 */

const EXPECT = {
  light: {
    '--ds-c-hairline': 'rgb(20 22 26 / 12%)',
    '--ds-c-glass': 'rgb(255 255 255 / 72%)',
    // 2026-09-29 二期重同步：原期望 6% 是更早一版的取值，theme.jcpress.css 的
    // 「环周期 46px 校准」一轮里已改成 13%（并有注释说明剂量），探针没跟着改，
    // 于是在二期开工时暴露为 3 处**假失败**。这里以主题文件为准重同步，而不是反过来改主题。
    '--ds-ring': 'rgb(9 111 220 / 13%)',
    '--ds-ring-period': '46px',
    '--ds-fw-display': '500',
    '--ds-fw-display-strong': '700',
    // ---- 二期新增（phase-2-visual）----
    '--ds-flow-line': '#0a6fd8',
    '--ds-flow-alpha-max': '0.28',
    '--ds-c-panel': 'rgb(255 255 255 / 62%)',
    '--ds-c-panel-border': 'rgb(20 22 26 / 10%)',
    '--ds-panel-sheen': 'rgb(255 255 255 / 55%)',
    '--ds-radius-panel': '14px',
    '--ds-blur-panel': '14px',
    '--ds-c-progress': 'rgb(15 17 21 / 72%)',
    '--ds-progress-h': '2px',
    '--ds-parallax-shift': '5vh',
    '--ds-parallax-scale': '1.04',
  },
  dark: {
    '--ds-c-bg': '#08090c',
    '--ds-c-bg-alt': '#05060a',
    '--ds-c-glass': 'rgb(8 9 12 / 62%)',
    '--ds-c-hairline': 'rgb(255 255 255 / 13%)',
    // 同上的重同步：暗色的聚光与环在「剧场底色 #08090c」那一轮里被提亮过
    '--ds-glow': 'rgb(59 130 246 / 26%)',
    '--ds-ring': 'rgb(255 255 255 / 10%)',
    '--ds-ring-period': '46px',
    '--ds-fw-display': '500',
    '--ds-fw-display-strong': '700',
    // ---- 二期新增（phase-2-visual）----
    '--ds-flow-line': '#4d9bff',
    '--ds-flow-alpha-max': '0.28',
    '--ds-c-panel': 'rgb(16 18 24 / 58%)',
    '--ds-c-panel-border': 'rgb(255 255 255 / 12%)',
    '--ds-panel-sheen': 'rgb(255 255 255 / 7%)',
    '--ds-radius-panel': '14px',
    '--ds-blur-panel': '14px',
    '--ds-c-progress': 'rgb(235 235 245 / 78%)',
    '--ds-progress-h': '2px',
    '--ds-parallax-shift': '5vh',
    '--ds-parallax-scale': '1.04',
  },
}

const KEYS = [
  '--ds-c-bg',
  '--ds-c-bg-alt',
  '--ds-c-glass',
  '--ds-c-hairline',
  '--ds-glow',
  '--ds-ring',
  '--ds-ring-period',
  '--ds-fw-display',
  '--ds-fw-display-strong',
  '--ds-flow-line',
  '--ds-flow-alpha-max',
  '--ds-c-panel',
  '--ds-c-panel-border',
  '--ds-panel-sheen',
  '--ds-radius-panel',
  '--ds-blur-panel',
  '--ds-c-progress',
  '--ds-progress-h',
  '--ds-parallax-shift',
  '--ds-parallax-scale',
]

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })
  let bad = 0

  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await ctx.newPage()
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle', timeout: 60000 })
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)

    const values = await page.evaluate((keys) => {
      const rs = getComputedStyle(document.documentElement)
      return Object.fromEntries(keys.map((k) => [k, rs.getPropertyValue(k).trim()]))
    }, KEYS)

    console.log(`\n=== ${theme} ===`)
    for (const [k, want] of Object.entries(EXPECT[theme])) {
      const got = values[k]
      const ok = got === want
      if (!ok) bad++
      console.log(`${ok ? '✔' : '✘'} ${k} = ${got}${ok ? '' : `（期望 ${want}）`}`)
    }
    await ctx.close()
  }

  await browser.close()
  console.log(`\n合计不符：${bad}`)
  process.exit(bad ? 1 : 0)
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(2)
})
