/**
 * Markdown 修饰命令：**纯函数**，输入一段正文 + 选区，输出改完的正文 + 新选区。
 *
 * 为什么不直接写 CodeMirror 命令：编辑器在 jsdom 里跑不起来（它要真实的布局测量与
 * requestAnimationFrame），AdminArticleEditPage 的单测至今还得用一个 textarea 顶替它。
 * 把「改成什么」和「怎么落到编辑器里」拆开之后，所有容易出错的算术（标记该插在哪、
 * 光标该停在中间还是后面、取消加粗时该删哪两个字符）都能用字符串单测覆盖，
 * 剩下的那层 dispatch 只有五行。
 *
 * 语义对齐语雀 / 飞书：按钮是**开关**而不是插入器 —— 选中的文字已经是粗体时再点一次
 * 是去掉，不是再套一层 `****粗体****`。
 */

export interface EditState {
  text: string
  from: number
  to: number
}

export interface EditResult {
  text: string
  from: number
  to: number
}

/* ────────────────────────── 行内：加粗 / 斜体 / 删除线 / 行内代码 ────────────────────────── */

export type InlineKind = 'bold' | 'italic' | 'strike' | 'code'

const INLINE_MARKER: Record<Exclude<InlineKind, 'code'>, string> = {
  bold: '**',
  italic: '*',
  strike: '~~',
}

/**
 * 行内代码的定界符要看内容：ContentMarkdown 里一个反引号包不住含反引号的文本，
 * 得升级成双反引号（`` `a` `` 那种写法在 CommonMark 里是合法的）。
 */
const codeMarker = (inner: string) => (inner.includes('`') ? '``' : '`')

const markerOf = (kind: InlineKind, inner = '') =>
  kind === 'code' ? codeMarker(inner) : INLINE_MARKER[kind]

/**
 * 光标处的「词」：ASCII 字母数字、下划线与汉字都算词内字符。
 * 汉字按整段连续汉字取词 —— 光标停在「并发」中间时点加粗，包住整个「并发编程」
 * 才算合理，只包住一个字没有意义。
 */
const WORD_CHAR = /[0-9A-Za-z_\u00c0-\u024f\u3400-\u9fff]/

const isWordChar = (char: string | undefined) => char !== undefined && WORD_CHAR.test(char)

function wordAt(text: string, pos: number): { from: number; to: number } | null {
  if (!isWordChar(text[pos]) && !isWordChar(text[pos - 1])) return null
  let from = pos
  let to = pos
  while (from > 0 && isWordChar(text[from - 1])) from -= 1
  while (to < text.length && isWordChar(text[to])) to += 1
  return from === to ? null : { from, to }
}

export function toggleInline(state: EditState, kind: InlineKind): EditResult {
  const { text } = state
  let from = state.from
  let to = state.to

  // 空选区：先把光标下的词选中，让它像语雀那样「点一下就把这个词变粗」
  if (from === to) {
    const word = wordAt(text, from)
    if (word) {
      from = word.from
      to = word.to
    }
  }

  const inner = text.slice(from, to)
  const marker = markerOf(kind, inner)
  const size = marker.length

  // ① 标记紧贴在选区外侧（最常见的往返路径：刚加粗完又点一次）
  if (
    from >= size &&
    text.slice(from - size, from) === marker &&
    text.slice(to, to + size) === marker
  ) {
    return {
      text: text.slice(0, from - size) + inner + text.slice(to + size),
      from: from - size,
      to: from - size + inner.length,
    }
  }

  // ② 标记被一起选进来了（手动框住 `**粗体**` 这四个字符再点按钮）
  if (inner.length >= size * 2 && inner.startsWith(marker) && inner.endsWith(marker)) {
    const stripped = inner.slice(size, inner.length - size)
    return {
      text: text.slice(0, from) + stripped + text.slice(to),
      from,
      to: from + stripped.length,
    }
  }

  // ③ 空光标、附近也没有词：插入一对标记，光标落在中间，接着敲字就是粗体
  if (from === to) {
    const caret = from + size
    return {
      text: text.slice(0, from) + marker + marker + text.slice(from),
      from: caret,
      to: caret,
    }
  }

  // ④ 包起来，选中里面的文字（连点两次就又回到 ①，不会越套越深）
  return {
    text: text.slice(0, from) + marker + inner + marker + text.slice(to),
    from: from + size,
    to: from + size + inner.length,
  }
}

/* ────────────────────────── 行内：文字颜色 / 底色 ────────────────────────── */

export type PaintKind = 'tone' | 'bg'

export interface PaintOption {
  /** 源码里的色名，也是 `{红}…{/红}` 的定界符 */
  token: string
  /** 色板上读给读屏器的名字 */
  label: string
  kind: PaintKind
  /**
   * 色块颜色，**只用于色板预览**。正文实际渲染的颜色在
   * `components/markdown/markdown.module.css`（亮暗各一套）—— 两处都对上才有意义，
   * 所以 `probe-md-toolbar.cjs` 会拿渲染结果的 `color` 与这里逐一比对，改单边会被抓出来。
   */
  swatch: string
}

export const TONE_PAINTS: readonly PaintOption[] = [
  { token: '红', label: '红色文字', kind: 'tone', swatch: '#b3261e' },
  { token: '橙', label: '橙色文字', kind: 'tone', swatch: '#95500a' },
  { token: '绿', label: '绿色文字', kind: 'tone', swatch: '#1f6b3a' },
  { token: '蓝', label: '蓝色文字', kind: 'tone', swatch: '#1a5fb4' },
  { token: '紫', label: '紫色文字', kind: 'tone', swatch: '#6a3fa0' },
  { token: '灰', label: '灰色文字', kind: 'tone', swatch: '#5c6470' },
]

export const BG_PAINTS: readonly PaintOption[] = [
  { token: '黄底', label: '黄色底色', kind: 'bg', swatch: '#fdf0ad' },
  { token: '绿底', label: '绿色底色', kind: 'bg', swatch: '#d5f0dd' },
  { token: '蓝底', label: '蓝色底色', kind: 'bg', swatch: '#d9e8fb' },
  { token: '粉底', label: '粉色底色', kind: 'bg', swatch: '#fbdfe5' },
  { token: '紫底', label: '紫色底色', kind: 'bg', swatch: '#e9defb' },
  { token: '灰底', label: '灰色底色', kind: 'bg', swatch: '#e8eaee' },
]

/** 两族色名分开匹配：`{绿}` 与 `{绿底}` 是两种不同的东西，不能互相吃掉。 */
const PAINT_FAMILY: Record<PaintKind, RegExp> = {
  tone: /(红|橙|绿|蓝|紫|灰)/,
  bg: /(黄底|绿底|蓝底|粉底|紫底|灰底)/,
}

const openOf = (token: string) => `{${token}}`
const closeOf = (token: string) => `{/${token}}`

/** 选区外侧紧贴着的那一对标记是什么色（含「哪一族」），没有就是 null。 */
function wrappedToken(
  text: string,
  from: number,
  to: number,
  kind: PaintKind,
): { token: string; openSize: number; closeSize: number } | null {
  const family = PAINT_FAMILY[kind]
  const head = text.slice(Math.max(from - 8, 0), from)
  const tail = text.slice(to, to + 8)
  const openMatch = /\{([^}\/]{1,3})\}$/.exec(head)
  const closeMatch = /^\{(\/[^}]{1,3})\}/.exec(tail)
  if (!openMatch || !closeMatch) return null
  const token = openMatch[1]
  if (closeMatch[1].slice(1) !== token) return null
  if (!family.test(token)) return null
  // 开标记与闭标记**不一样长**：`{红}` 三个字符，`{/红}` 四个 —— 用一个 size 会多删/少删一个字符
  return { token, openSize: openMatch[0].length, closeSize: closeMatch[0].length }
}

/**
 * 给选中的文字上色（文字色或底色），再点同一个色是取消，点另一个色是**换色**。
 *
 * 「换色而不是叠加」这条是刻意的：`{红}{蓝}字{/蓝}{/红}` 在渲染上等于蓝色，
 * 但源码里留下了两层没人能看懂的标记，再点几次会越套越深。语雀/飞书里换色就是换色。
 */
export function togglePaint(state: EditState, option: PaintOption): EditResult {
  const { text } = state
  let from = state.from
  let to = state.to

  // 空选区：先选中光标下的词，和加粗那套一致
  if (from === to) {
    const word = wordAt(text, from)
    if (word) {
      from = word.from
      to = word.to
    }
  }

  const open = openOf(option.token)
  const close = closeOf(option.token)
  const inner = text.slice(from, to)

  // ① 外面包着的就是这一个色 → 整个摘掉
  const current = wrappedToken(text, from, to, option.kind)
  if (current && current.token === option.token) {
    return {
      text: text.slice(0, from - current.openSize) + inner + text.slice(to + current.closeSize),
      from: from - current.openSize,
      to: from - current.openSize + inner.length,
    }
  }

  // ② 外面包着同族的另一个色 → 换色，别套第二层
  if (current) {
    const before = text.slice(0, from - current.openSize)
    const after = text.slice(to + current.closeSize)
    return {
      text: `${before}${open}${inner}${close}${after}`,
      from: before.length + open.length,
      to: before.length + open.length + inner.length,
    }
  }

  // ③ 标记被一起框进选区了（手动选中 `{红}字{/红}` 再点）→ 摘掉这一对
  if (inner.length >= open.length + close.length && inner.startsWith(open) && inner.endsWith(close)) {
    const stripped = inner.slice(open.length, inner.length - close.length)
    return {
      text: text.slice(0, from) + stripped + text.slice(to),
      from,
      to: from + stripped.length,
    }
  }

  // ④ 空光标、附近也没有词：插一对空标记，光标落在中间
  if (from === to) {
    const caret = from + open.length
    return {
      text: text.slice(0, from) + open + close + text.slice(from),
      from: caret,
      to: caret,
    }
  }

  // ⑤ 包起来，选中里面的文字
  return {
    text: text.slice(0, from) + open + inner + close + text.slice(to),
    from: from + open.length,
    to: from + open.length + inner.length,
  }
}

/* ────────────────────────── 块级：标题 / 引用 / 列表 ────────────────────────── */

export type BlockKind = 'h1' | 'h2' | 'h3' | 'quote' | 'bullet' | 'ordered'

/**
 * 一行开头的块级标记。注意 `>` 后面不一定有空格（`>引用` 在 Markdown 里合法），
 * 所以引用那一支写的是 `>[\t ]?` 而不是 `>[\t ]`。
 */
const LINE_PREFIX = /^([ \t]*)(#{1,6}[ \t]+|>[ \t]?|[-*+][ \t]+|\d+[.)][ \t]+)/

interface LineParts {
  indent: string
  marker: string
  rest: string
}

function splitLine(line: string): LineParts {
  const matched = LINE_PREFIX.exec(line)
  if (!matched) return { indent: '', marker: '', rest: line }
  return { indent: matched[1], marker: matched[2], rest: line.slice(matched[0].length) }
}

/** 把一行归到「哪一类块」：用于判断要不要取消（同类才整体摘掉，不同类就整体换掉）。 */
function groupOf(marker: string): string | null {
  if (marker === '') return null
  if (marker[0] === '#') return `h${marker.replace(/[^#]/g, '').length}`
  if (marker[0] === '>') return 'quote'
  if (/^\d/.test(marker)) return 'ordered'
  return 'bullet'
}

const markerFor = (kind: BlockKind, ordinal: number) => {
  switch (kind) {
    case 'h1':
      return '# '
    case 'h2':
      return '## '
    case 'h3':
      return '### '
    case 'quote':
      return '> '
    case 'bullet':
      return '- '
    case 'ordered':
      return `${ordinal}. `
  }
}

const lineStartAt = (text: string, pos: number) => text.lastIndexOf('\n', pos - 1) + 1

const lineEndAt = (text: string, pos: number) => {
  const index = text.indexOf('\n', pos)
  return index === -1 ? text.length : index
}

/**
 * 对选区覆盖到的**每一行**加/去块级标记。
 *
 * - 全部行都已经是这一类 → 整体摘掉（再点一次就取消）；
 * - 否则整体加上：已有的**旧块标记会被换掉**（`### 标题` 点 H2 得到 `## 标题`，
 *   `- 条目` 点引用得到 `> 条目`），而不是叠成 `> - 条目` 那种没人想读的东西；
 * - 空行跳过，不然列表中间会多出一行孤零零的 `- `。
 */
export function applyLinePrefix(state: EditState, kind: BlockKind): EditResult {
  const { text, from, to } = state
  const blockStart = lineStartAt(text, from)
  const blockEnd = lineEndAt(text, to)
  const block = text.slice(blockStart, blockEnd)
  const lines = block.split('\n')

  const target = groupOf(markerFor(kind, 1))
  const filled = lines.filter((line) => line.trim() !== '')
  const allMatch = filled.length > 0 && filled.every((line) => groupOf(splitLine(line).marker) === target)

  let ordinal = 0
  const nextLines = lines.map((line) => {
    if (line.trim() === '') return line
    const { indent, rest } = splitLine(line)
    if (allMatch) return indent + rest
    ordinal += 1
    return indent + markerFor(kind, ordinal) + rest
  })
  const nextBlock = nextLines.join('\n')
  const next = text.slice(0, blockStart) + nextBlock + text.slice(blockEnd)

  if (from !== to) {
    // 选了一段：结果整段选中，方便接着做下一个动作
    return { text: next, from: blockStart, to: blockStart + nextBlock.length }
  }

  // 光标：留在原来那一行的同一个「字」前面，跟着前缀长度的变化平移
  const caretOffset = from - blockStart
  const lineIndex = block.slice(0, caretOffset).split('\n').length - 1
  const lineOffset = blockStart + block.slice(0, caretOffset).lastIndexOf('\n') + 1
  const column = from - lineOffset

  const oldParts = splitLine(lines[lineIndex])
  const newParts = splitLine(nextLines[lineIndex])
  const oldPrefix = oldParts.indent.length + oldParts.marker.length
  const newPrefix = newParts.indent.length + newParts.marker.length
  const kept = Math.min(Math.max(column - oldPrefix, 0), newParts.rest.length)

  const newLineOffset =
    blockStart + nextLines.slice(0, lineIndex).reduce((sum, line) => sum + line.length + 1, 0)
  const caret = newLineOffset + newPrefix + kept
  return { text: next, from: caret, to: caret }
}

/* ────────────────────────── 插入：链接 / 代码块 / 表格 ────────────────────────── */

const LINK_PLACEHOLDER = 'https://'

/**
 * 链接：选中文字时把它变成链接文字，并且**选中 URL 那一段** —— 下一步一定是粘贴，
 * 选中状态能让粘贴直接覆盖掉占位符，不用再手点一次。
 */
export function insertLink(state: EditState): EditResult {
  const { text, from, to } = state
  const selected = text.slice(from, to)

  if (selected !== '') {
    const snippet = `[${selected}](${LINK_PLACEHOLDER})`
    const urlFrom = from + 1 + selected.length + 2
    return {
      text: text.slice(0, from) + snippet + text.slice(to),
      from: urlFrom,
      to: urlFrom + LINK_PLACEHOLDER.length,
    }
  }

  const snippet = `[链接文字](${LINK_PLACEHOLDER})`
  return {
    text: text.slice(0, from) + snippet + text.slice(from),
    from: from + 1,
    to: from + 1 + '链接文字'.length,
  }
}

/**
 * 把一段独立内容插到光标处，前后各留一个空行（Markdown 里代码块与表格
 * 不吃空行就会被上面的段落吞掉），并把光标放进块里指定的位置。
 */
function insertBlock(state: EditState, block: string, caretOffset: number): EditResult {
  const { text, from } = state
  const before = text.slice(0, from).replace(/\n+$/, '')
  const after = text.slice(from).replace(/^\n+/, '')
  const lead = before === '' ? '' : '\n\n'
  const trail = after === '' ? '\n' : '\n\n'
  const caret = before.length + lead.length + caretOffset
  return { text: before + lead + block + trail + after, from: caret, to: caret }
}

const EMPTY_FENCE = '```\n\n```'

/**
 * 代码块：选中几行代码时把它们**包进围栏**（语雀就是这么做的），
 * 没选就插一对空围栏、光标落在里面。
 */
export function insertCodeBlock(state: EditState): EditResult {
  const { text, from, to } = state
  const selected = text.slice(from, to)
  if (selected !== '') {
    const snippet = `\`\`\`\n${selected}\n\`\`\``
    return {
      text: text.slice(0, from) + snippet + text.slice(to),
      from: from + snippet.length,
      to: from + snippet.length,
    }
  }
  // 光标落在第一对围栏的下一行
  return insertBlock(state, EMPTY_FENCE, 4)
}

export const EMPTY_TABLE = '| 列 | 列 |\n| --- | --- |\n|  |  |'

/** 表格骨架：2×2，光标停在第一个表头格里（那里最先要改）。 */
export const insertTable = (state: EditState): EditResult => insertBlock(state, EMPTY_TABLE, 2)

/* ────────────────────────── 按钮状态 ────────────────────────── */

const isWrapped = (text: string, from: number, to: number, marker: string) => {
  const size = marker.length
  if (from < size) return false
  if (text.slice(from - size, from) !== marker) return false
  if (text.slice(to, to + size) !== marker) return false
  // `**粗体**` 里的 `*` 不该让「斜体」按钮跟着亮起来
  if (marker === '*' && text[from - 2] === '*') return false
  return true
}

/**
 * 当前选区「已经是哪些格式」。给工具栏的 `aria-pressed` 用 ——
 * 按钮不亮的时候，人根本不知道再点一次是加还是取消。
 */
export function detectActive(state: EditState): string[] {
  const { text } = state
  const active: string[] = []

  // 光标只是一个点的时候，按「光标所在的那个词」来判断 —— 人停在粗体词里面
  // 就会认为「现在是粗体」，不会先把词选起来再看按钮。
  let from = state.from
  let to = state.to
  if (from === to) {
    const word = wordAt(text, from)
    if (word) {
      from = word.from
      to = word.to
    }
  }

  for (const kind of ['bold', 'italic', 'strike'] as const) {
    if (isWrapped(text, from, to, INLINE_MARKER[kind])) active.push(kind)
  }
  if (isWrapped(text, from, to, '`')) active.push('code')

  // 文字色 / 底色：给 `tone:红` `bg:黄底` 两种键，色板据此标出「当前是哪个色」
  for (const kind of ['tone', 'bg'] as const) {
    const wrapped = wrappedToken(text, from, to, kind)
    if (wrapped) active.push(`${kind}:${wrapped.token}`)
  }

  const group = groupOf(splitLine(text.slice(lineStartAt(text, state.from), lineEndAt(text, state.from))).marker)
  if (group) active.push(group)

  return active
}

/* ────────────────────────── 落回编辑器 ────────────────────────── */

export interface TextChange {
  from: number
  to: number
  insert: string
}

/**
 * 只发**最小改动**，不整篇替换。
 *
 * 整篇替换在 CodeMirror 里不是不生效，而是副作用太多：撤销历史会把整篇文章记成一步
 * （按一次 Ctrl+Z 回到上一版全文）、滚动位置与折叠状态跟着抖、以后接协同编辑时
 * 一次加粗会变成一次全文覆盖。命令本来就只动一小段，前后缀一比对就能把范围收到那一小段里。
 */
export function diffChange(before: string, after: string): TextChange {
  const shortest = Math.min(before.length, after.length)
  let start = 0
  while (start < shortest && before.charCodeAt(start) === after.charCodeAt(start)) start += 1

  let tailBefore = before.length
  let tailAfter = after.length
  while (
    tailBefore > start &&
    tailAfter > start &&
    before.charCodeAt(tailBefore - 1) === after.charCodeAt(tailAfter - 1)
  ) {
    tailBefore -= 1
    tailAfter -= 1
  }

  return { from: start, to: tailBefore, insert: after.slice(start, tailAfter) }
}
