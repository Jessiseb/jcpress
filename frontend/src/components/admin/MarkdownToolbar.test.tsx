import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import MarkdownToolbar, { TOOLBAR_ACTIONS, shortcutText } from './MarkdownToolbar'
import { BG_PAINTS, TONE_PAINTS } from './markdownCommands'

const noop = () => undefined

/**
 * 工具条只是展示层，但有两件事值得锁住：
 * ① 每个按钮都能被无障碍名称找到（只有图标的按钮，`aria-label` 是唯一的入口）；
 * ② 键位不重复 —— 复制一行改 label 时最容易忘掉 binding，而重复的键位
 *    CodeMirror 不会报错，只会静默地只有一个生效。
 */
describe('MarkdownToolbar', () => {
  it('键位标注按平台渲染（jsdom 不是 mac）', () => {
    expect(shortcutText('Mod-b')).toBe('Ctrl+B')
    expect(shortcutText('Mod-Shift-x')).toBe('Ctrl+Shift+X')
    expect(shortcutText('Mod-Alt-2')).toBe('Ctrl+Alt+2')
  })

  it('键位互不重复', () => {
    const bindings = TOOLBAR_ACTIONS.map((action) => action.binding.toLowerCase())
    expect(new Set(bindings).size).toBe(bindings.length)
  })

  it('每个按钮都能按名称找到，且带上快捷键提示', () => {
    render(<MarkdownToolbar active={new Set()} onAction={noop} onPaint={noop} />)

    expect(screen.getByRole('toolbar', { name: '格式工具条' })).toBeInTheDocument()
    for (const action of TOOLBAR_ACTIONS) {
      const button = screen.getByRole('button', { name: action.label })
      expect(button).toHaveAttribute('title', `${action.label}（${shortcutText(action.binding)}）`)
    }
  })

  it('当前格式的按钮按下去（aria-pressed），插入类按钮没有按下态', () => {
    render(<MarkdownToolbar active={new Set(['bold', 'h2'])} onAction={noop} onPaint={noop} />)

    expect(screen.getByRole('button', { name: '加粗' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '二级标题' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '斜体' })).toHaveAttribute('aria-pressed', 'false')
    // 链接是插入动作，不存在"当前是不是链接"
    expect(screen.getByRole('button', { name: '链接' })).not.toHaveAttribute('aria-pressed')
  })

  it('点击把动作名派发出去', () => {
    const onAction = vi.fn()
    render(<MarkdownToolbar active={new Set()} onAction={onAction} onPaint={noop} />)

    fireEvent.click(screen.getByRole('button', { name: '加粗' }))
    expect(onAction).toHaveBeenCalledWith('bold')
  })

  it('取色器：点开才出色板，选色后派发并收起', () => {
    const onPaint = vi.fn()
    render(<MarkdownToolbar active={new Set()} onAction={noop} onPaint={onPaint} />)

    // 默认是收起的 —— 12 个色块不该常驻在工具条里
    expect(screen.queryByRole('group', { name: '文字颜色' })).toBeNull()

    const trigger = screen.getByRole('button', { name: '文字颜色' })
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    const swatches = screen.getAllByRole('button', { name: /文字$/ })
    expect(swatches).toHaveLength(TONE_PAINTS.length)

    fireEvent.click(screen.getByRole('button', { name: '蓝色文字' }))
    expect(onPaint).toHaveBeenCalledWith(TONE_PAINTS.find((paint) => paint.token === '蓝'))
    // 选完自动收起：接着可能还要选底色，别让人手动关
    expect(screen.queryByRole('group', { name: '文字颜色' })).toBeNull()
  })

  it('取色器：底色那一排是另外 6 个，不与文字色混在一起', () => {
    render(<MarkdownToolbar active={new Set()} onAction={noop} onPaint={noop} />)

    fireEvent.click(screen.getByRole('button', { name: '文字底色' }))
    expect(screen.getAllByRole('button', { name: /色底色$/ })).toHaveLength(BG_PAINTS.length)
    // 打开底色板不会顺带把文字色板也打开
    expect(screen.queryByRole('group', { name: '文字颜色' })).toBeNull()
  })

  it('当前选区已上色时，对应色块与入口按钮都标成按下态', () => {
    render(<MarkdownToolbar active={new Set(['tone:红', 'bg:黄底'])} onAction={noop} onPaint={noop} />)

    expect(screen.getByRole('button', { name: '文字颜色' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '文字底色' })).toHaveAttribute('aria-pressed', 'true')
  })
})
