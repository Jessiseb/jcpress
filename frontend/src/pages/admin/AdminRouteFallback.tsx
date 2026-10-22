import {
  LiteSkeleton as Skeleton,
  LiteSkeletonRegion as SkeletonRegion,
} from '@/components/common/LiteSkeleton'
import adminStyles from './admin.module.css'
import styles from './adminRouteFallback.module.css'

/**
 * 后台懒加载路由的 Suspense 兜底（第四期优化）。
 *
 * 之前这里是一行 `<p>正在加载…</p>`：刷新 `/admin/dashboard` 时先看到白底一行字，
 * 然后**外壳整体长出来**（侧栏、顶栏、标签栏一次性出现），页面明显跳一下。
 *
 * 现在改成「先画外壳的骨架，再换真外壳」：复用的还是 `admin.module.css` 里的同一套类
 * （`.shell` / `.sidebar` / `.main` / `.topbar` / `.body`），所以两次渲染的几何完全相同 ——
 * 换的是**内容**，不是版式。
 *
 * **这一层刻意不用 antd**：它被 App.tsx 静态 import（必须比懒加载的后台页面先到），
 * 一旦它 import 了 antd 的 Skeleton，cssinjs + ConfigProvider + locale 就会全量进首屏包
 * （实测首屏 gzip 122KB → 272KB）。这里用的是零依赖的 `LiteSkeleton`，
 * 后台页面内部的骨架才用 antd（那部分随懒加载 chunk 才到）。
 *
 * 两条不能破的约束（与 AdminLayout 的注释同源）：
 *  · 不出现 `<header>` / `<footer>` / `<table>`：视觉隔离审计靠这几个标签判「后台是不是被弹到登录页」；
 *  · 不依赖登录态 —— 这里只是版式占位，任何时候渲染都不该发请求。
 */
export default function AdminRouteFallback() {
  return (
    <div className={`${adminStyles.adminScope} ${adminStyles.shell}`}>
      <aside className={adminStyles.sidebar} data-collapsed="false" data-open="false">
        <div className={adminStyles.sideBrand}>
          <span className={adminStyles.sideLogo} aria-hidden="true">
            JC
          </span>
          <span className={adminStyles.sideBrandText}>JCPress 后台</span>
        </div>

        <div className={styles.sideList} aria-hidden="true">
          {[2, 3, 2].map((count, groupIndex) => (
            <div className={styles.sideGroup} key={groupIndex}>
              <Skeleton width={44} height={10} radius={3} />
              {Array.from({ length: count }, (_, index) => (
                <Skeleton
                  key={index}
                  height={14}
                  radius={4}
                  width={index === 0 ? '72%' : index === 1 ? '58%' : '64%'}
                />
              ))}
            </div>
          ))}
        </div>
      </aside>

      <div className={adminStyles.main}>
        <div className={adminStyles.topbar}>
          <Skeleton width={30} height={30} radius={8} />
          <Skeleton width={132} height={12} radius={4} />
          <span className={adminStyles.spacer} />
          <Skeleton width={116} height={28} radius={14} />
        </div>

        <div className={adminStyles.tabsBar}>
          <Skeleton width={92} height={24} radius={6} />
          <Skeleton width={76} height={24} radius={6} />
        </div>

        <div className={adminStyles.body}>
          <SkeletonRegion label="正在加载后台" className={styles.content}>
            <Skeleton width={140} height={18} radius={4} />
            <Skeleton width={280} height={12} radius={4} />

            <div className={styles.kpis} aria-hidden="true">
              {[0, 1, 2, 3].map((index) => (
                <div className={styles.kpi} key={index}>
                  <Skeleton width={72} height={11} radius={3} />
                  <Skeleton width={96} height={26} radius={5} />
                  <Skeleton width={168} height={10} radius={3} />
                </div>
              ))}
            </div>

            <div className={styles.panel} aria-hidden="true">
              <Skeleton width={88} height={13} radius={4} />
              <Skeleton className={styles.chart} radius={8} />
            </div>

            <div className={styles.columns} aria-hidden="true">
              {[0, 1].map((index) => (
                <div className={styles.panel} key={index}>
                  <Skeleton width={104} height={13} radius={4} />
                  {[0, 1, 2, 3].map((row) => (
                    <Skeleton key={row} height={12} radius={3} width={row === 3 ? '68%' : '100%'} />
                  ))}
                </div>
              ))}
            </div>
          </SkeletonRegion>
        </div>
      </div>
    </div>
  )
}
