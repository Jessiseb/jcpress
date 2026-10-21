import { markdown, markdownKeymap } from '@codemirror/lang-markdown'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { useEffect, useMemo, useRef, useState } from 'react'

import { formatAdminArticleAi, uploadImage } from '@/api/admin'
import { ApiError } from '@/api/client'
import type { AiFormatVO } from '@/api/types'
import AiFormatPanel, { type AiApplyPayload } from '@/components/admin/AiFormatPanel'
import MarkdownBody from '@/components/markdown/MarkdownBody'
import MarkdownToolbar, { TOOLBAR_ACTIONS, type ActionKey } from './MarkdownToolbar'
import {
  applyLinePrefix,
  detectActive,
  diffChange,
  insertCodeBlock,
  insertLink,
  insertTable,
  toggleInline,
  togglePaint,
  type EditResult,
  type EditState,
  type PaintOption,
} from './markdownCommands'
import styles from './MarkdownEditor.module.css'

interface Props {
  value: string
  onChange: (next: string) => void
  /** 标题：跟着 prompt 走，只帮模型判断语境，不进产出 */
  title?: string
  /** 表单里当前的元信息，供对比面板判断默认勾选与"会不会覆盖" */
  meta?: { summary: string; tags: string; slug: string }
  /** 用户在对比面板里勾选的元信息（正文由本组件自己写回编辑器） */
  onApplyMeta?: (next: { summary?: string; tags?: string[]; slug?: string }) => void
}

const EMPTY_META = { summary: '', tags: '', slug: '' }

/**
 * 把后端的错误码翻成"用户能照着做点什么"的话。
 * 后端原话（`ErrorCodeEnum`）已经可读，这里只补上**下一步动作**。
 */
function aiErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'AI 排版失败，请重试'
  switch (error.code) {
    case 50002:
      return 'AI 服务未配置：后端没有读到 JCPRESS_AI_API_KEY，配上 key 重启后可用'
    case 42901:
      return 'AI 排版调用过于频繁（每分钟 10 次），稍等片刻再试'
    case 50201:
      return error.message || 'AI 服务调用失败，请重试'
    default:
      return error.message || 'AI 排版失败'
  }
}

/** 动作 → 纯命令。改什么全在 `markdownCommands.ts` 里，这里只做分发。 */
function commandFor(action: ActionKey): (state: EditState) => EditResult {
  switch (action) {
    case 'bold':
      return (state) => toggleInline(state, 'bold')
    case 'italic':
      return (state) => toggleInline(state, 'italic')
    case 'strike':
      return (state) => toggleInline(state, 'strike')
    case 'code':
      return (state) => toggleInline(state, 'code')
    case 'h1':
    case 'h2':
    case 'h3':
      return (state) => applyLinePrefix(state, action)
    case 'quote':
    case 'bullet':
    case 'ordered':
      return (state) => applyLinePrefix(state, action)
    case 'link':
      return insertLink
    case 'codeBlock':
      return insertCodeBlock
    case 'table':
      return insertTable
  }
}

/**
 * 把命令结果落进编辑器。**只发改动的那一小段**（`diffChange`），不整篇替换 ——
 * 整篇替换会把一次加粗记成一次全文覆盖，撤销要按到全文那一步。
 *
 * 撤销分组不用 `isolateHistory`（同样是不想多 import 一个传递依赖）：这里发出的
 * 事务没有 `userEvent` 注解，而打字那条是 `input.type`，历史按 userEvent 分组，
 * 两者天然不在同一组，所以刚敲完字点加粗，撤销只回滚加粗那一下。
 */
function applyEdit(view: EditorView, command: (state: EditState) => EditResult) {
  const { state } = view
  const current: EditState = {
    text: state.doc.toString(),
    from: state.selection.main.from,
    to: state.selection.main.to,
  }
  const next = command(current)
  if (next.text === current.text && next.from === current.from && next.to === current.to) return

  view.dispatch({
    changes: diffChange(current.text, next.text),
    selection: { anchor: next.from, head: next.to },
  })
  view.focus()
}

/**
 * 工具条与快捷键共用的键位表：**遍历按钮清单**建出来的。
 * 加一个按钮就自动有快捷键，不会出现「按钮能点、快捷键忘了绑」。
 *
 * 优先级靠**声明顺序**而不是 `Prec.highest`：这条扩展在 `basicSetup` 之前进数组，
 * 同一层里靠前的扩展优先级更高。之所以不用 `Prec`：它来自 `@codemirror/state`，
 * 而这个包项目里没有直接声明（是 `codemirror` 的传递依赖），从 node_modules 直接
 * import 会和预打包产物里那份**变成两个实例**，facet 对不上、键位静默失效。
 * 反过来，这条键位表本来就不与默认键位冲突（`Mod-b` / `Mod-i` / `Mod-k` 都没人占），
 * 顺序够用。
 */
const FORMAT_KEYMAP = keymap.of(
  TOOLBAR_ACTIONS.map((action) => ({
    key: action.binding,
    run: (view: EditorView) => {
      applyEdit(view, commandFor(action.key))
      return true
    },
  })),
)

/**
 * 列表续行与反缩进（`@codemirror/lang-markdown` 自带，但**不随 `markdown()` 自动生效**，
 * 得自己挂）：在 `- ` 里按回车自动续一行 `- `，空条目上回车退掉标记。
 * 这是语雀/飞书里最容易被当成"富文本"的那一半体验 —— 光有工具条、列表还要手打
 * `- ` + 回车，用起来仍然是 Markdown 编辑器。
 */
const MARKDOWN_KEYMAP = keymap.of(markdownKeymap)

/**
 * Markdown 编辑器：左侧 CodeMirror 6、右侧实时预览（复用公开站的 `MarkdownBody`，
 * 所见即前台所得），并支持**直接粘贴图片即上传**（按 `Ctrl+V` 贴截图是最常见的写文动作）。
 *
 * 一条硬约束：**编辑器只在挂载时建一次**（`useEffect([], …)`）。
 * 若把 `value` 放进依赖，父组件每敲一个字都会重建 EditorView —— 光标会跳回开头、
 * 中文输入法会被打断。回写靠 `onChangeRef`（每次渲染刷新引用，不进依赖数组）。
 *
 * 同一条约束的推论：**AI 排版的结果不能靠改 `value` 生效** —— 那是外部状态，
 * 受控 props 变了 EditorView 不会跟着变。必须走 `viewRef.dispatch()` 把整篇替换掉，
 * 让编辑器自己发出变更、再由 updateListener 回调父组件。
 */
export default function MarkdownEditor({ value, onChange, title, meta, onApplyMeta }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const [uploading, setUploading] = useState(false)
  const [aiRunning, setAiRunning] = useState(false)
  const [aiResult, setAiResult] = useState<AiFormatVO | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  // 当前格式的签名（"bold,h2"）。存字符串而不是数组：比较便宜，也不会因为
  // 每次算出新数组就把组件重渲染一遍。
  const [activeSignature, setActiveSignature] = useState('')
  const activeSignatureRef = useRef('')
  const activeSet = useMemo(
    () => new Set(activeSignature.split(',').filter(Boolean)),
    [activeSignature],
  )
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!hostRef.current) return

    const insertUploadedImage = async (file: File, view: EditorView) => {
      setUploading(true)
      try {
        const uploaded = await uploadImage(file)
        const position = view.state.selection.main.head
        view.dispatch({ changes: { from: position, insert: `\n![${file.name}](${uploaded.url})\n` } })
      } finally {
        setUploading(false)
      }
    }

    const view = new EditorView({
      doc: value,
      parent: hostRef.current,
      extensions: [
        // 顺序有意义：同一层里靠前的扩展优先级更高，格式键位要排在 basicSetup 之前
        FORMAT_KEYMAP,
        MARKDOWN_KEYMAP,
        basicSetup,
        markdown(),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (!update.docChanged && !update.selectionSet) return
          const doc = update.state.doc.toString()
          if (update.docChanged) onChangeRef.current(doc)
          // 工具条按钮的按下态：跟着选区走，光标挪进粗体里按钮就亮
          const { from, to } = update.state.selection.main
          const signature = detectActive({ text: doc, from, to }).join(',')
          if (signature !== activeSignatureRef.current) {
            activeSignatureRef.current = signature
            setActiveSignature(signature)
          }
        }),
        // 粘贴上传：只截图片，其余粘贴交给编辑器默认行为
        EditorView.domEventHandlers({
          paste: (event: Event, editorView: EditorView) => {
            const clipboard = event as ClipboardEvent
            const file = Array.from(clipboard.clipboardData?.files ?? []).find((item) =>
              item.type.startsWith('image/'),
            )
            if (!file) return false
            event.preventDefault()
            void insertUploadedImage(file, editorView)
            return true
          },
        }),
      ],
    })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // 只在挂载时建一次编辑器：value 的后续变化由外部状态驱动，避免重建时丢光标
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * 外部 value → 编辑器的**单向同步**（编辑器挂载时 `value` 还是空的那次遗漏的后半程）。
   *
   * 编辑页的正文是异步到的：详情没回来之前表单是空的，而编辑器那时已经挂载完了 ——
   * 于是编辑器里**一片空白**。表单 state（`form.contentMd`）本身是对的，所以保存与 AI 排版
   * 拿到的正文都是完整的，但人在界面上看不到、也改不了正文。
   *
   * 不会和用户输入打架：自己敲字时 `doc` 已经等于 `value`，这里直接跳过；
   * 只有外部真的换了内容（首次回填、AI 排版应用）才会整篇替换。
   */
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === value) return
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
      selection: { anchor: value.length },
    })
  }, [value])

  /**
   * 左右两栏**按源文行号对齐**的滚动同步（2026-10-22 用户：「滑动的时候虽然能一起滑动，
   * 但是左右内容没有对应上」）。
   *
   * 之前两栏都没有自己的滚动：滚的是外层 `.body`，两边一起动 —— 看起来"同步"，
   * 但源码一行约 24px、渲染后的段落是 17px×1.9 再加段间距，还有代码块、表格这类
   * 高度完全不成比例的东西，越往下偏得越多。**按比例换算也治不了**，比例本身在变。
   *
   * 所以对齐的单位是「源文行号」：`rehypeSourceLines` 在每个顶层渲染块上留下
   * `data-src-line`，两边就都有了一把共同的尺子：
   * - 左 → 右：取编辑器视口顶部的行号，在锚点里找夹住它的两个块，按行号在两者之间插值；
   * - 右 → 左：取预览视口顶部落在哪两个锚点之间，反算行号，让编辑器把那一行滚到顶部。
   *
   * 两个方向各有自己的**静默窗**：程序化滚动会再触发一次 scroll 事件，不挡住的话
   * 两边会互相推着走。用「谁被程序滚过、多久之内不理它的 scroll」而不是一个全局锁，
   * 是因为全局锁会把用户自己连续拖动时的事件一起吃掉，手感变成每隔一段时间卡一下。
   */
  useEffect(() => {
    const view = viewRef.current
    const preview = previewRef.current
    if (!view || !preview) return

    const GUARD = 90
    let editorLockedUntil = 0
    let previewLockedUntil = 0

    /** 带行号的顶层渲染块，DOM 顺序就是行号递增顺序 */
    const anchors = () => Array.from(preview.querySelectorAll<HTMLElement>('[data-src-line]'))

    /** 元素在预览容器里的内容坐标（与当前滚到哪无关） */
    const contentTop = (el: HTMLElement) =>
      el.getBoundingClientRect().top - preview.getBoundingClientRect().top + preview.scrollTop

    /** 编辑器视口顶部那一行是第几行 */
    const editorTopLine = () => {
      const height = Math.max(view.scrollDOM.getBoundingClientRect().top - view.documentTop, 0)
      const pos = view.lineBlockAtHeight(Math.min(height, view.contentHeight)).from
      return view.state.doc.lineAt(pos).number
    }

    const previewTopLine = (list: HTMLElement[]) => {
      if (list.length === 0) return null
      const y = preview.scrollTop + 1
      let index = 0
      for (let i = 0; i < list.length; i += 1) {
        if (contentTop(list[i]) <= y) index = i
        else break
      }
      const line = Number(list[index].dataset.srcLine)
      const next = list[index + 1]
      if (!next) return line
      const nextLine = Number(next.dataset.srcLine)
      const span = contentTop(next) - contentTop(list[index])
      if (span <= 0 || nextLine <= line) return line
      const ratio = Math.min(Math.max((y - contentTop(list[index])) / span, 0), 1)
      return line + ratio * (nextLine - line)
    }

    const syncPreviewTo = (line: number) => {
      const list = anchors()
      if (list.length === 0) return
      let index = 0
      for (let i = 0; i < list.length; i += 1) {
        if (Number(list[i].dataset.srcLine) <= line) index = i
        else break
      }
      const top = contentTop(list[index])
      const currentLine = Number(list[index].dataset.srcLine)
      const next = list[index + 1]
      let target = top
      if (next) {
        const nextLine = Number(next.dataset.srcLine)
        const ratio =
          nextLine > currentLine
            ? Math.min(Math.max((line - currentLine) / (nextLine - currentLine), 0), 1)
            : 0
        target = top + ratio * (contentTop(next) - top)
      }
      previewLockedUntil = performance.now() + GUARD
      preview.scrollTop = Math.max(target, 0)
    }

    const syncEditorTo = (line: number) => {
      const target = Math.min(Math.max(Math.round(line), 1), view.state.doc.lines)
      editorLockedUntil = performance.now() + GUARD
      view.dispatch({
        // 不动光标，只滚动：用 effects 而不是 dispatch({selection})
        effects: EditorView.scrollIntoView(view.state.doc.line(target).from, { y: 'start' }),
      })
    }

    const onEditorScroll = () => {
      if (performance.now() < editorLockedUntil) return
      syncPreviewTo(editorTopLine())
    }
    const onPreviewScroll = () => {
      if (performance.now() < previewLockedUntil) return
      const line = previewTopLine(anchors())
      if (line !== null) syncEditorTo(line)
    }

    const scroller = view.scrollDOM
    scroller.addEventListener('scroll', onEditorScroll, { passive: true })
    preview.addEventListener('scroll', onPreviewScroll, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', onEditorScroll)
      preview.removeEventListener('scroll', onPreviewScroll)
    }
  }, [])

  const runAiFormat = async () => {
    if (value.trim() === '' || aiRunning) return
    setAiRunning(true)
    setAiError(null)
    setAiResult(null)
    try {
      const result = await formatAdminArticleAi({
        contentMd: value,
        title: title?.trim() ? title.trim() : undefined,
      })
      setAiResult(result)
    } catch (error) {
      setAiError(aiErrorMessage(error))
    } finally {
      setAiRunning(false)
    }
  }

  const applyAiResult = (payload: AiApplyPayload) => {
    const view = viewRef.current
    if (view) {
      // 整篇替换：走 dispatch 而不是改 props，编辑器才知道内容变了
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: payload.contentMd } })
    }
    if (payload.summary !== undefined || payload.tags !== undefined || payload.slug !== undefined) {
      onApplyMeta?.({ summary: payload.summary, tags: payload.tags, slug: payload.slug })
    }
    setAiResult(null)
  }

  const discardAiResult = () => {
    setAiResult(null)
    setAiError(null)
  }

  const runAction = (action: ActionKey) => {
    const view = viewRef.current
    if (!view) return
    applyEdit(view, commandFor(action))
  }

  const runPaint = (option: PaintOption) => {
    const view = viewRef.current
    if (!view) return
    applyEdit(view, (state) => togglePaint(state, option))
  }

  return (
    <div className={styles.wrap}>
      {aiError && (
        <p className={styles.aiError} role="alert">
          {aiError}
          <button className={styles.aiErrorClose} type="button" onClick={() => setAiError(null)}>
            知道了
          </button>
        </p>
      )}

      {aiResult && (
        <AiFormatPanel
          original={value}
          result={aiResult}
          current={meta ?? EMPTY_META}
          onApply={applyAiResult}
          onDiscard={discardAiResult}
        />
      )}

      <div className={styles.editor}>
        <div className={styles.pane}>
          <div className={styles.paneHead}>
            Markdown
            {uploading && <span className={styles.hint}>图片上传中…</span>}
            <button
              className={styles.aiBtn}
              type="button"
              onClick={() => void runAiFormat()}
              disabled={aiRunning || value.trim() === ''}
              title="让 AI 整理格式并抽取摘要、标签、slug（不改动技术内容）"
            >
              {aiRunning ? '排版中…' : 'AI 排版'}
            </button>
          </div>
          <MarkdownToolbar active={activeSet} onAction={runAction} onPaint={runPaint} />
          <div ref={hostRef} className={styles.cmHost} />
        </div>
        <div className={styles.pane}>
          <div className={styles.paneHead}>预览</div>
          <div ref={previewRef} className={styles.preview}>
            <MarkdownBody markdown={value} sourceLines />
          </div>
        </div>
      </div>
    </div>
  )
}
