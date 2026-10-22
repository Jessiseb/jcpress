import { Skeleton, SkeletonRegion, SkeletonText } from '@/components/common/Skeleton'
import styles from './contentSkeleton.module.css'

/**
 * 技术分享的两种骨架版式。
 *
 * 同一份骨架有两个用处：① 路由 chunk 还没到时的 Suspense 兜底；② 数据回来之前的页面
 * 内部加载态。两处用同一个组件是**故意的** —— 如果它们长得不一样，刷新时会先看到 A 再
 * 换成 B 再换成内容，等于多闪一次。
 */

/** 列表页：三个分类分组 × 三行目录（行高与真实行一致：56px 缩略图 + 两行字） */
export function TechListSkeleton() {
  return (
    <SkeletonRegion label="正在加载文章列表" className={styles.list}>
      <Skeleton width={190} height={12} radius={4} />
      {[0, 1, 2].map((group) => (
        <div className={styles.group} key={group}>
          <Skeleton className={styles.groupTitle} width={92} height={14} radius={4} />
          {[0, 1, 2].map((row) => (
            <div className={styles.row} key={row}>
              <Skeleton width={56} height={56} radius={12} />
              <div className={styles.rowText}>
                <Skeleton width={row === 1 ? '62%' : '78%'} height={16} radius={4} />
                <Skeleton width={row === 2 ? '48%' : '70%'} height={12} radius={4} />
              </div>
              <Skeleton width={46} height={12} radius={4} />
            </div>
          ))}
        </div>
      ))}
    </SkeletonRegion>
  )
}

/** 详情页：面包屑 + 两行标题 + 元信息 + 四段正文（正文行高 1.9，这里用 14px 块近似） */
export function ArticleSkeleton() {
  return (
    <SkeletonRegion label="正在加载文章" className={styles.article}>
      <div className={styles.header}>
        <Skeleton width={78} height={11} radius={3} />
        <Skeleton width="86%" height={32} radius={6} />
        <Skeleton width="54%" height={32} radius={6} />
        <Skeleton width={240} height={12} radius={4} />
      </div>
      <div className={styles.body}>
        <SkeletonText lines={4} lineHeight={15} gap={14} />
        <SkeletonText lines={5} lineHeight={15} gap={14} lastWidth="74%" />
        <SkeletonText lines={3} lineHeight={15} gap={14} lastWidth="42%" />
      </div>
    </SkeletonRegion>
  )
}
