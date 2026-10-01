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

  // 这条护栏的来历见 docs/decisions.md #3「手机号默认不上站」（公网个人站防骚扰）。
  // 用户 2026-09 明确要求把手机号放上站，于是**收窄**而不是删除它：
  // 手机号从此只许出现在 contacts（用户明确要公开的那一处），
  // 不许漏进简介 / 项目正文 / 结构化数据 —— 那才是「意外泄露」的形态。
  it('手机号只出现在 contacts 里，且必须是可拨号的 tel: 链接', () => {
    const { contacts, ...rest } = profileData

    // ① contacts 之外的任何字段都不许出现手机号
    expect(JSON.stringify(rest)).not.toMatch(/1\d{10}/)

    // ② contacts 里恰好一条手机号；展示形态（带分组空格）与拨号形态（E.164）分开校验
    const tel = contacts.filter((item) => item.href?.startsWith('tel:'))
    expect(tel).toHaveLength(1)
    expect(tel[0].href).toMatch(/^tel:\+\d{13}$/)
    expect(tel[0].value.replace(/\s/g, '')).toMatch(/^1\d{10}$/)
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
