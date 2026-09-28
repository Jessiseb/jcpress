const { chromium } = require('playwright-core')
const fs = require('fs')

const URL = process.argv[2]
const OUT = process.argv[3] || 'C:/Users/O/Desktop/myproject/jcpress/.tmp/ref'

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })

  const views = [
    { name: 'desktop-light', width: 1280, height: 900, scheme: 'light' },
    { name: 'desktop-dark', width: 1280, height: 900, scheme: 'dark' },
    { name: 'mobile-light', width: 390, height: 844, scheme: 'light' },
  ]

  for (const v of views) {
    const ctx = await browser.newContext({
      viewport: { width: v.width, height: v.height },
      deviceScaleFactor: 1,
      colorScheme: v.scheme,
    })
    const page = await ctx.newPage()
    try {
      await page.goto(URL, { waitUntil: 'load', timeout: 60000 })
    } catch (e) {
      console.log(`${v.name}: goto warn ${e.message}`)
    }
    await page.waitForTimeout(3500)

    await page.screenshot({ path: `${OUT}/${v.name}-hero.png` })
    try {
      await page.screenshot({ path: `${OUT}/${v.name}-full.png`, fullPage: true })
    } catch (e) {
      console.log(`${v.name}: fullpage warn ${e.message}`)
    }

    if (v.name === 'desktop-light') {
      const info = await page.evaluate(() => {
        const cs = (el) => (el ? getComputedStyle(el) : null)
        const grab = (sel) => {
          const el = document.querySelector(sel)
          if (!el) return null
          const s = cs(el)
          return {
            sel,
            text: (el.textContent || '').trim().slice(0, 120),
            font: s.fontFamily,
            size: s.fontSize,
            weight: s.fontWeight,
            color: s.color,
            bg: s.backgroundColor,
            bgImage: s.backgroundImage.slice(0, 300),
            radius: s.borderRadius,
            border: s.border,
            shadow: s.boxShadow,
            backdrop: s.backdropFilter,
            letterSpacing: s.letterSpacing,
          }
        }
        const rootVars = {}
        const rs = getComputedStyle(document.documentElement)
        for (const name of Array.from(rs)) {
          if (name.startsWith('--')) rootVars[name] = rs.getPropertyValue(name).trim().slice(0, 80)
        }
        const counts = {
          canvas: document.querySelectorAll('canvas').length,
          svg: document.querySelectorAll('svg').length,
          img: document.querySelectorAll('img').length,
          video: document.querySelectorAll('video').length,
          sections: document.querySelectorAll('section').length,
          buttons: document.querySelectorAll('button, a[class*=btn], a[class*=button]').length,
        }
        const headings = Array.from(document.querySelectorAll('h1,h2,h3'))
          .slice(0, 25)
          .map((h) => `${h.tagName} ${cs(h).fontSize}/${cs(h).fontWeight} :: ${(h.textContent || '').trim().slice(0, 60)}`)
        const buttons = Array.from(document.querySelectorAll('a,button'))
          .filter((el) => {
            const s = cs(el)
            return s.backgroundColor !== 'rgba(0, 0, 0, 0)' || s.borderStyle !== 'none'
          })
          .slice(0, 12)
          .map((el) => {
            const s = cs(el)
            return `"${(el.textContent || '').trim().slice(0, 24)}" bg=${s.backgroundColor} color=${s.color} r=${s.borderRadius} bd=${s.border} bf=${s.backdropFilter}`
          })
        const bgLayers = []
        for (const el of Array.from(document.querySelectorAll('body *')).slice(0, 4000)) {
          const s = cs(el)
          if (s.backgroundImage && s.backgroundImage !== 'none') {
            bgLayers.push(`${el.tagName}.${(el.className || '').toString().slice(0, 40)} => ${s.backgroundImage.slice(0, 220)}`)
          }
          if (bgLayers.length > 18) break
        }
        return {
          title: document.title,
          bodyBg: cs(document.body).backgroundColor,
          bodyFont: cs(document.body).fontFamily,
          bodyColor: cs(document.body).color,
          htmlClass: document.documentElement.className,
          samples: [
            grab('h1'),
            grab('h2'),
            grab('p'),
            grab('nav') || grab('header'),
            grab('footer'),
            grab('a[class*=btn]') || grab('button'),
          ].filter(Boolean),
          counts,
          headings,
          buttons,
          bgLayers,
          varCount: Object.keys(rootVars).length,
          rootVars: Object.fromEntries(Object.entries(rootVars).slice(0, 60)),
        }
      })
      fs.writeFileSync(`${OUT}/fingerprint.json`, JSON.stringify(info, null, 2))
      console.log('--- fingerprint written ---')
      console.log(JSON.stringify({ title: info.title, bodyBg: info.bodyBg, bodyFont: info.bodyFont, counts: info.counts, headings: info.headings }, null, 2))
    }
    await ctx.close()
  }

  await browser.close()
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
