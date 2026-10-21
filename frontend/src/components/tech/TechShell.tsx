import { useState } from 'react'
import { Outlet, useMatch } from 'react-router-dom'

import Toc from '@/components/markdown/Toc'
import type { TocItem } from '@/components/markdown/rehypeCollectHeadings'

import TechSidebar from './TechSidebar'
import { PageTocContext } from './pageTocContext'
import styles from './TechShell.module.css'

/**
 * 「技术分享」的外壳。左栏目录**只在文章详情页挂**，列表页没有这条栏。
 *
 * 列表页为什么不要左栏（2026-10-16，用户看过第一版截图后的要求）：
 * 列表页本身已经是「按分类分组、一行一篇」的完整索引，左边再立一条同样的清单，
 * 同一份结构在屏幕上出现两次 —— 用户的原话是「没有点击具体的文章的那个页面不需要有左侧」。
 * 一条栏要在它**提供新信息**的时候才该存在：进了文章正文之外只剩面包屑，
 * 那时左栏才第一次给出「这一区还有哪些、我在哪一篇」，位置感是它挣来的。
 *
 * 当前篇用 `useMatch` 反查而不是 `useParams`：外壳是父级路由，子级参数在这里拿不到。
 * 用 `useMatch('/tech/:slug')` 而不是自己切 `pathname` 字符串，是为了让
 * 「算不算详情页」这件事由路由表说了算 —— 以后再挂 `/tech/:slug/xxx` 这类子路径时，
 * 字符串切法会悄悄把 slug 取成整段，这里不会。
 *
 * 页内目录（小节清单）原先在正文右边单开一栏，2026-10-20 撤掉搬到这里来：
 * 用户在加宽正文之后仍然说「感觉中间还是不够宽」。右栏那 176px 是最后一块
 * 可以还给正文的地方 —— 而它本来就是一份「导航」，和左栏这条是同一类东西。
 * 搬运之后内容栏 828px 整条归正文（48 汉字/行），左右两条栏则合成一条。
 */
export default function TechShell() {
  const slug = useMatch('/tech/:slug')?.params.slug ?? ''
  // 窄屏默认收起：目录在正文上方，展开时会把内容顶下去
  const [navOpen, setNavOpen] = useState(false)
  // 详情页收集完小节后推上来（见 pageTocContext.ts）
  const [pageToc, setPageToc] = useState<TocItem[]>([])

  return (
    <PageTocContext.Provider value={setPageToc}>
      <div className={`container ${styles.shell}`} data-page={slug ? 'detail' : 'list'}>
        {/* 无 slug（列表页）时整条栏连同窄屏的折叠条一起不渲染 ——
            不是用 CSS 藏起来：藏起来的节点仍在无障碍树外被人靠 Tab 摸到 */}
        {slug && (
          <aside className={styles.rail}>
            {/* 窄屏展开/收起。桌面由 CSS 隐藏（display:none 会一并移出无障碍树，
                所以桌面不存在「按钮说收起、内容却可见」的矛盾态） */}
            <button
              type="button"
              className={styles.railToggle}
              aria-expanded={navOpen}
              aria-controls="tech-catalog"
              onClick={() => setNavOpen((open) => !open)}
            >
              <span>目录</span>
              <span className={styles.railToggleMark} aria-hidden="true">
                {navOpen ? '收起' : '展开'}
              </span>
            </button>

            <div id="tech-catalog" className={styles.railBody} data-open={navOpen ? 'on' : 'off'}>
              {/* 页内目录放在文章清单**前面**：它是随页变化的，位置要固定；
                  清单是长列表，排在后面被滚走不影响「这篇讲什么」的判断。
                  没有小节（空文档 / 还在取）时整块不渲染，不占位。 */}
              {pageToc.length > 0 && (
                <div className={styles.railPageToc}>
                  <Toc items={pageToc} title="本页目录" />
                </div>
              )}
              <TechSidebar activeSlug={slug} />
            </div>
          </aside>
        )}

        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </PageTocContext.Provider>
  )
}
