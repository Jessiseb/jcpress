import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { HourStatsVO } from '@/api/types'
import HourBars from './HourBars'

const hours = (patch: Record<number, number> = {}): HourStatsVO[] =>
  Array.from({ length: 24 }, (_, hour) => ({ hour, pv: patch[hour] ?? 0 }))

describe('HourBars', () => {
  it('固定 24 根柱子，峰值那根被标出来', () => {
    const { container } = render(<HourBars points={hours({ 9: 12, 21: 34 })} days={7} />)

    expect(container.querySelectorAll('[data-hour]')).toHaveLength(24)
    // 峰值是 21 点：只有它的柱体带 barPeak（靠 data-pv 断言数值更稳）
    expect(container.querySelector('[data-hour="21"]')?.getAttribute('data-pv')).toBe('34')
    expect(screen.getByText(/最忙的是/)).toBeInTheDocument()
    expect(screen.getByText('21:00')).toBeInTheDocument()
  })

  it('全零时给一句人话，而不是 24 根贴底的柱子', () => {
    render(<HourBars points={hours()} days={7} />)
    expect(screen.getByText(/这几天还没有访问记录/)).toBeInTheDocument()
  })

  it('合计次数写进汇总行（口径：次数，不是人数）', () => {
    render(<HourBars points={hours({ 9: 12, 21: 34 })} days={7} />)
    expect(screen.getByText(/近 7 天合计 46 次/)).toBeInTheDocument()
  })
})
