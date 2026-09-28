const fs = require('fs')

const BASE = 'https://21st-aura-svelte-preview-jdpo1k26v-larsen3.vercel.app'
const OUT = 'C:/Users/O/Desktop/myproject/jcpress/.tmp/ref'

;(async () => {
  const res = await fetch(BASE + '/')
  const html = await res.text()
  fs.writeFileSync(`${OUT}/aura-index.html`, html)

  const links = [...html.matchAll(/(?:href|src)=["']([^"']+\.(?:css|js))["']/g)].map((m) => m[1])
  const uniq = [...new Set(links)]
  console.log('assets:', uniq.join(' '))

  const cssPath = uniq.find((u) => u.endsWith('.css'))
  if (!cssPath) {
    console.log('no css asset referenced directly; scanning html for <link>')
    const links2 = [...html.matchAll(/<link[^>]+>/g)].map((m) => m[0])
    console.log(links2.slice(0, 10).join('\n'))
    return
  }

  const url = cssPath.startsWith('http') ? cssPath : BASE + cssPath
  const r2 = await fetch(url)
  const css = await r2.text()
  fs.writeFileSync(`${OUT}/aura.css`, css)
  console.log('css url:', url, 'bytes:', css.length)

  const show = (label, re, max) => {
    const hits = [...css.matchAll(re)].map((m) => m[0])
    console.log(`\n=== ${label}: ${hits.length} ===`)
    hits.slice(0, max || 5).forEach((h) => console.log('---\n' + h.slice(0, 420)))
  }

  show('repeating-radial-gradient', /repeating-radial-gradient\([^;}]{0,400}/g, 6)
  show('radial-gradient(circle', /radial-gradient\(circle[^;}]{0,300}/g, 8)
  show('color tokens', /--color-[a-z-]+:\s*[^;]+;/g, 30)
  show('font tokens', /--font-[a-z-]+:\s*[^;]+;/g, 10)
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
