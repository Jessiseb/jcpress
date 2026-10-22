import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { VisitTrendVO } from '@/api/types'
import TrendChart from './TrendChart'

const points = (values: Array<[string, number, number]>): VisitTrendVO[] =>
  values.map(([date, pv, uv]) => ({ date, pv, uv }))

describe('TrendChart', () => {
  it('有数据时画出图，并把累计值写进无障碍描述', () => {
    render(<TrendChart points={points([['2026-10-20', 4, 2], ['2026-10-21', 4, 1]])} />)

    const chart = screen.getByRole('img')
    expect(chart).toBeInTheDocument()
    expect(chart).toHaveAttribute('aria-label', expect.stringContaining('累计 PV 8'))
    // 两条折线（访问 / 访客）+ 一块面积；area 用的是同一个 pv 路径
    expect(chart.querySelectorAll('path')).toHaveLength(3)
  })

  it('全区间为 0 时出空态文案而不是空坐标系', () => {
    render(<TrendChart points={points([['2026-10-20', 0, 0], ['2026-10-21', 0, 0]])} />)

    expect(screen.getByText(/这几天还没有访问记录/)).toBeInTheDocument()
    // 空态下不该再渲染一个「看起来坏掉」的坐标系
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('前几天没数据时说明统计从哪天开始', () => {
    render(
      <TrendChart
        points={points([
          ['2026-10-18', 0, 0],
          ['2026-10-19', 0, 0],
          ['2026-10-20', 6, 3],
        ])}
      />,
    )

    expect(screen.getByText(/从 2026-10-20 开始有记录/)).toBeInTheDocument()
  })

  it('没有区间时不崩', () => {
    render(<TrendChart points={[]} />)
    expect(screen.getByText('还没有可展示的区间。')).toBeInTheDocument()
  })
})
