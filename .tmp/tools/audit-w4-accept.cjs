const { chromium } = require('playwright-core')

/**
 * W4 出口手工验收（Task 5.11）—— 9 项清单的真实浏览器复核。
 *
 * 不是替代人工「看过」，而是把「看过」的结论固化成可复跑断言：
 * 每一条都落到具体选择器 / 文本 / URL / 数值，避免「我记得看过了」。
 *
 * 真实选择器（从源码核对）：
 *  - 编辑页：#article-title / #article-slug / #article-category / #article-summary / #article-tags
 *  - 编辑页按钮：「发布」（type=button）/「保存草稿」；保存成功后**回到列表**
 *  - 列表页：「新建文章」链接 / 每行「编辑」「撤回|发布」「删除」
 *  - 删除是**内联二次确认**：点「删除」→ 出现「确认删除？」→ 再点「删除」或「取消」
 *    （不是 window.confirm）
 */
const ORIGIN = 'http://127.0.0.1:5173'
const USER = 'admin'
const PASS = 'jcpress@2026'

let pass = 0
let fail = 0
const notes = []
const check = (label, ok, detail) => {
  if (ok) pass++
  else fail++
  console.log(`  ${ok ? '✔' : '✘'} ${label}${detail !== undefined ? ` — ${detail}` : ''}`)
  if (!ok) notes.push(`${label} — ${detail}`)
}

async function login(page) {
  await page.goto(`${ORIGIN}/admin/login`, { waitUntil: 'networkidle' })
  await page.fill('#admin-username', USER)
  await page.fill('#admin-password', PASS)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname.startsWith('/admin/articles'), { timeout: 20000 })
}

/** 相对亮度（Node 侧用，判定暗色底是否真的是深色）。 */
function pageLum(c) {
  const m = (c.match(/\d+/g) || []).map(Number)
  if (m.length < 3) return 1
  const [rr, gg, bb] = m.slice(0, 3).map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rr + 0.7152 * gg + 0.0722 * bb
}

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] })

  // ================= ① 首页 =================
  console.log('\n① 打开 /')
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' })
    const page = await ctx.newPage()
    await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)

    const sections = await page.locator('main section[aria-labelledby]').count()
    check('8 个区块', sections === 8, `实际 ${sections}`)

    const cards = await page.locator('[data-block="latest-articles"] a[href^="/tech/"]').count()
    const hasMore = await page.locator('[data-block="latest-articles"] a[href="/tech"]').count()
    check('新区块有条目 + 「查看全部」入口', cards >= 1 && hasMore >= 1, `条目=${cards} 查看全部=${hasMore}`)

    const first = page.locator('[data-block="latest-articles"] a[href^="/tech/"]').first()
    const href = await first.getAttribute('href')
    await first.click()
    await page.waitForFunction((h) => location.pathname === h, href, { timeout: 15000 })
    check('点第 1 条进入详情', new URL(page.url()).pathname === href, `→ ${new URL(page.url()).pathname}`)
    await ctx.close()
  }

  // ================= ② 详情页 =================
  console.log('\n② 详情页')
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' })
    const page = await ctx.newPage()
    await page.goto(`${ORIGIN}/tech/phase-3-backend-retro`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    const titleFont = await page.evaluate(() => {
      const h1 = document.querySelector('h1')
      return h1 ? getComputedStyle(h1).fontFamily : ''
    })
    check('标题用衬线（Article 家族）', /JCPress Serif SC Article/.test(titleFont), titleFont.slice(0, 70))

    const prose = await page.evaluate(() => {
      // 正文容器是 div[class*="prose"]（CSS Modules 会 hash 后缀）。
      // 不能用 `article p`：页头/相邻文章/页脚里也有 <p>，会测到小字（实测误命中 12px）
      const p = document.querySelector('div[class*="prose"] p')
      if (!p) return null
      const cs = getComputedStyle(p)
      const zero = document.createElement('span')
      zero.textContent = '0'
      zero.style.cssText = 'position:absolute;visibility:hidden;font:inherit'
      p.appendChild(zero)
      const w0 = zero.getBoundingClientRect().width
      zero.remove()
      return { fs: parseFloat(cs.fontSize), lhNum: parseFloat(cs.lineHeight), ch: w0 ? p.clientWidth / w0 : 0 }
    })
    check('正文 17px', prose !== null && Math.abs(prose.fs - 17) < 0.5, prose ? `${prose.fs}px` : '未找到 .prose p')
    check('行高 = 1.9', prose !== null && Math.abs(prose.lhNum - prose.fs * 1.9) < 1, prose ? `${(prose.lhNum / prose.fs).toFixed(2)}` : '-')
    check('栏宽 60–72ch', prose !== null && prose.ch >= 60 && prose.ch <= 72, prose ? `${prose.ch.toFixed(1)}ch` : '-')

    const h2 = await page.evaluate(() => {
      const el = document.querySelector('div[class*="prose"] h2')
      return el ? getComputedStyle(el, '::before').content : ''
    })
    check('h2 自动编号存在', /counter/.test(h2), h2)

    const copyBtn = await page
      .locator('button[aria-label*="复制"], button[title*="复制"]')
      .count()
    check('代码块复制按钮存在', copyBtn >= 1, `按钮 ${copyBtn} 个`)

    const toc = await page.evaluate(() => {
      // Toc 组件输出 nav[aria-label="文章目录"]
      const nav = document.querySelector('nav[aria-label="文章目录"]')
      if (!nav) return { ids: [], hit: 0 }
      const ids = Array.from(nav.querySelectorAll('a[href^="#"]'))
        .map((a) => a.getAttribute('href').slice(1))
        .filter(Boolean)
      return { ids, hit: ids.filter((id) => document.getElementById(id)).length }
    })
    check('TOC 锚点全部命中正文', toc.ids.length > 0 && toc.hit === toc.ids.length, `${toc.hit}/${toc.ids.length}`)

    // TOC 滚动高亮：当前项带 aria-current="location"
    const highlighted = await page.evaluate(async () => {
      const nav = document.querySelector('nav[aria-label="文章目录"]')
      if (!nav) return false
      const links = Array.from(nav.querySelectorAll('a[href^="#"]'))
      if (links.length < 2) return !!nav.querySelector('a[aria-current]')
      links[1].click()
      await new Promise((r) => setTimeout(r, 1500))
      return !!nav.querySelector('a[aria-current="location"]')
    })
    check('TOC 滚动/点击有高亮（aria-current）', highlighted, highlighted ? '' : '未见 aria-current')
    await ctx.close()
  }

  // ================= ③ 暗色 =================
  console.log('\n③ 切暗色')
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' })
    const page = await ctx.newPage()
    await page.goto(`${ORIGIN}/tech/phase-3-backend-retro`, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.documentElement.removeAttribute('data-reveal-armed'))
    await page.waitForTimeout(600)

    const r = await page.evaluate(() => {
      const lum = (c) => {
        const m = (c.match(/\d+/g) || []).map(Number)
        if (m.length < 3) return 0
        const [rr, gg, bb] = m.slice(0, 3).map((v) => {
          v /= 255
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
        })
        return 0.2126 * rr + 0.7152 * gg + 0.0722 * bb
      }
      const ratio = (a, b) => {
        const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
        return (x + 0.05) / (y + 0.05)
      }
      const bgOf = (el) => {
        let n = el
        while (n) {
          const bg = getComputedStyle(n).backgroundColor
          if (bg && !/rgba?\(0,\s*0,\s*0,\s*0\)/.test(bg)) return bg
          n = n.parentElement
        }
        return 'rgb(255,255,255)'
      }
      const out = {}
      for (const [k, sel] of [
        ['正文', 'article p, main p'],
        ['代码', 'article code, pre code'],
        ['引用', 'article blockquote'],
        ['表格', 'article td, article th'],
      ]) {
        const el = document.querySelector(sel)
        if (!el) continue
        out[k] = +ratio(getComputedStyle(el).color, bgOf(el)).toFixed(2)
      }
      return out
    })
    const vals = Object.values(r)
    check('暗色下正文/代码/引用/表格均 ≥4.5:1', vals.length > 0 && vals.every((v) => v >= 4.5), JSON.stringify(r))

    // 无浅色残留：页面底色应为深色
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    check('暗色下页面底色为深色（无浅色残留）', pageLum(bg) < 0.15, bg)
    await ctx.close()
  }

  // ================= ④ 375px =================
  console.log('\n④ 375px 宽')
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, colorScheme: 'light' })
    const page = await ctx.newPage()
    await page.goto(`${ORIGIN}/tech/phase-3-backend-retro`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)

    const ov = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }))
    check('无横向溢出', ov.sw <= ov.cw, `scrollWidth=${ov.sw} clientWidth=${ov.cw}`)

    const align = await page.evaluate(() => {
      const h1 = document.querySelector('h1')
      const p = document.querySelector('article p, main p')
      if (!h1 || !p) return null
      return Math.abs(h1.getBoundingClientRect().left - p.getBoundingClientRect().left)
    })
    check('窄屏单栏（标题与正文左边缘对齐）', align !== null && align < 2, `错位 ${align}px`)

    const tocCollapsed = await page.evaluate(() => {
      // 窄屏下 TOC 应是可展开的 <details>（默认收起）
      const d = document.querySelector('details')
      if (!d) return { exists: false }
      const summary = d.querySelector('summary')
      return { exists: true, open: d.open, hasSummary: !!summary, text: summary?.textContent?.trim().slice(0, 20) }
    })
    check(
      'TOC 折叠成可展开（details 默认收起）',
      tocCollapsed.exists && !tocCollapsed.open && tocCollapsed.hasSummary,
      JSON.stringify(tocCollapsed),
    )

    // 展开可用
    const canExpand = await page.evaluate(async () => {
      const d = document.querySelector('details')
      if (!d) return false
      d.querySelector('summary').click()
      await new Promise((r) => setTimeout(r, 400))
      return d.open
    })
    check('折叠的 TOC 可展开', canExpand, canExpand ? '' : '点击后未展开')
    await ctx.close()
  }

  // ================= ⑤ /tech =================
  console.log('\n⑤ /tech')
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' })
    const page = await ctx.newPage()
    await page.goto(`${ORIGIN}/tech`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)

    const cardInfo = await page.evaluate(() => {
      // 卡片 = 指向 /tech/<slug> 的链接且其内有标题
      const links = Array.from(document.querySelectorAll('a[href^="/tech/"]'))
      const cards = links.filter((a) => a.querySelector('h2, h3, [class*="title"]'))
      const covers = cards.filter(
        (a) => a.querySelector('img') || a.querySelector('[class*="overGlyph"], [class*="cover"]'),
      )
      return { cards: cards.length, covers: covers.length }
    })
    check('每张卡都有封面', cardInfo.cards > 0 && cardInfo.covers === cardInfo.cards, `卡=${cardInfo.cards} 有封面=${cardInfo.covers}`)

    const firstFull = await page.evaluate(() => {
      const first = Array.from(document.querySelectorAll('a[href^="/tech/"]')).find((a) =>
        a.querySelector('h2, h3, [class*="title"]'),
      )
      if (!first) return null
      const card = first.closest('li, article') || first
      const grid = card.parentElement
      if (!grid) return null
      return +(card.getBoundingClientRect().width / grid.getBoundingClientRect().width).toFixed(2)
    })
    check('首卡通栏', firstFull !== null && firstFull > 0.9, `占比 ${firstFull}`)

    const countLine = await page.evaluate(() => {
      const m = document.body.innerText.match(/(共|总)?\s*\d+\s*(篇|条|篇文章)/)
      return m ? m[0].trim() : null
    })
    check('计数行存在', countLine !== null, countLine)

    // 切分类/标签的刻度（卡片刻点）
    const filterCount = await page.evaluate(() => {
      // 分类/标签筛选控件：按钮或链接
      const btns = Array.from(document.querySelectorAll('button, a')).filter((el) =>
        /全部|Java|数据库|工程化|前端|后端/.test(el.textContent || ''),
      )
      return btns.length
    })
    check('分类/标签筛选控件存在（卡片刻度）', filterCount > 0, `控件 ${filterCount} 个`)
    await ctx.close()
  }

  // ================= ⑥ 登录 =================
  console.log('\n⑥ /admin/login')
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' })
    const page = await ctx.newPage()
    await page.goto(`${ORIGIN}/admin/login`, { waitUntil: 'networkidle' })

    await page.fill('#admin-username', USER)
    await page.fill('#admin-password', 'wrong-password-xyz')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2200)
    const errText = await page.evaluate(() => {
      const el = document.querySelector('[role="alert"], [class*="error"], [class*="Error"]')
      return el ? el.textContent.trim() : document.body.innerText.match(/密码|错误|失败|不正确/)?.[0] || ''
    })
    check('错口令有明确提示且不放行', page.url().includes('/admin/login') && errText.length > 0, `提示="${errText}"`)

    await page.fill('#admin-password', PASS)
    await page.click('button[type="submit"]')
    await page.waitForFunction(() => location.pathname.startsWith('/admin/articles'), { timeout: 20000 })
    // 列表数据是异步取的：只等 URL 变更会抢在 loading 之前，表格还没渲染出来
    await page.waitForSelector('table', { timeout: 20000 }).catch(() => {})
    const hasTable = await page.locator('table').count()
    check('对口令进入文章列表', page.url().includes('/admin/articles') && hasTable > 0, `表格 ${hasTable} 个`)
    await ctx.close()
  }

  // ================= ⑦⑧⑨ =================
  console.log('\n⑦ 后台编辑（新建 → 保存 → 发布 → 前台可见）')
  {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, colorScheme: 'light' })
    const page = await ctx.newPage()
    await login(page)

    const stamp = Date.now().toString().slice(-6)
    const title = `W4验收临时稿${stamp}`
    const slug = `w4-accept-${stamp}`

    await page.goto(`${ORIGIN}/admin/articles/new`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)

    await page.fill('#article-title', title)
    await page.fill('#article-slug', slug)
    await page.fill('#article-summary', 'W4 出口验收写入的临时摘要，用于验证保存与发布链路。')

    // 「分类」是必填（canSubmit 要求 categoryId !== ''），不选的话两个按钮都是 disabled
    await page.waitForFunction(
      () => document.querySelectorAll('#article-category option').length > 1,
      { timeout: 15000 },
    )
    const firstCat = await page.evaluate(() => {
      const opts = Array.from(document.querySelectorAll('#article-category option')).filter((o) => o.value)
      return opts[0]?.value ?? ''
    })
    await page.selectOption('#article-category', firstCat)
    check('分类可选且已选（必填项）', firstCat !== '', `categoryId=${firstCat}`)

    // 正文：CodeMirror
    const editor = page.locator('.cm-content').first()
    const hasEditor = (await editor.count()) > 0
    check('新建页有 CodeMirror 编辑器', hasEditor, hasEditor ? '' : '未找到 .cm-content')
    if (hasEditor) {
      await editor.click()
      await page.keyboard.type('## 验收小节\n\n这是 W4 出口验收写入的临时正文，用于验证保存与发布链路。\n')
    }
    await page.waitForTimeout(500)

    // 保存草稿 → 回列表
    const draftBtn = page.locator('button:has-text("保存草稿")')
    check('填齐必填后「保存草稿」可用', await draftBtn.isEnabled(), `disabled=${!(await draftBtn.isEnabled())}`)
    await draftBtn.click()
    await page.waitForFunction(() => location.pathname === '/admin/articles', { timeout: 20000 })
    await page.waitForSelector('table', { timeout: 20000 }).catch(() => {})
    check('保存后回到列表', page.url().endsWith('/admin/articles'), new URL(page.url()).pathname)

    const rowExists = await page.locator(`tr:has-text("${title}")`).count()
    check('新建稿出现在列表（草稿状态）', rowExists > 0, `行 ${rowExists}`)

    // 发布
    const row = page.locator(`tr:has-text("${title}")`).first()
    await row.locator('button:has-text("发布")').click()
    await page.waitForTimeout(2500)

    const pubBadge = await row.locator('text=已发布').count()
    check('发布后状态变为「已发布」', pubBadge > 0, `徽标 ${pubBadge}`)

    // 前台可见
    const front = await ctx.newPage()
    await front.goto(`${ORIGIN}/tech/${slug}`, { waitUntil: 'networkidle' })
    await front.waitForTimeout(1000)
    const frontTitle = await front.evaluate(() => document.querySelector('h1')?.textContent?.trim() ?? '')
    check('前台刷新可见（详情页标题吻合）', frontTitle === title, `前台 h1="${frontTitle}"`)
    await front.close()

    // ================= ⑧ 粘贴图片 =================
    console.log('\n⑧ 后台粘贴图片')
    {
      await page.goto(`${ORIGIN}/admin/articles/new`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(700)
      // 需要有标题+slug 才能保存；这里只验粘贴是否写入 markdown
      await page.fill('#article-title', `粘贴验收${stamp}`)
      await page.fill('#article-slug', `paste-accept-${stamp}`)

      const ed2 = page.locator('.cm-content').first()
      await ed2.click()

      const injected = await page.evaluate(async () => {
        const canvas = document.createElement('canvas')
        canvas.width = 8
        canvas.height = 8
        canvas.getContext('2d').fillRect(0, 0, 8, 8)
        const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'))
        const file = new File([blob], 'paste-test.png', { type: 'image/png' })
        const dt = new DataTransfer()
        dt.items.add(file)
        const target = document.querySelector('.cm-content')
        if (!target) return false
        const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
        return target.dispatchEvent(ev)
      })
      await page.waitForTimeout(3500)

      const md = await page.evaluate(() => document.querySelector('.cm-content')?.textContent ?? '')
      const m = md.match(/!\[[^\]]*\]\((\/api\/uploads\/|\/uploads\/)[^)]+\)/)
      check('粘贴后在正文写入 ![...](/uploads/...)', !!m, m ? m[0] : `正文="${md.slice(0, 80)}"`)

      // 图片可访问
      if (m) {
        const url = m[0].match(/\(([^)]+)\)/)[1]
        const full = url.startsWith('/api') ? `http://127.0.0.1:8080${url}` : `${ORIGIN}${url}`
        const res = await ctx.request.get(full)
        check('上传的图片可访问', res.ok(), `${res.status()} ${url}`)
      }
    }

    // ================= ⑨ 删除 =================
    console.log('\n⑨ 删除（内联二次确认）')
    {
      await page.goto(`${ORIGIN}/admin/articles`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(900)

      const row2 = page.locator(`tr:has-text("${title}")`).first()
      check('目标行在列表里', (await row2.count()) > 0, `行 ${await row2.count()}`)

      await row2.locator('button:has-text("删除")').first().click()
      await page.waitForTimeout(500)
      const confirmText = await row2.locator('text=确认删除？').count()
      check('点删除后出现二次确认', confirmText > 0, `确认文案 ${confirmText}`)

      // 先测「取消」不删
      const cancelBtn = row2.locator('button:has-text("取消")').first()
      if (await cancelBtn.count()) {
        await cancelBtn.click()
        await page.waitForTimeout(600)
        const stillThere = await page.locator(`tr:has-text("${title}")`).count()
        check('点「取消」不删除', stillThere > 0, `仍在 ${stillThere}`)
      }

      // 再真删
      const row3 = page.locator(`tr:has-text("${title}")`).first()
      await row3.locator('button:has-text("删除")').first().click()
      await page.waitForTimeout(500)
      await row3.locator('button:has-text("删除")').last().click()
      await page.waitForTimeout(2500)

      const goneFromList = await page.locator(`tr:has-text("${title}")`).count()
      check('确认后从列表消失', goneFromList === 0, `残留 ${goneFromList}`)

      const front2 = await ctx.newPage()
      await front2.goto(`${ORIGIN}/tech/${slug}`, { waitUntil: 'networkidle' })
      await front2.waitForTimeout(900)
      const gone = await front2.evaluate(() => /文章不存在|没找到|404|页面不存在/.test(document.body.innerText))
      const t2 = await front2.evaluate(() => document.querySelector('h1')?.textContent?.trim() ?? '')
      check('删除后前台不可见', gone || t2 !== title, `404文案=${gone} h1="${t2}"`)
      await front2.close()
    }

    await ctx.close()
  }

  await browser.close()
  console.log(`\n===== 手工验收清单：通过 ${pass}，失败 ${fail} =====`)
  if (notes.length) {
    console.log('\n未通过明细：')
    notes.forEach((n) => console.log(`  ✘ ${n}`))
  }
  process.exit(fail > 0 ? 1 : 0)
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(2)
})
