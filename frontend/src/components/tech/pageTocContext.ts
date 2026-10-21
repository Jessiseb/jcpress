import { createContext, useContext } from 'react'

import type { TocItem } from '@/components/markdown/rehypeCollectHeadings'

/**
 * 详情页 → 外壳左栏的「本页目录」通道。
 *
 * 目录数据只能由 `ArticleDetailPage` 生产：小节 id 是 rehype-slug 在正文渲染时
 * 生成的，页头拿不到（正文还没渲染），外壳更拿不到（它在页面上方）。
 * 而目录要显示的位置在外壳里 —— 数据向上、节点向下，React 里没有直接的办法，
 * 于是外壳提供一个 setter，详情页把收集好的小节推上去。
 *
 * 为什么不用 `Outlet context`：那是父传子，方向相反，走不通。
 * 为什么不用 Portal 把 `<Toc>` 传进左栏：等 detail 响应回来时左栏 DOM 早就挂好了，
 * 但 `TechShell` 是列表/详情共用的外壳，portal 目标要额外维护 ref 与清理时机，
 * 换来的只是省一个 state。
 *
 * 值为 null 表示「当前不在详情页外壳里」（比如单测单独渲染详情页），
 * 此时详情页照常工作，只是左栏那份目录没人接。
 */
export const PageTocContext = createContext<((items: TocItem[]) => void) | null>(null)

export function usePublishPageToc() {
  return useContext(PageTocContext)
}
