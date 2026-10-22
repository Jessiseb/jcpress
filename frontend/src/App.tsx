import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import TopNav from '@/components/layout/TopNav'
import Footer from '@/components/layout/Footer'
import ScrollProgress from '@/components/layout/ScrollProgress'
import FlowField from '@/components/visual/FlowField'
import CelestialField from '@/components/visual/CelestialField'
import TechShell from '@/components/tech/TechShell'
import HomePage from '@/pages/home/HomePage'
import ChannelPlaceholder from '@/pages/ChannelPlaceholder'

import { ADMIN_HOME } from '@/pages/admin/adminMenu'
import { ArticleSkeleton, TechListSkeleton } from '@/components/tech/ContentSkeleton'

/**
 * 后台路由的骨架外壳（第四期优化）。**静态 import 是有意的**：
 * 它是兜底 UI，本身必须比被兜底的 chunk 先到 —— 如果它也懒加载，
 * 刷新时先看到的就是空白，跟现在的「一行正在加载…」一样难看。
 */
import AdminRouteFallback from '@/pages/admin/AdminRouteFallback'
import { usePageView } from '@/hooks/usePageView'

/**
 * 路由级懒加载（三期）：详情页与后台都**不进首屏包**。
 * 详情页会拖进 Markdown 渲染链（react-markdown / highlight.js），后台还要再拖一个
 * CodeMirror —— 二者都与首屏无关，混进首屏会直接顶破 200KB 预算。
 */
const ArticleDetailPage = lazy(() => import('@/pages/tech/ArticleDetailPage'))
// 列表页也改懒加载（第四期接 antd 后）：它内部用 antd 的骨架与空态，
// 若留在首屏包里，antd 核心（≈150KB gzip）会被一起拖进来 —— 首屏预算 200KB 直接破。
// 代价是首访 /tech 多一次 chunk 请求，这期间用零依赖的 TechListSkeleton 顶上。
const TechListPage = lazy(() => import('@/pages/tech/TechListPage'))
// 后台三页同样懒加载：它们会拖进 CodeMirror（CodeMirror 只在编辑页用，
// 但连列表页一起懒加载最省 —— 后台整块都跟首屏无关，不该进首屏包）。
const AdminLoginPage = lazy(() => import('@/pages/admin/AdminLoginPage'))
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'))
const AdminArticleListPage = lazy(() => import('@/pages/admin/AdminArticleListPage'))
const AdminArticleEditPage = lazy(() => import('@/pages/admin/AdminArticleEditPage'))
const RequireAdmin = lazy(() =>
  import('@/pages/admin/RequireAdmin').then((m) => ({ default: m.RequireAdmin })),
)

export default function App() {
  const { pathname } = useLocation()
  // 访问采集（第四期）：路由落定后上报一次。挂在根组件而不是各页面里 ——
  // 页面会加减，采集点不能跟着加减；`/admin` 自己在 hook 里排除。
  usePageView()
  // 天体只在首页挂载：它的「分节停靠」位置是按首页那 8 个区块配的，
  // 挂到 /tech 之类的页面上会变成一颗没有停靠点的球压在列表上。
  const onHome = pathname === '/'
  // 后台与公开站视觉隔离（规划 §10.4）：后台不挂流线层、顶栏、页脚 ——
  // 那三样是面向访客的门面，出现在管理台里只会造成「还在自己网站」的错觉。
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/')

  return (
    <>
      {/* 滚动进度指示（二期）：全站唯一的滚动监听在这里（useScrollProgress），
          它写出的 --scroll-p 同时驱动本进度条与流线布景层的视差。 */}
      {!isAdmin && <ScrollProgress />}
      {/* 流线布景层（二期）：全站 fixed，落在正文之下、body 画布之上。
          它不参与路由，因此切页时不会重挂载、动画相位不重置 —— 观感上「背景一直在流动」。
          首屏不再是单独一层：流线在首屏最显眼，向下滚动时作为背景延续。 */}
      {!isAdmin && <FlowField />}
      {/* 首屏天体（二期 r3）：亮色是地球、暗色是月球。
          与流线层同层（全屏固定、z-index:-1），滚动时按当前区块滑到对应位置 ——
          停靠表在 CelestialField.module.css 的 [data-scene] 里。 */}
      {onHome && <CelestialField />}
      {!isAdmin && <TopNav />}
      <main id="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          {/* 「技术分享」整段共用一个外壳（左栏目录），列表页与详情页都在它里面。
              这样从列表点进文章时左栏不重挂载，位置感是连续的。 */}
          <Route path="/tech" element={<TechShell />}>
            <Route
              index
              element={
                <Suspense fallback={<TechListSkeleton />}>
                  <TechListPage />
                </Suspense>
              }
            />
            <Route
              path=":slug"
              element={
                <Suspense fallback={<ArticleSkeleton />}>
                  <ArticleDetailPage />
                </Suspense>
              }
            />
          </Route>
          <Route
            path="/algo"
            element={
              <ChannelPlaceholder
                title="算法笔记"
                lead="按专题整理的题解：思路、多解法、复杂度与易错点。"
                empty="内容整理中。首页「技术栈」里有数据结构与算法的档位可先参考。"
              />
            }
          />
          <Route
            path="/projects"
            element={
              <ChannelPlaceholder
                title="项目笔记"
                lead="每个自研项目的背景、架构、取舍与复盘。"
                empty="内容整理中。首页「项目经历」已有两个项目的概要，展开就能看到亮点。"
              />
            }
          />
          {/* 后台：登录页不设守卫（否则登录页本身会被守卫弹回自己造成死循环）；
              另外两页包在 RequireAdmin 里。 */}
          <Route
            path="/admin/login"
            element={
              <Suspense fallback={<AdminRouteFallback />}>
                <AdminLoginPage />
              </Suspense>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <Suspense fallback={<AdminRouteFallback />}>
                <RequireAdmin>
                  <AdminDashboardPage />
                </RequireAdmin>
              </Suspense>
            }
          />
          <Route
            path="/admin/articles"
            element={
              <Suspense fallback={<AdminRouteFallback />}>
                <RequireAdmin>
                  <AdminArticleListPage />
                </RequireAdmin>
              </Suspense>
            }
          />
          <Route
            path="/admin/articles/:id"
            element={
              <Suspense fallback={<AdminRouteFallback />}>
                <RequireAdmin>
                  <AdminArticleEditPage />
                </RequireAdmin>
              </Suspense>
            }
          />
          {/* 落地页跟着 ADMIN_HOME 走（第四期起是数据看板） */}
          <Route path="/admin" element={<Navigate to={ADMIN_HOME} replace />} />
          <Route path="*" element={<ChannelPlaceholder title="页面不存在" is404 />} />
        </Routes>
      </main>
      {!isAdmin && <Footer />}
    </>
  )
}
