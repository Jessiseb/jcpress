import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ApiError } from '@/api/client'
import type { ArticleSavePayload } from '@/api/types'
import MarkdownEditor from '@/components/admin/MarkdownEditor'
import { useCategories } from '@/hooks/useCategories'
import { useAdminArticle, useSaveAdminArticle } from '@/hooks/useAdminArticles'
import AdminLayout from './AdminLayout'
import styles from './admin.module.css'

/** slug 只允许 a-z 0-9 与连字符（后端同规则，见规划 §3）。 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** 含中日韩统一表意文字（中文标题无法自动转 slug，必须手填）。 */
const HAS_CJK = /[\u3400-\u9fff]/

interface FormState {
  title: string
  slug: string
  summary: string
  categoryId: string
  tags: string
  coverUrl: string
  contentMd: string
}

const EMPTY: FormState = {
  title: '',
  slug: '',
  summary: '',
  categoryId: '',
  tags: '',
  coverUrl: '',
  contentMd: '',
}

/**
 * 编辑页。`useParams().id === 'new'` 走新建；否则拉详情回填。
 *
 * 一处刻意的**提交前拦截**：中文标题 + 空 slug 必须在本地拦下。
 * 后端不支持中文标题自动转 slug（会报错），如果放过去，用户会在点「保存」之后
 * 才看到一句后端报错 —— 不如在提交前就告诉他「中文标题请手填英文 slug」。
 */
export default function AdminArticleEditPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new'
  const navigate = useNavigate()

  const { data: article, isPending: loadingArticle, isError: articleError } =
    useAdminArticle(id)
  const { data: categories } = useCategories()
  const save = useSaveAdminArticle()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // 回填：详情到位后把后端数据灌进表单（新建分支保持 EMPTY）
  useEffect(() => {
    if (!article) return
    setForm({
      title: article.title,
      slug: article.slug,
      summary: article.summary ?? '',
      categoryId: article.categoryId ?? '',
      tags: article.tags.join(', '),
      coverUrl: article.coverUrl ?? '',
      contentMd: article.contentMd ?? '',
    })
  }, [article])

  const patch = (partial: Partial<FormState>) => setForm((prev) => ({ ...prev, ...partial }))

  /** 返回错误信息（null = 通过）。中文标题 + 空 slug 是本地特判。 */
  const validateSlug = (): string | null => {
    const slug = form.slug.trim()
    if (slug === '') {
      if (HAS_CJK.test(form.title)) return '中文标题请手填英文 slug（如 my-first-post）'
      return null // 空 slug + 纯英文标题：交给后端自动生成
    }
    if (!SLUG_PATTERN.test(slug)) return 'slug 只能用小写字母、数字与连字符'
    return null
  }

  const buildPayload = (status: number): ArticleSavePayload => ({
    title: form.title.trim(),
    slug: form.slug.trim() === '' ? undefined : form.slug.trim(),
    summary: form.summary.trim() === '' ? undefined : form.summary.trim(),
    coverUrl: form.coverUrl.trim() === '' ? undefined : form.coverUrl.trim(),
    categoryId: form.categoryId,
    tags: form.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag !== ''),
    contentMd: form.contentMd,
    status,
  })

  const submit = (status: number) => {
    const error = validateSlug()
    setSlugError(error)
    if (error) return
    if (form.categoryId === '') return

    save.mutate(
      { id: isNew ? null : (id as string), payload: buildPayload(status) },
      {
        onSuccess: () => {
          setSavedAt(Date.now())
          // 保存成功后回到列表（新建时尤其要回，否则地址栏还停在 'new'）
          navigate('/admin/articles')
        },
      },
    )
  }

  if (!isNew && loadingArticle) {
    return (
      <AdminLayout>
        <p className={styles.state}>正在加载文章…</p>
      </AdminLayout>
    )
  }

  if (!isNew && articleError) {
    return (
      <AdminLayout>
        <p className={`${styles.state} ${styles.stateError}`}>
          加载文章失败：{save.error instanceof ApiError ? save.error.message : '请返回列表重试'}
        </p>
      </AdminLayout>
    )
  }

  const canSubmit = form.title.trim() !== '' && form.categoryId !== '' && !save.isPending
  const saveError =
    save.error instanceof ApiError ? save.error.message : save.error ? '保存失败' : null

  return (
    <AdminLayout>
      <div className={styles.editHead}>
        <h1 className={styles.editTitle}>{isNew ? '新建文章' : '编辑文章'}</h1>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="article-title">
            标题
          </label>
          <input
            id="article-title"
            className={styles.input}
            value={form.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="article-slug">
            slug（URL 短名）
          </label>
          <input
            id="article-slug"
            className={styles.input}
            value={form.slug}
            placeholder="留空则用英文标题自动生成"
            onBlur={() => setSlugError(validateSlug())}
            onChange={(e) => patch({ slug: e.target.value })}
          />
          {slugError && <p className={styles.fieldError}>{slugError}</p>}
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="article-category">
            分类
          </label>
          <select
            id="article-category"
            className={styles.select}
            value={form.categoryId}
            onChange={(e) => patch({ categoryId: e.target.value })}
          >
            <option value="">请选择分类</option>
            {categories?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="article-cover">
            封面 URL（选填）
          </label>
          <input
            id="article-cover"
            className={styles.input}
            value={form.coverUrl}
            onChange={(e) => patch({ coverUrl: e.target.value })}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="article-summary">
          摘要
        </label>
        <textarea
          id="article-summary"
          className={styles.textarea}
          value={form.summary}
          onChange={(e) => patch({ summary: e.target.value })}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="article-tags">
          标签（逗号分隔，选填）
        </label>
        <input
          id="article-tags"
          className={styles.input}
          value={form.tags}
          onChange={(e) => patch({ tags: e.target.value })}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.label}>正文</span>
        <MarkdownEditor value={form.contentMd} onChange={(next) => patch({ contentMd: next })} />
      </div>

      {saveError && <p className={styles.fieldError}>{saveError}</p>}

      <div className={styles.saveBar}>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          type="button"
          disabled={!canSubmit}
          onClick={() => submit(1)}
        >
          {save.isPending ? '保存中…' : '发布'}
        </button>
        <button
          className={styles.btn}
          type="button"
          disabled={!canSubmit}
          onClick={() => submit(0)}
        >
          保存草稿
        </button>
        <span className={styles.saveBarSpacer} />
        {savedAt !== null && <span className={styles.savedHint}>已保存</span>}
      </div>
    </AdminLayout>
  )
}
