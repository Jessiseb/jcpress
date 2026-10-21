import { describe, expect, it } from 'vitest'

import {
  applyLinePrefix,
  BG_PAINTS,
  detectActive,
  diffChange,
  insertCodeBlock,
  insertLink,
  insertTable,
  toggleInline,
  togglePaint,
  TONE_PAINTS,
  type EditResult,
  type EditState,
} from './markdownCommands'

/**
 * 修饰命令的算术在这里验，不依赖 CodeMirror（它在 jsdom 里跑不起来）。
 *
 * 每条都盯三样东西：**正文变了什么、选区落在哪、光标落在哪**。
 * 第三样最容易被忽略：包完粗体如果光标跑到末尾，连点两次就变成"删掉再重来"，
 * 手感立刻不对。
 */

const at = (text: string, from: number, to = from): EditState => ({ text, from, to })

const expectEdit = (result: EditResult, text: string, from: number, to = from) => {
  expect(result.text).toBe(text)
  expect([result.from, result.to]).toEqual([from, to])
}

describe('toggleInline', () => {
  it('选中文字后加粗，选区留在被加粗的文字上', () => {
    const result = toggleInline(at('前面粗体后面', 2, 4), 'bold')
    expectEdit(result, '前面**粗体**后面', 4, 6)
  })

  it('再点一次是取消，不是套第二层', () => {
    const result = toggleInline(at('前面**粗体**后面', 4, 6), 'bold')
    expectEdit(result, '前面粗体后面', 2, 4)
  })

  it('把标记一起选中也能取消', () => {
    const result = toggleInline(at('**粗体**', 0, 8), 'bold')
    expectEdit(result, '粗体', 0, 2)
  })

  it('空光标落在词中间时，包住整个词（汉字按连续汉字取词）', () => {
    const result = toggleInline(at('并发编程', 2), 'bold')
    expectEdit(result, '**并发编程**', 2, 6)
  })

  it('空光标落在空白处时，插入一对标记，光标停在中间', () => {
    const result = toggleInline(at('  ', 1), 'bold')
    expectEdit(result, ' **** ', 3, 3)
  })

  it('斜体与删除线各用自己的标记', () => {
    expectEdit(toggleInline(at('斜体', 0, 2), 'italic'), '*斜体*', 1, 3)
    expectEdit(toggleInline(at('划线', 0, 2), 'strike'), '~~划线~~', 2, 4)
  })

  it('行内代码遇到反引号时升级成双反引号', () => {
    expectEdit(toggleInline(at('a`b', 0, 3), 'code'), '``a`b``', 2, 5)
  })

  it('没有反引号时就是单反引号', () => {
    expectEdit(toggleInline(at('abc', 0, 3), 'code'), '`abc`', 1, 4)
  })
})

describe('applyLinePrefix', () => {
  it('单行变标题，光标停在前缀之后', () => {
    const result = applyLinePrefix(at('标题', 0), 'h2')
    expectEdit(result, '## 标题', 3, 3)
  })

  it('同一个标题再点一次是摘掉前缀，光标回到原位', () => {
    const result = applyLinePrefix(at('## 标题', 3), 'h2')
    expectEdit(result, '标题', 0, 0)
  })

  it('不同级别的标题是替换，不是叠加', () => {
    expectEdit(applyLinePrefix(at('### 标题', 4), 'h2'), '## 标题', 3, 3)
  })

  it('多行选区逐行加，结果整段选中', () => {
    const result = applyLinePrefix(at('一\n二', 0, 3), 'bullet')
    expectEdit(result, '- 一\n- 二', 0, 7)
  })

  it('空行跳过，不然列表中间会多一行孤零零的标记', () => {
    const result = applyLinePrefix(at('一\n\n二', 0, 4), 'ordered')
    expectEdit(result, '1. 一\n\n2. 二', 0, 10)
  })

  it('有序列表按行编号，取消时一起摘掉', () => {
    const added = applyLinePrefix(at('a\nb\nc', 0, 5), 'ordered')
    expect(added.text).toBe('1. a\n2. b\n3. c')
    expectEdit(applyLinePrefix(added, 'ordered'), 'a\nb\nc', 0, 5)
  })

  it('从列表换成引用，旧标记被换掉而不是叠加', () => {
    expectEdit(applyLinePrefix(at('- 条目', 0), 'quote'), '> 条目', 2, 2)
  })

  it('光标在行中间时，跟着前缀长度平移，仍然停在同一个字前面', () => {
    // 「粗体」两个字前面加 `> `，光标原本在「体」前面（列 1），加完应在列 3
    const result = applyLinePrefix(at('粗体', 1), 'quote')
    expectEdit(result, '> 粗体', 3, 3)
  })
})

describe('insertLink', () => {
  it('有选区时选中 URL，粘上去就覆盖占位符', () => {
    const result = insertLink(at('点这里', 0, 3))
    expect(result.text).toBe('[点这里](https://)')
    expect(result.text.slice(result.from, result.to)).toBe('https://')
  })

  it('没选区时选中「链接文字」，敲字直接替换', () => {
    const result = insertLink(at('', 0))
    expect(result.text).toBe('[链接文字](https://)')
    expect(result.text.slice(result.from, result.to)).toBe('链接文字')
  })
})

describe('insertCodeBlock', () => {
  it('选中几行时包进围栏里', () => {
    const result = insertCodeBlock(at('int a = 1;', 0, 10))
    expect(result.text).toBe('```\nint a = 1;\n```')
    expect(result.from).toBe(result.text.length)
  })

  it('没选区时插一对空围栏，光标落在围栏内', () => {
    const result = insertCodeBlock(at('', 0))
    expect(result.text).toBe('```\n\n```\n')
    expect(result.from).toBe(4)
  })

  it('插在段落后面时前后各留一个空行', () => {
    const result = insertCodeBlock(at('前面一段', 4))
    expect(result.text).toBe('前面一段\n\n```\n\n```\n')
  })
})

describe('insertTable', () => {
  it('光标停在第一个表头格里', () => {
    const result = insertTable(at('', 0))
    expect(result.text).toBe('| 列 | 列 |\n| --- | --- |\n|  |  |\n')
    expect(result.from).toBe(2)
    expect(result.text.slice(result.from, result.from + 1)).toBe('列')
  })
})

describe('detectActive', () => {
  it('认出粗体与斜体，`**` 不会让斜体跟着亮', () => {
    expect(detectActive(at('**粗体**', 3))).toContain('bold')
    expect(detectActive(at('**粗体**', 3))).not.toContain('italic')
    expect(detectActive(at('*斜体*', 2))).toContain('italic')
  })

  it('认出当前行的块级格式', () => {
    expect(detectActive(at('## 标题', 3))).toContain('h2')
    expect(detectActive(at('- 条目', 2))).toContain('bullet')
    expect(detectActive(at('> 引用', 2))).toContain('quote')
    expect(detectActive(at('1. 第一', 3))).toContain('ordered')
  })

  it('普通正文什么都不亮', () => {
    expect(detectActive(at('普通正文', 2))).toEqual([])
  })
})

describe('diffChange', () => {
  it('只圈出真正变的那一段', () => {
    expect(diffChange('abc', 'a**b**c')).toEqual({ from: 1, to: 2, insert: '**b**' })
  })

  it('前后缀都不动时是空改动', () => {
    expect(diffChange('abc', 'abc')).toEqual({ from: 3, to: 3, insert: '' })
  })

  it('纯追加只报追加的部分', () => {
    expect(diffChange('abc', 'abcd')).toEqual({ from: 3, to: 3, insert: 'd' })
  })
})

describe('togglePaint', () => {
  const red = TONE_PAINTS.find((paint) => paint.token === '红')!
  const blue = TONE_PAINTS.find((paint) => paint.token === '蓝')!
  const yellow = BG_PAINTS.find((paint) => paint.token === '黄底')!

  it('选中文字上红色：包一层 {红}…{/红}，选区留在文字上', () => {
    expectEdit(togglePaint(at('前面重点后面', 2, 4), red), '前面{红}重点{/红}后面', 5, 7)
  })

  it('再点同一个色是取消，不是套第二层', () => {
    expectEdit(togglePaint(at('前面{红}重点{/红}后面', 5, 7), red), '前面重点后面', 2, 4)
  })

  it('点另一个色是**换色**，源码里不留两层标记', () => {
    expectEdit(togglePaint(at('{红}重点{/红}', 3, 5), blue), '{蓝}重点{/蓝}', 3, 5)
  })

  it('底色和文字色是两个家族：红字上点黄底是叠加', () => {
    expectEdit(togglePaint(at('{红}重点{/红}', 3, 5), yellow), '{红}{黄底}重点{/黄底}{/红}', 7, 9)
  })

  it('手动把标记一起选进来再点同一个色 → 摘掉这一对', () => {
    // 选区要真的把 `{红}…{/红}` 整对框进来（开标记 3 字、闭标记 4 字）
    expectEdit(togglePaint(at('前{红}重点{/红}后', 1, 10), red), '前重点后', 1, 3)
  })

  it('空光标落在词上：给整个词上色（与加粗同一套取词规则）', () => {
    // 汉字按连续汉字取词，所以要拿空格把词隔开（否则整句算一个"词"）
    expectEdit(togglePaint(at('前面 重点 后面', 3), red), '前面 {红}重点{/红} 后面', 6, 8)
  })

  it('空光标且附近没有词：插一对空标记，光标落在中间', () => {
    expectEdit(togglePaint(at('', 0), red), '{红}{/红}', 3, 3)
  })
})

describe('detectActive 认得上色', () => {
  it('选区外包着 {红} 时报 tone:红', () => {
    expect(detectActive(at('{红}重点{/红}', 3, 5))).toContain('tone:红')
  })

  it('底色报 bg:黄底，与文字色互不冒充', () => {
    const active = detectActive(at('{黄底}重点{/黄底}', 4, 6))
    expect(active).toContain('bg:黄底')
    expect(active.some((key) => key.startsWith('tone:'))).toBe(false)
  })
})
