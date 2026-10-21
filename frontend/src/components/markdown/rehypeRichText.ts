/**
 * 正文里的「文字颜色 / 背景底色」（2026-10-22 用户：「需要支持给字体不同的颜色，
 * 还有和飞书一样的可以给选定的字体加背景颜色」）。
 *
 * 语法：`{红}这几个字是红的{/红}` / `{黄底}这句有底色{/黄底}`。
 *
 * 为什么自己定一套语法而不是直接写 HTML：
 * ① 渲染链里没有 `rehype-raw`，Markdown 里的 `<span style="color:red">` **不会生效**
 *    （react-markdown 默认把原始 HTML 当纯文本丢掉）。要让它生效就得引 `rehype-raw`，
 *    而它不做消毒 —— 后台一旦被撞库，正文里就能塞 `<img onerror>` 之类的载荷，
 *    这个代价远大于「少支持一种标准写法」。
 * ② 颜色要落成**语义化的类**，不是任意 `style`：站点有亮/暗两套主题，写死 `#c00`
 *    在深色底上会糊成一团；语义 token 才能跟着主题换色（见 markdown.module.css）。
 *
 * 定界符用中文花括号 + 色名，是为了让源码一眼能读：`{红}` 比 `{color:red}` 短，
 * 也不会和正文里的英文标点打架。未配对的标记原样保留（不会吃掉正文）。
 *
 * ⚠️ 必须在 `pre` / `code` 子树里停下：代码里的 `{红}` 是代码，不是格式。
 * 插件导出的是 **attacher**（两层函数）—— 见 decisions #140，写成 transformer
 * 会被 unified 当 attacher 调用，`tree` 是 undefined，静默什么也不做。
 */

interface HastNode {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
  value?: string
}

/** 文字颜色：源码里的色名 → `data-jc-tone` 的取值（都要在 markdown.module.css 里有定义） */
const TEXT_TONES: Record<string, string> = {
  红: 'red',
  橙: 'orange',
  绿: 'green',
  蓝: 'blue',
  紫: 'purple',
  灰: 'gray',
}

/** 背景底色：源码里的色名 → `data-jc-bg` 的取值。`底` 字是唯一的区分标记，别省。 */
const HIGHLIGHTS: Record<string, string> = {
  黄底: 'yellow',
  绿底: 'green',
  蓝底: 'blue',
  粉底: 'pink',
  紫底: 'purple',
  灰底: 'gray',
}

/** 工具条与解析共用的色名清单（顺序就是色板上排的顺序） */
export const TEXT_TONE_NAMES = Object.keys(TEXT_TONES)
export const HIGHLIGHT_NAMES = Object.keys(HIGHLIGHTS)

/** 背景色名要排在前面：`{绿底}` 不能被切成 `{绿` + `底}` */
const OPEN = /\{(黄底|绿底|蓝底|粉底|紫底|灰底|红|橙|绿|蓝|紫|灰)\}/

const SKIP = new Set(['pre', 'code', 'script', 'style'])

const textNode = (value: string): HastNode => ({ type: 'text', value })

const wrapperFor = (token: string, children: HastNode[]): HastNode | null => {
  const tone = TEXT_TONES[token]
  if (tone) return { type: 'element', tagName: 'span', properties: { dataJcTone: tone }, children }
  const bg = HIGHLIGHTS[token]
  if (bg) return { type: 'element', tagName: 'mark', properties: { dataJcBg: bg }, children }
  return null
}

/**
 * 处理一个容器的子节点列表（原地改写）。
 *
 * 分两支，因为一对标记可能落在同一个文本节点里，也可能被行内元素隔开：
 * `{红}文字**加粗**{/红}` 在 mdast 里已经是三个兄弟节点（text / strong / text），
 * 只处理单个文本节点的话这种写法会把 `{红}` 原样吐出来。
 */
function convertChildren(parent: HastNode) {
  const list = parent.children
  if (!list) return

  for (let i = 0; i < list.length; i += 1) {
    const node = list[i]
    if (!node) continue

    if (node.type === 'element') {
      if (!SKIP.has(node.tagName ?? '')) convertChildren(node)
      continue
    }
    if (node.type !== 'text') continue

    const value = node.value ?? ''
    const opened = OPEN.exec(value)
    if (!opened) continue

    const token = opened[1]
    const openEnd = opened.index + opened[0].length
    const closeTag = `{/${token}}`
    const wrapper = (children: HastNode[]) => wrapperFor(token, children)

    // ① 闭标记就在本节点后半段 —— 最常见的一条路径，没有跨节点拆合
    const same = value.indexOf(closeTag, openEnd)
    if (same !== -1) {
      const before = value.slice(0, opened.index)
      const inner = value.slice(openEnd, same)
      const after = value.slice(same + closeTag.length)
      const element = wrapper(inner === '' ? [] : [textNode(inner)])
      if (!element) continue
      // 同一段文本里也可能套着另一层：`{红}a{黄底}b{/黄底}c{/红}`
      convertChildren(element)

      // 替换当前位置：`before` 留在原位、元素接上；`after` 排进待处理队列 ——
      // 它里面可能还有下一对标记（连着标两段颜色是常规操作）
      const replacement: HastNode[] = []
      if (before !== '') replacement.push(textNode(before))
      replacement.push(element)
      if (after !== '') replacement.push(textNode(after))
      list.splice(i, 1, ...replacement)
      // 循环末尾还有一次 `i += 1`，这里先退到元素本身，让它正好落到 `after` 上
      i += before !== '' ? 1 : 0
      continue
    }

    // ② 闭标记在后面某个兄弟文本节点里；中间的行内元素整体算作被包裹的内容
    let closeIndex = -1
    let closeAt = -1
    for (let j = i + 1; j < list.length; j += 1) {
      const sibling = list[j]
      if (sibling?.type !== 'text') continue
      const at = (sibling.value ?? '').indexOf(closeTag)
      if (at !== -1) {
        closeIndex = j
        closeAt = at
        break
      }
    }
    // 找不到配对的闭标记：原样留着（说明作者就是想打一对花括号）
    if (closeIndex === -1) continue

    const before = value.slice(0, opened.index)
    const innerFirst = value.slice(openEnd)
    const closeValue = list[closeIndex]?.value ?? ''
    const innerLast = closeValue.slice(0, closeAt)
    const after = closeValue.slice(closeAt + closeTag.length)

    const inner: HastNode[] = []
    if (innerFirst !== '') inner.push(textNode(innerFirst))
    for (let j = i + 1; j < closeIndex; j += 1) {
      const sibling = list[j]
      if (sibling) inner.push(sibling)
    }
    if (innerLast !== '') inner.push(textNode(innerLast))

    const element = wrapper(inner)
    if (!element) continue
    // 嵌套：`{红}a{黄底}b{/黄底}c{/红}` 里层要再走一遍
    convertChildren(element)

    const replacement: HastNode[] = []
    if (before !== '') replacement.push(textNode(before))
    replacement.push(element)
    if (after !== '') replacement.push(textNode(after))
    // 换掉 i..closeIndex 这一段；下一轮从 `after` 开始（它可能还带标记）
    list.splice(i, closeIndex - i + 1, ...replacement)
    i += before !== '' ? 1 : 0
  }
}

export function rehypeRichText() {
  // 只包一层：`rehypePlugins` 里放的是**函数本身**，unified 会把它当 attacher 调用一次，
  // 返回值就是 transformer。多包一层的话返回的是「另一个函数」，unified 拿它当树用，
  // 渲染结果直接是空的 —— 而且不报错（第一版就是这么写的，整页正文空白）。
  return (tree: unknown) => {
    convertChildren(tree as HastNode)
  }
}
