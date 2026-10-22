import '@testing-library/jest-dom/vitest'

/**
 * `window.matchMedia` 的 polyfill。
 *
 * jsdom 不实现它，而 antd 的响应式栅格（`Row`/`Col` 的 `xs/sm/xl`）在挂载时会读 ——
 * 缺了它整页渲染直接抛 `window.matchMedia is not a function`（先踩到的是看板页迁移）。
 * 一律返回 `matches: false`（等于宽屏），与 `AdminLayout` 里「拿不到就当宽屏」的策略一致。
 */
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia
}
