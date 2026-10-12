import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError } from '@/api/client'
import type { AdminArticleQuery, AdminArticleVO } from '@/api/types'
import { useCategories } from '@/hooks/useCategories'
import {
  useAdminArticles,
  useDeleteAdminArticle,
  usePublishAdminArticle,
} from '@/hooks/useAdminArticles'
import AdminLayout from './AdminLayout'
import styles from './admin.module.css'

const STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: '0', label: '草稿' },
  { value: '1', label: '已发布' },
  { value: '2', label: '归档' },
]

const SIZE_OPTIONS = [10, 20, 50]

/** 搜索表单的「草稿」状态：改了不等于查了，点搜索才生效（若依的规矩）。 */
interface FilterState {
  status: string
  categoryId: string
  keyword: string
}

const EMPTY_FILTER: FilterState = { status: '', categoryId: '', keyword: '' }

function StatusBadge({ status }: { status: number }) {
  if (status === 1) return <span className={`${styles.badge} ${styles.badgePublished}`}>已发布</span>
  if (status === 2) return <span className={`${styles.badge} ${styles.badgeArchived}`}>归档</span>
  return <span className={`${styles.badge} ${styles.badgeDraft}`}>草稿</span>
}

/**
 * 页码序列：首尾页 + 当前页前后各一页，断开处插省略号。
 * 只列页码的话，页数一多就是几十个按钮；只列首尾又跳不了中间。
 */
function pageNumbers(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const wanted = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b)
  const out: (number | 'gap')[] = []
  let previous = 0
  for (const page of wanted) {
    if (previous !== 0 && page - previous > 1) out.push('gap')
    out.push(page)
    previous = page
  }
  return out
}

/**
 * 文章列表。三态（加载 / 错误 / 空）各自可辨 —— **错误绝不伪装成空态**：
 * 若把请求失败渲染成「暂无文章」，运营会以为库里真的空了。
 */
export default function AdminArticleListPage() {
  const [draft, setDraft] = useState<FilterState>(EMPTY_FILTER)
  const [applied, setApplied] = useState<FilterState>(EMPTY_FILTER)
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(SIZE_OPTIONS[0])
  const [jump, setJump] = useState('')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const query: AdminArticleQuery = {
    status: applied.status === '' ? undefined : Number(applied.status),
    keyword: applied.keyword.trim() === '' ? undefined : applied.keyword.trim(),
    categoryId: applied.categoryId === '' ? undefined : applied.categoryId,
    page,
    size,
  }

  const { data, isPending, isError, isFetching, error, refetch } = useAdminArticles(query)
  const { data: categories } = useCategories()
  const publish = usePublishAdminArticle()
  const remove = useDeleteAdminArticle()

  const total = data?.total ?? 0
  const totalPages = data?.pages ?? 0

  // 删掉末页最后一条后 page 会停在空页上 —— 自动退一页，别让人对着一片空白。
  // 只在「已经有数据且确实是空的」时退，避免请求进行中被误判。
  useEffect(() => {
    if (data !== undefined && data.list.length === 0 && page > 1) {
      setPage((current) => Math.max(1, current - 1))
    }
  }, [data, page])

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    setApplied(draft)
    setPage(1)
  }

  const resetSearch = () => {
    setDraft(EMPTY_FILTER)
    setApplied(EMPTY_FILTER)
    setPage(1)
  }

  const togglePublish = (article: AdminArticleVO) => {
    publish.mutate({ id: article.id, status: article.status === 1 ? 0 : 1 })
  }

  const submitJump = (event: React.FormEvent) => {
    event.preventDefault()
    const target = Number(jump)
    if (!Number.isInteger(target) || totalPages === 0) return
    setPage(Math.min(Math.max(target, 1), totalPages))
    setJump('')
  }

  if (isPending) {
    return (
      <AdminLayout>
        <p className={styles.state}>正在加载…</p>
      </AdminLayout>
    )
  }

  if (isError) {
    return (
      <AdminLayout>
        <div className={`${styles.stateBox} ${styles.stateError}`}>
          <p>加载失败：{error instanceof ApiError ? error.message : '未知错误'}</p>
          <button className={styles.btn} type="button" onClick={() => void refetch()}>
            重试
          </button>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className={styles.card}>
        <div className={styles.cardBody}>
          <form className={styles.searchForm} onSubmit={submitSearch}>
            <div className={styles.searchItem}>
              <label className={styles.searchLabel} htmlFor="filter-status">
                状态
              </label>
              <select
                id="filter-status"
                className={styles.select}
                value={draft.status}
                onChange={(event) => setDraft({ ...draft, status: event.target.value })}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {categories !== undefined && categories.length > 0 && (
              <div className={styles.searchItem}>
                <label className={styles.searchLabel} htmlFor="filter-category">
                  分类
                </label>
                <select
                  id="filter-category"
                  className={styles.select}
                  value={draft.categoryId}
                  onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}
                >
                  <option value="">全部</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={styles.searchItem}>
              <label className={styles.searchLabel} htmlFor="filter-keyword">
                标题
              </label>
              <input
                id="filter-keyword"
                className={styles.input}
                placeholder="输入标题关键词"
                value={draft.keyword}
                onChange={(event) => setDraft({ ...draft, keyword: event.target.value })}
              />
            </div>

            <div className={styles.searchActions}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit">
                搜索
              </button>
              <button className={styles.btn} type="button" onClick={resetSearch}>
                重置
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className={styles.toolbar}>
        <Link
          className={`${styles.btn} ${styles.btnPrimary}`}
          to="/admin/articles/new"
          aria-label="新建文章"
        >
          新建文章
        </Link>
        <button
          className={styles.btn}
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          {isFetching ? '刷新中…' : '刷新'}
        </button>
      </div>

      {data.list.length === 0 ? (
        <p className={styles.stateBox}>当前筛选下没有文章。</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>标题</th>
                <th>状态</th>
                <th>分类</th>
                <th>更新时间</th>
                <th>字数</th>
                <th>浏览</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {data.list.map((article) => (
                <tr key={article.id}>
                  <td className={styles.titleCell} data-col="title">
                    {article.title}
                  </td>
                  <td data-col="status">
                    <StatusBadge status={article.status} />
                  </td>
                  <td data-col="category">{article.categoryName ?? '—'}</td>
                  <td className={styles.numCell} data-col="gmtModified">
                    {article.gmtModified ?? '—'}
                  </td>
                  <td className={styles.numCell} data-col="wordCount">
                    {article.wordCount}
                  </td>
                  <td className={styles.numCell} data-col="viewCount">
                    {article.viewCount}
                  </td>
                  <td className={styles.cellActions} data-col="actions">
                    <Link className={styles.linkAction} to={`/admin/articles/${article.id}`}>
                      编辑
                    </Link>
                    <span className={styles.actionSplit} aria-hidden="true">
                      |
                    </span>
                    <button
                      className={styles.linkAction}
                      type="button"
                      onClick={() => togglePublish(article)}
                      disabled={publish.isPending}
                    >
                      {article.status === 1 ? '撤回' : '发布'}
                    </button>
                    <span className={styles.actionSplit} aria-hidden="true">
                      |
                    </span>
                    {pendingDelete === article.id ? (
                      <span className={styles.confirmRow}>
                        <span className={styles.confirmText}>确认删除？</span>
                        <button
                          className={`${styles.linkAction} ${styles.linkDanger}`}
                          type="button"
                          onClick={() => {
                            remove.mutate(article.id, { onSettled: () => setPendingDelete(null) })
                          }}
                          disabled={remove.isPending}
                        >
                          删除
                        </button>
                        <button
                          className={styles.linkAction}
                          type="button"
                          onClick={() => setPendingDelete(null)}
                        >
                          取消
                        </button>
                      </span>
                    ) : (
                      <button
                        className={`${styles.linkAction} ${styles.linkDanger}`}
                        type="button"
                        onClick={() => setPendingDelete(article.id)}
                      >
                        删除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.pager}>
        <span className={styles.pagerTotal}>
          共 {total} 条 · 第 {page} / {Math.max(totalPages, 1)} 页
        </span>
        <select
          className={`${styles.select} ${styles.pagerSize}`}
          value={size}
          aria-label="每页条数"
          onChange={(event) => {
            setSize(Number(event.target.value))
            setPage(1)
          }}
        >
          {SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              每页 {option} 条
            </option>
          ))}
        </select>

        <form className={styles.searchItem} onSubmit={submitJump}>
          <label className={styles.searchLabel} htmlFor="pager-jump">
            跳至
          </label>
          <input
            id="pager-jump"
            className={`${styles.input} ${styles.pagerSize}`}
            inputMode="numeric"
            value={jump}
            onChange={(event) => setJump(event.target.value)}
          />
          <span className={styles.pagerTotal}>页</span>
        </form>

        <div className={styles.pagerBtns}>
          <button
            className={styles.pagerBtn}
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            上一页
          </button>
          {pageNumbers(page, totalPages).map((item, index) =>
            item === 'gap' ? (
              <span className={styles.pagerGap} key={`gap-${index}`}>
                …
              </span>
            ) : (
              <button
                className={
                  item === page ? `${styles.pagerBtn} ${styles.pagerBtnActive}` : styles.pagerBtn
                }
                type="button"
                key={item}
                onClick={() => setPage(item)}
              >
                {item}
              </button>
            ),
          )}
          <button
            className={styles.pagerBtn}
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            下一页
          </button>
        </div>
      </div>
    </AdminLayout>
  )
}
