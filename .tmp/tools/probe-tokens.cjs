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
    '--ds-ring': 'rgb(9 111 220 / 6%)',
    '--ds-ring-period': '46px',
    '--ds-fw-display': '500',
  },
  dark: {
    '--ds-c-bg': '#08090c',
    '--ds-c-bg-alt': '#05060a',
    '--ds-c-glass': 'rgb(8 9 12 / 62%)',
    '--ds-c-hairline': 'rgb(255 255 255 / 13%)',
    '--ds-glow': 'rgb(59 130 246 / 20%)',
    '--ds-ring': 'rgb(255 255 255 / 8%)',
    '--ds-ring-period': '46px',
    '--ds-fw-display': '500',
  },
}

const KEYS = ['--ds-c-bg', '--ds-c-bg-alt', '--ds-c-glass', '--ds-c-hairline', '--ds-glow', '--ds-ring', '--ds-ring-period', '--ds-fw-display']

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
