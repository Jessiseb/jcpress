import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { useEffect, useRef, useState } from 'react'

import { uploadImage } from '@/api/admin'
import MarkdownBody from '@/components/markdown/MarkdownBody'
import styles from './MarkdownEditor.module.css'

interface Props {
  value: string
  onChange: (next: string) => void
}

/**
 * Markdown 编辑器：左侧 CodeMirror 6、右侧实时预览（复用公开站的 `MarkdownBody`，
 * 所见即前台所得），并支持**直接粘贴图片即上传**（按 `Ctrl+V` 贴截图是最常见的写文动作）。
 *
 * 一条硬约束：**编辑器只在挂载时建一次**（`useEffect([], …)`）。
 * 若把 `value` 放进依赖，父组件每敲一个字都会重建 EditorView —— 光标会跳回开头、
 * 中文输入法会被打断。回写靠 `onChangeRef`（每次渲染刷新引用，不进依赖数组）。
 */
export default function MarkdownEditor({ value, onChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [uploading, setUploading] = useState(false)
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
        basicSetup,
        markdown(),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString())
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
    return () => view.destroy()
    // 只在挂载时建一次编辑器：value 的后续变化由外部状态驱动，避免重建时丢光标
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={styles.editor}>
      <div className={styles.pane}>
        <div className={styles.paneHead}>
          Markdown
          {uploading && <span className={styles.hint}>图片上传中…</span>}
        </div>
        <div ref={hostRef} className={styles.cmHost} />
      </div>
      <div className={styles.pane}>
        <div className={styles.paneHead}>预览</div>
        <div className={styles.preview}>
          <MarkdownBody markdown={value} />
        </div>
      </div>
    </div>
  )
}
