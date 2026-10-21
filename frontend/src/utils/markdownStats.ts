/**
 * Markdown 的**结构计数**。
 *
 * 用途只有一个：AI 排版是"只动格式、不动内容"的任务，但模型偷偷删掉一个代码块或
 * 一整段，从渲染结果上是看不出来的（页面照样好看）。所以对比面板不逐行 diff ——
 * 排版本来就会改动绝大多数行 —— 而是数结构件：标题、代码块、链接、图片、表格行、
 * 列表项。**数量掉了就说明内容被动了**，这比红绿 diff 更能抓住真正该抓的问题。
 *
 * 纯函数，不碰 DOM，可单测。
 */

export interface MarkdownStats {
  /** 字符数（含空白） */
  chars: number
  headings: number
  codeBlocks: number
  links: number
  images: number
  tableRows: number
  listItems: number
}

/** 统计项的展示名与顺序，供 UI 直接遍历 */
export const STAT_ITEMS: Array<{ key: keyof MarkdownStats; label: string }> = [
  { key: 'chars', label: '字符数' },
  { key: 'headings', label: '标题' },
  { key: 'codeBlocks', label: '代码块' },
  { key: 'links', label: '链接' },
  { key: 'images', label: '图片' },
  { key: 'tableRows', label: '表格行' },
  { key: 'listItems', label: '列表项' },
]

const count = (text: string, pattern: RegExp): number => (text.match(pattern) ?? []).length

/** 图片语法同时匹配链接正则，所以链接数要把它减掉 */
const IMAGE_RE = /!\[[^\]]*\]\([^)]*\)/g

export function markdownStats(md: string | null | undefined): MarkdownStats {
  const source = md ?? ''
  const imageCount = count(source, IMAGE_RE)
  // 围栏成对出现；不成对（写到一半）时向下取整，不让计数虚高
  const fences = count(source, /^\s*```/gm)

  return {
    chars: source.length,
    headings: count(source, /^#{1,6}\s/gm),
    codeBlocks: Math.floor(fences / 2),
    links: count(source, /\[[^\]]*\]\([^)]*\)/g) - imageCount,
    images: imageCount,
    tableRows: count(source, /^\s*\|.*\|\s*$/gm),
    listItems: count(source, /^\s*(?:[-*+]|\d+[.)])\s/gm),
  }
}

/** 与另一份统计逐项比较，返回减少的项（内容疑似被删）。字符数不算"内容"凭证，故排除。 */
export function findRegressions(
  before: MarkdownStats,
  after: MarkdownStats,
): Array<{ label: string; from: number; to: number }> {
  return STAT_ITEMS.filter((item) => item.key !== 'chars')
    .map((item) => ({ label: item.label, from: before[item.key], to: after[item.key] }))
    .filter((item) => item.to < item.from)
}

/**
 * 排版整理的**合法增幅**上界：中英之间补空格、表格补分隔行、代码块补语言标注
 * 都会让字符数小幅上升，正常在 10% 以内。
 *
 * 超过这个数就不是格式问题了 —— 实测同一篇 3167 字的文章连续调三次，输出分别是
 * 3738 / 3117 / 3167，其中那次 +18% 就是模型擅自展开了内容。结构计数一个都没少，
 * 光看"有没有丢东西"发现不了，必须单独盯增幅。
 */
export const EXPANSION_RATIO = 0.2

/** 增幅超过阈值（返回增长百分比，未超过返回 null） */
export function findExpansion(before: MarkdownStats, after: MarkdownStats): number | null {
  if (before.chars === 0) return null
  const growth = (after.chars - before.chars) / before.chars
  return growth > EXPANSION_RATIO ? Math.round(growth * 100) : null
}
