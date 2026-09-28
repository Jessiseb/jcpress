import { describe, expect, it } from 'vitest'

import { profileData } from './profile'

describe('profileData', () => {
  it('关键数字四个，且每个都有出处', () => {
    expect(profileData.highlights).toHaveLength(4)
    profileData.highlights.forEach((metric) => {
      expect(metric.caption.length).toBeGreaterThan(0)
      // 单值型必须有 value；区间型必须同时有 from / to
      if (metric.value === undefined) {
        expect(metric.from).toBeTypeOf('number')
        expect(metric.to).toBeTypeOf('number')
      }
    })
  })

  it('实习经历按「结束时间倒序」排列，至今的那段排在最前', () => {
    // 注意：CVTE（2025-04 起，至今）与用友（2025-07 ~ 2025-10）时间重叠，
    // 因此排序不能按 startTime —— 按 endTime 倒序，至今视为最新。
    const endTime = (end: string | null) => end ?? '9999-12'
    const sorted = [...profileData.experiences].sort((a, b) =>
      endTime(a.endDate) < endTime(b.endDate) ? 1 : -1,
    )

    expect(profileData.experiences.map((item) => item.company)).toEqual(sorted.map((item) => item.company))
    expect(profileData.experiences[0].company).toContain('视源')
    expect(profileData.experiences[0].endDate).toBeNull()
  })

  it('每段经历都有职责条目与技术栈', () => {
    profileData.experiences.forEach((item) => {
      expect(item.highlights.length).toBeGreaterThan(0)
      expect(item.techStack.length).toBeGreaterThan(0)
    })
  })

  it('手机号不出现在任何对外字段里', () => {
    const serialized = JSON.stringify(profileData)
    expect(serialized).not.toMatch(/1\d{10}/)
  })

  it('技能分组与熟练度都在 1-5 之间', () => {
    expect(profileData.skillGroups.length).toBeGreaterThan(0)
    profileData.skillGroups.forEach((group) => {
      group.items.forEach((item) => {
        expect(item.level).toBeGreaterThanOrEqual(1)
        expect(item.level).toBeLessThanOrEqual(5)
      })
    })
  })
})
