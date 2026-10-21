import { Link } from 'react-router-dom'

import { useTechCatalog } from '@/hooks/useTechCatalog'
import styles from './TechSidebar.module.css'

/**
 * 「技术分享」的左栏目录：分类分组 + 文章清单，当前项高亮。
 *
 * 为什么加这套东西（2026-10-16，用户给的参照是小林面试笔记那种文档站）：
 * 原来列表页是一堵卡片墙、进了文章只剩一行面包屑 —— 任何时候都看不出「这一区一共
 * 有哪些内容、我正在哪一篇」。参考站的解法是**常驻左栏**：导航与内容分离，
 * 位置感来自左栏本身，而不是要靠记忆或来回点。
 *
 * 但这条栏**只在详情页出现**（当天晚些时候用户看过截图后的要求）：列表页自己就是
 * 那份完整索引，左栏在那里只是把同一份清单说第二遍。所以 `activeSlug` 是必填的 ——
 * 「没有当前篇」这种状态在挂载点已经不存在了，与其留一个可选参数让人再传一次 undefined，
 * 不如让类型把这条约束摆到明面上。
 *
 * 清单一律走**无衬线**：文章标题是后台随时写的，展示衬线只打包了两套子集
 * （静态 531 字 + 文章 GB2312 一级字），导航这种高密度小字没必要去蹭它 ——
 * 蹭了就会出现「半个标题换了字体」的混款（与 decisions #41 的等宽栈判断同源）。
 */
export default function TechSidebar({ activeSlug }: { activeSlug: string }) {
  const { data, isPending, isError } = useTechCatalog()

  return (
    <nav className={styles.rail} aria-label="技术分享目录">
      {/* 这是返回列表的入口，不是「当前页」：列表页早已不挂这条栏 */}
      <Link to="/tech" className={styles.root}>
        全部文章
        {data && <span className={styles.rootCount}>{data.total}</span>}
      </Link>

      {isPending && <p className={styles.state}>正在取目录…</p>}
      {/* 目录取不回来时只说这一句，不占位假数据 */}
      {isError && <p className={styles.state}>目录没取回来</p>}

      {data?.groups.map((group) => (
        <div key={group.name} className={styles.group}>
          <p className={styles.groupName}>{group.name}</p>
          <ul className={styles.list}>
            {group.articles.map((article) => (
              <li key={article.slug}>
                <Link
                  to={`/tech/${article.slug}`}
                  className={styles.item}
                  aria-current={article.slug === activeSlug ? 'page' : undefined}
                >
                  {article.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
