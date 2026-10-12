/**
 * 后台菜单树（若依式：分组 + 子项）。
 *
 * 一条纪律：`enabled: false` 的项必须**置灰不可点**。后端目前只有文章相关接口，
 * 分类 / 标签 / 媒体库都还没有 —— 摆一个能点但打不开的入口，比不摆更糟。
 * 等接口到位，把 `enabled` 改 true 并补上 `to` 即可，渲染层一行都不用动。
 */
export interface AdminMenuItem {
  label: string
  /** 目标路由；未实现项可以不给 */
  to?: string
  /** false = 后端接口还没做，置灰并标「开发中」 */
  enabled: boolean
}

export interface AdminMenuGroup {
  label: string
  items: AdminMenuItem[]
}

export const ADMIN_MENU: AdminMenuGroup[] = [
  {
    label: '内容管理',
    items: [
      { label: '文章列表', to: '/admin/articles', enabled: true },
      { label: '分类管理', enabled: false },
      { label: '标签管理', enabled: false },
      { label: '媒体库', enabled: false },
    ],
  },
  {
    label: '系统',
    items: [
      { label: '站点设置', enabled: false },
      { label: '操作日志', enabled: false },
    ],
  },
]

/** 后台根路径（登录后默认落地、标签栏里的常驻标签）。 */
export const ADMIN_HOME = '/admin/articles'

export interface AdminRouteMeta {
  /** 标签栏里这一页显示的名字；空串表示该路由不进标签栏 */
  title: string
  /** 菜单树里要高亮的那一项 */
  activePath: string
  /** 面包屑（不含「首页」前缀，外壳统一补） */
  breadcrumb: string[]
}

/** 文章编辑页 `/admin/articles/:id`，但 `new` 不算（它是「新建」）。 */
const EDIT_PATTERN = /^\/admin\/articles\/(?!new$)[^/]+$/

/**
 * 把当前 pathname 翻译成「标签名 + 菜单高亮项 + 面包屑」。
 *
 * 编辑页在菜单里没有自己的条目，归属到「文章列表」那一项 —— 否则进编辑页后
 * 侧边栏会整个失去高亮，看着像菜单坏了。
 */
export function resolveAdminRoute(pathname: string): AdminRouteMeta {
  if (pathname === '/admin/articles/new') {
    return { title: '新建文章', activePath: ADMIN_HOME, breadcrumb: ['内容管理', '新建文章'] }
  }
  if (EDIT_PATTERN.test(pathname)) {
    const id = pathname.slice(pathname.lastIndexOf('/') + 1)
    return {
      // 同时开多篇时标签名要能区分，所以带上 id
      title: `编辑文章 #${id}`,
      activePath: ADMIN_HOME,
      breadcrumb: ['内容管理', '编辑文章'],
    }
  }
  for (const group of ADMIN_MENU) {
    for (const item of group.items) {
      if (item.to === pathname) {
        return { title: item.label, activePath: item.to, breadcrumb: [group.label, item.label] }
      }
    }
  }
  return { title: '', activePath: '', breadcrumb: [] }
}
