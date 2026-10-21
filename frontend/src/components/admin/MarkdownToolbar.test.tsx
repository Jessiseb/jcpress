import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import MarkdownToolbar, { TOOLBAR_ACTIONS, shortcutText } from './MarkdownToolbar'

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
    render(<MarkdownToolbar active={new Set()} onAction={() => undefined} />)

    expect(screen.getByRole('toolbar', { name: '格式工具条' })).toBeInTheDocument()
    for (const action of TOOLBAR_ACTIONS) {
      const button = screen.getByRole('button', { name: action.label })
      expect(button).toHaveAttribute('title', `${action.label}（${shortcutText(action.binding)}）`)
    }
  })

  it('当前格式的按钮按下去（aria-pressed），插入类按钮没有按下态', () => {
    render(<MarkdownToolbar active={new Set(['bold', 'h2'])} onAction={() => undefined} />)

    expect(screen.getByRole('button', { name: '加粗' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '二级标题' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '斜体' })).toHaveAttribute('aria-pressed', 'false')
    // 链接是插入动作，不存在"当前是不是链接"
    expect(screen.getByRole('button', { name: '链接' })).not.toHaveAttribute('aria-pressed')
  })

  it('点击把动作名派发出去', () => {
    const onAction = vi.fn()
    render(<MarkdownToolbar active={new Set()} onAction={onAction} />)

    screen.getByRole('button', { name: '加粗' }).click()
    expect(onAction).toHaveBeenCalledWith('bold')
  })
})
