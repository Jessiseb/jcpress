import { useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError } from '@/api/client'
import type { AdminArticleVO } from '@/api/types'
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

function StatusBadge({ status }: { status: number }) {
  if (status === 1) return <span className={`${styles.badge} ${styles.badgePublished}`}>已发布</span>
  if (status === 2) return <span className={`${styles.badge} ${styles.badgeArchived}`}>归档</span>
  return <span className={`${styles.badge} ${styles.badgeDraft}`}>草稿</span>
}

/**
 * 文章列表。三态（加载 / 错误 / 空）各自可辨 —— **错误绝不伪装成空态**：
 * 若把请求失败渲染成「暂无文章」，运营会以为库里真的空了。
 */
export default function AdminArticleListPage() {
  const [status, setStatus] = useState('')
  const [keyword, setKeyword] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const query = {
    status: status === '' ? undefined : Number(status),
    keyword: keyword.trim() === '' ? undefined : keyword.trim(),
    categoryId: categoryId === '' ? undefined : categoryId,
    page: 1,
    size: 50,
  }

  const { data, isPending, isError, error, refetch } = useAdminArticles(query)
  const { data: categories } = useCategories()
  const publish = usePublishAdminArticle()
  const remove = useDeleteAdminArticle()

  const togglePublish = (article: AdminArticleVO) => {
    publish.mutate({ id: article.id, status: article.status === 1 ? 0 : 1 })
  }

  return (
    <AdminLayout>
      <div className={styles.toolbar}>
        <select
          className={styles.select}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="状态筛选"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {categories && categories.length > 0 && (
          <select
            className={styles.select}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            aria-label="分类筛选"
          >
            <option value="">全部分类</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        )}
        <input
          className={styles.input}
          style={{ maxWidth: 240 }}
          placeholder="标题关键词"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <span className={styles.toolbarSpacer} />
        <Link className={`${styles.btn} ${styles.btnPrimary}`} to="/admin/articles/new">
          新建文章
        </Link>
      </div>

      {isPending && <p className={styles.state}>正在加载…</p>}

      {isError && (
        <div className={`${styles.state} ${styles.stateError}`}>
          <p>
            加载失败：
            {error instanceof ApiError ? error.message : '未知错误'}
          </p>
          <button className={styles.btn} type="button" onClick={() => void refetch()}>
            重试
          </button>
        </div>
      )}

      {!isPending && !isError && data && data.list.length === 0 && (
        <p className={styles.state}>当前筛选下没有文章。</p>
      )}

      {!isPending && !isError && data && data.list.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>标题</th>
              <th>状态</th>
              <th>更新时间</th>
              <th>字数</th>
              <th>浏览</th>
              <th aria-label="操作" />
            </tr>
          </thead>
          <tbody>
            {data.list.map((article) => (
              <tr key={article.id}>
                <td className={styles.titleCell}>{article.title}</td>
                <td>
                  <StatusBadge status={article.status} />
                </td>
                <td className={styles.numCell}>{article.gmtModified ?? '—'}</td>
                <td className={styles.numCell}>{article.wordCount}</td>
                <td className={styles.numCell}>{article.viewCount}</td>
                <td>
                  <div className={styles.actions}>
                    <Link className={styles.btn} to={`/admin/articles/${article.id}`}>
                      编辑
                    </Link>
                    <button
                      className={styles.btn}
                      type="button"
                      onClick={() => togglePublish(article)}
                      disabled={publish.isPending}
                    >
                      {article.status === 1 ? '撤回' : '发布'}
                    </button>
                    {pendingDelete === article.id ? (
                      <span className={styles.confirmRow}>
                        <span className={styles.confirmText}>确认删除？</span>
                        <button
                          className={`${styles.btn} ${styles.btnDanger}`}
                          type="button"
                          onClick={() => {
                            remove.mutate(article.id, { onSettled: () => setPendingDelete(null) })
                          }}
                          disabled={remove.isPending}
                        >
                          删除
                        </button>
                        <button
                          className={styles.btn}
                          type="button"
                          onClick={() => setPendingDelete(null)}
                        >
                          取消
                        </button>
                      </span>
                    ) : (
                      <button
                        className={`${styles.btn} ${styles.btnDanger}`}
                        type="button"
                        onClick={() => setPendingDelete(article.id)}
                      >
                        删除
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminLayout>
  )
}
