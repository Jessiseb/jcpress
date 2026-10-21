import {
  Baseline,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link,
  List,
  ListOrdered,
  Quote,
  SquareCode,
  Strikethrough,
  Table,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { BG_PAINTS, TONE_PAINTS, type PaintOption } from './markdownCommands'
import styles from './MarkdownEditor.module.css'

/** 工具条能触发的动作。与 `MarkdownEditor` 里的命令表、键位表是**同一份清单**。 */
export type ActionKey =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'quote'
  | 'bullet'
  | 'ordered'
  | 'link'
  | 'codeBlock'
  | 'table'

export interface ToolbarAction {
  key: ActionKey
  /** 无障碍名称，也是 tooltip 的主文案 */
  label: string
  icon: LucideIcon
  /** CodeMirror 键位写法：`Mod` 在 Windows/Linux 上是 Ctrl、在 macOS 上是 ⌘ */
  binding: string
  /** 是否为开关（会读 `aria-pressed`）—— 链接/表格/代码块是插入，没有"当前是/不是" */
  toggle: boolean
  /** 与前面按钮之间是否分隔线 */
  groupStart?: boolean
}

/**
 * 工具条的按钮清单。
 *
 * `binding` 不只是给人看的提示：`MarkdownEditor` 建键位表时**直接遍历这个数组**，
 * 所以按钮和快捷键不可能对不上 —— 加一个按钮就自动带上快捷键，不存在
 * 「按钮能点、快捷键忘了绑」这种只在某天被人发现的不一致。
 *
 * 键位选的是语雀 / Typora / GitHub 的通行写法（`Mod-b` / `Mod-i` / `Mod-k` …），
 * 避开 CodeMirror 默认键位（`Mod-Shift-k` 是删行、`Mod-d` 是选下一个同名词之类）。
 *
 * 取色（文字色 / 底色）不在这张表里：它不是一个动作，是一族取值，没有快捷键，
 * 点开是一个色板 —— 见下面 `PaintButton`。
 */
export const TOOLBAR_ACTIONS: readonly ToolbarAction[] = [
  { key: 'bold', label: '加粗', icon: Bold, binding: 'Mod-b', toggle: true },
  { key: 'italic', label: '斜体', icon: Italic, binding: 'Mod-i', toggle: true },
  { key: 'strike', label: '删除线', icon: Strikethrough, binding: 'Mod-Shift-x', toggle: true },
  { key: 'code', label: '行内代码', icon: Code, binding: 'Mod-e', toggle: true },

  { key: 'h1', label: '一级标题', icon: Heading1, binding: 'Mod-Alt-1', toggle: true, groupStart: true },
  { key: 'h2', label: '二级标题', icon: Heading2, binding: 'Mod-Alt-2', toggle: true },
  { key: 'h3', label: '三级标题', icon: Heading3, binding: 'Mod-Alt-3', toggle: true },

  { key: 'quote', label: '引用', icon: Quote, binding: 'Mod-Shift-q', toggle: true, groupStart: true },
  { key: 'bullet', label: '无序列表', icon: List, binding: 'Mod-Shift-8', toggle: true },
  { key: 'ordered', label: '有序列表', icon: ListOrdered, binding: 'Mod-Shift-7', toggle: true },

  { key: 'link', label: '链接', icon: Link, binding: 'Mod-k', toggle: false, groupStart: true },
  { key: 'codeBlock', label: '代码块', icon: SquareCode, binding: 'Mod-Alt-c', toggle: false },
  { key: 'table', label: '表格', icon: Table, binding: 'Mod-Alt-t', toggle: false },
]

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

const MAC_SYMBOL: Record<string, string> = { Mod: '⌘', Shift: '⇧', Alt: '⌥', Ctrl: '⌃' }

/** `Mod-Shift-x` → macOS `⌘⇧X` / Windows `Ctrl+Shift+X` */
export function shortcutText(binding: string): string {
  const parts = binding.split('-')
  const last = parts.pop() ?? ''
  const key = last.length === 1 ? last.toUpperCase() : last
  if (IS_MAC) return parts.map((part) => MAC_SYMBOL[part] ?? part).join('') + key
  return [...parts.map((part) => (part === 'Mod' ? 'Ctrl' : part)), key].join('+')
}

interface Props {
  /** 当前选区已经是哪些格式（`detectActive` 的输出，含 `tone:红` / `bg:黄底`） */
  active: ReadonlySet<string>
  onAction: (key: ActionKey) => void
  /** 选中一个颜色（文字色或底色），由 MarkdownEditor 落到编辑器里 */
  onPaint: (option: PaintOption) => void
}

/**
 * 编辑区上方的格式工具条（点击修饰，2026-10-20 用户要的「像飞书和语雀那样」）。
 *
 * 只做展示与派发：改什么由 `markdownCommands.ts` 决定，落到编辑器里由 `MarkdownEditor` 做。
 *
 * 一个细节：按钮的 `onMouseDown` 要 `preventDefault()`。不拦的话，点按钮的瞬间
 * 焦点从编辑器跑到按钮上，`window.getSelection()` 那一套在视觉上就"选区没了" ——
 * 虽然 CodeMirror 自己记着选区，但人会以为刚才选的字丢了。拦掉之后焦点一直留在
 * 编辑区，点完还能接着敲字。键盘操作不受影响：Tab 到按钮再按 Enter 照样触发 click。
 */
export default function MarkdownToolbar({ active, onAction, onPaint }: Props) {
  // 同一时刻只开一个色板；点空白处或 Esc 收起
  const [openKind, setOpenKind] = useState<'tone' | 'bg' | null>(null)
  // 色板往哪边展开：靠右端时往左展开，否则会被面板的 overflow: hidden 切掉
  const [popAlign, setPopAlign] = useState<'left' | 'right'>('left')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openKind) return
    const closeOnOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenKind(null)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenKind(null)
    }
    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [openKind])

  const paintButton = (
    kind: 'tone' | 'bg',
    label: string,
    Icon: LucideIcon,
    options: readonly PaintOption[],
  ) => {
    const open = openKind === kind
    // 当前选区已经上了这一族的某个色：按钮亮起，让人知道再点一次是取消
    const pressed = options.some((option) => active.has(`${kind}:${option.token}`))
    return (
      <span className={styles.paintWrap}>
        <button
          type="button"
          className={styles.toolBtn}
          aria-label={label}
          aria-haspopup="true"
          aria-expanded={open}
          aria-pressed={pressed}
          title={label}
          data-active={pressed ? 'on' : undefined}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            if (open) {
              setOpenKind(null)
              return
            }
            // 色板宽约 160px：右边放不下就往左展开
            setPopAlign(window.innerWidth - event.currentTarget.getBoundingClientRect().right < 190 ? 'right' : 'left')
            setOpenKind(kind)
          }}
        >
          <Icon size={15} strokeWidth={2} aria-hidden="true" />
        </button>

        {open && (
          <div className={styles.paintPop} role="group" aria-label={label} data-align={popAlign}>
            {options.map((option) => {
              const current = active.has(`${kind}:${option.token}`)
              return (
                <button
                  key={option.token}
                  type="button"
                  className={styles.swatchBtn}
                  aria-label={option.label}
                  aria-pressed={current}
                  title={current ? `${option.label}（再点取消）` : option.label}
                  data-active={current ? 'on' : undefined}
                  // 底色色块用背景色、文字色色块用前景色，看起来才像"这个色"
                  style={
                    kind === 'bg'
                      ? { background: option.swatch }
                      : { color: option.swatch, fontWeight: 600 }
                  }
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onPaint(option)
                    setOpenKind(null)
                  }}
                >
                  {kind === 'bg' ? '' : 'A'}
                </button>
              )
            })}
          </div>
        )}
      </span>
    )
  }

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="格式工具条">
      <div ref={rootRef} className={styles.toolbarItems}>
        {TOOLBAR_ACTIONS.map((action) => {
          const Icon = action.icon
          const pressed = action.toggle ? active.has(action.key) : undefined
          return (
            <span key={action.key} className={styles.toolbarItem}>
              {action.groupStart && <span className={styles.toolbarSep} aria-hidden="true" />}
              <button
                type="button"
                className={styles.toolBtn}
                aria-label={action.label}
                aria-pressed={pressed}
                title={`${action.label}（${shortcutText(action.binding)}）`}
                data-active={pressed ? 'on' : undefined}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onAction(action.key)}
              >
                <Icon size={15} strokeWidth={2} aria-hidden="true" />
              </button>
            </span>
          )
        })}

        <span className={styles.toolbarItem}>
          <span className={styles.toolbarSep} aria-hidden="true" />
          {paintButton('tone', '文字颜色', Baseline, TONE_PAINTS)}
          {paintButton('bg', '文字底色', Highlighter, BG_PAINTS)}
        </span>
      </div>
    </div>
  )
}
