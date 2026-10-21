/**
 * TOC 数据源：从渲染后的 hast 树里收集 h2/h3。
 *
 * **必须排在 `rehype-slug` 之后**：id 是它加的，只有这样目录里的锚点才与 DOM 完全一致。
 * 自己再算一遍 slug 迟早会与 github-slugger 的规则漂移（中文标题尤其容易）。
 *
 * 为什么自己写 15 行递归而不是引 `unist-util-visit`：那是一个只为遍历而存在的依赖，
 * 而本项目的依赖纪律是"每加一个都要能说清为什么"（二期一期只加 1 个依赖）。
 */

export interface TocItem {
  id: string
  text: string
  level: 2 | 3
}

interface HastNode {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
  value?: string
}

const textOf = (node: HastNode): string => {
  if (node.type === 'text') return node.value ?? ''
  return (node.children ?? []).map(textOf).join('')
}

/**
 * ⚠️ 必须返回**两层函数**。`rehypePlugins` 收的是 attacher（拿到 processor、返回 transformer），
 * 不是 transformer 本身。原来这里直接返回 transformer，unified 会把它当 attacher 调用一次 ——
 * 传进去的 `tree` 其实是 undefined，walk 立刻返回，收集到的永远是一个空数组，而且不报错。
 * 这条失败只在「回调收没收到东西」这一层能看出来，页面上表现为「目录一直空着」。
 */
export function rehypeCollectHeadings(collect: (items: TocItem[]) => void) {
  return () => (tree: unknown) => {
    const items: TocItem[] = []
    const walk = (node: HastNode | undefined) => {
      // hast 的 children 数组允许有「空洞」（undefined 占位），直接解引用会崩。
      // 这个坑只在真实文章上暴露：单元测试的 markdown 片段恰好没有空洞。
      if (!node) return
      if (node.tagName === 'h2' || node.tagName === 'h3') {
        const id = node.properties?.id
        if (typeof id === 'string') {
          items.push({ id, text: textOf(node), level: node.tagName === 'h2' ? 2 : 3 })
        }
      }
      ;(node.children ?? []).forEach(walk)
    }
    walk(tree as HastNode)
    collect(items)
  }
}
