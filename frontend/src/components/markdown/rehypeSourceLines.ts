/**
 * 给渲染出来的每个顶层块打上「它来自源文第几行」的标记（`data-src-line`）。
 *
 * 这是左右两栏**按内容对齐**滚动的前提（2026-10-22 用户：「滑动的时候虽然能一起滑动，
 * 但是左右内容没有对应上」）。两栏各滚各的、按比例换算是不够的 —— 源码一行约 24px，
 * 渲染后的段落是 17px / 1.9 行高再加段间距，比例在文本区、代码块、表格之间差得很远，
 * 越往下滚偏得越多。只有把「源文行号」与「渲染块的位置」显式对上，才谈得上对齐。
 *
 * 只打**根节点的直接子节点**：它们的行号天然递增，正好可以做插值锚点；
 * 打满整棵树只会在公开站的 HTML 里多出一堆没人用的属性。
 *
 * 与 `rehypeCollectHeadings` 同一个约定：导出 attacher（两层函数），理由见 decisions #140。
 */

interface HastNode {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  position?: { start?: { line?: number } }
  children?: HastNode[]
}

export function rehypeSourceLines() {
  // 一层：数组里放的是函数本身，unified 调用一次后拿到的就是 transformer（同 rehypeRichText）
  return (tree: unknown) => {
    const root = tree as HastNode
    for (const node of root.children ?? []) {
      // hast 的 children 允许有「空洞」，直接解引用会崩（同 rehypeCollectHeadings）
      if (!node || node.type !== 'element') continue
      const line = node.position?.start?.line
      if (typeof line !== 'number') continue
      node.properties = { ...node.properties, dataSrcLine: line }
    }
  }
}
