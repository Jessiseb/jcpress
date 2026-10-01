/**
 * 首页（关于我）数据源。
 *
 * 现阶段是前端常量：后端 `/api/v1/profile` 尚未实现。
 * 结构刻意对齐后端 VO（规划 §6.5 `profile` / `skill` / `experience` / `project`），
 * 后端就绪后只需把 `useProfile()` 的实现从「读常量」换成 TanStack Query，组件零改动。
 *
 * 内容源：庄家希AI应用开发.pdf（逐条对照，未做修饰性夸大）。
 */

export type ProjectStatus = 'ONGOING' | 'ONLINE' | 'ARCHIVED'

export interface ProfileVO {
  displayName: string
  headline: string
  keywords: string[]
  /** 简历 PDF 无头像：null 时渲染姓名首字渐变占位 */
  avatarUrl: string | null
  summary: string
  location: string
  email: string
  /** Gitee 主页（简历给出的唯一可确认代码托管地址） */
  githubUrl: string
  blogUrl: string | null
  wechatQrUrl: string | null
  resumePdfUrl: string
}

export interface SkillGroupVO {
  category: string
  items: { name: string; level: number }[]
}

export interface ExperienceVO {
  company: string
  position: string
  department: string
  employmentType: 'INTERN' | 'FULLTIME'
  city: string
  /** `YYYY-MM`，`null` 表示至今 */
  startDate: string
  endDate: string | null
  /** 职责与产出（Markdown 内联片段，渲染时只解析 **加粗**） */
  highlights: string[]
  techStack: string[]
  /** 项目介绍（仅 CVTE 段有独立系统名） */
  projectName?: string
  projectIntro?: string
}

export interface ProjectVO {
  name: string
  slug: string
  role: string
  summary: string
  status: ProjectStatus
  techStack: string[]
  highlights: string[]
  repoUrl: string | null
  isFeatured: boolean
}

export interface HighlightMetric {
  label: string
  /** 单值型（如 85%） */
  value?: number
  /** 区间型（如 65 → 90） */
  from?: number
  to?: number
  suffix: string
  caption: string
}

export interface EducationVO {
  school: string
  major: string
  degree: string
  period: string
  rank: string
  campus: string[]
}

export interface AwardVO {
  name: string
  level: string
  year: string
}

export interface ContactVO {
  label: string
  value: string
  href: string | null
  /** 无链接时展示文本并支持一键复制 */
  copyable?: boolean
}

export interface ProfileAggregateVO {
  profile: ProfileVO
  highlights: HighlightMetric[]
  skillGroups: SkillGroupVO[]
  experiences: ExperienceVO[]
  projects: ProjectVO[]
  education: EducationVO
  awards: AwardVO[]
  contacts: ContactVO[]
  stats: { label: string; value: string }[]
}

export const profileData: ProfileAggregateVO = {
  profile: {
    displayName: '庄家希',
    headline: 'AI 应用开发工程师 · 用 Agent 和 Java 把重复劳动自动化',
    keywords: ['AI Agent 工程', 'Java 后端', 'RAG 与知识库'],
    avatarUrl: null,
    summary:
      '在 CVTE 做 AI 运维 Agent，在用友与粤建三和做企业级 Java 后端。习惯先把架构想清楚再动手，也习惯把踩过的坑写下来——CSDN 累计 17 篇技术文、访问 1w+，Gitee 上还有智能体、API 开放平台等自研项目。',
    location: '广州',
    email: '2750685367@qq.com',
    githubUrl: 'https://gitee.com/c-nomad',
    blogUrl: 'https://www.yuque.com/u42163082/chengshenbj',
    wechatQrUrl: null,
    resumePdfUrl: '/resume.pdf',
  },

  highlights: [
    {
      label: '接口响应下降',
      value: 85,
      suffix: '%',
      caption: '报销单 × OA 异步化 · 用友',
    },
    {
      label: '知识库检索准确率',
      from: 65,
      to: 90,
      suffix: '%',
      caption: '滑动窗口分块 + 混合检索 · AIWorker',
    },
    {
      label: '慢查询耗时',
      from: 1200,
      to: 50,
      suffix: 'ms',
      caption: '联合索引消灭全表扫描 · 粤建三和',
    },
    {
      label: '异常订单自动修复率',
      value: 100,
      suffix: '%',
      caption: '支付补偿状态机 · 用友',
    },
  ],

  skillGroups: [
    {
      category: '语言',
      items: [
        { name: 'Java', level: 4 },
        { name: 'Golang（Gin / GORM）', level: 2 },
        { name: 'TypeScript', level: 3 },
        { name: 'SQL', level: 4 },
      ],
    },
    {
      category: '后端框架',
      items: [
        { name: 'Spring Boot', level: 4 },
        { name: 'Spring Cloud Alibaba', level: 3 },
        { name: 'MyBatis', level: 4 },
        { name: 'Spring AI', level: 4 },
        { name: 'LangChain4J', level: 3 },
      ],
    },
    {
      category: 'AI · Agent',
      items: [
        { name: 'RAG / 混合检索', level: 4 },
        { name: 'Function Calling', level: 4 },
        { name: 'Harness Engineering', level: 4 },
        { name: 'AgentScope', level: 3 },
        { name: 'Dify Workflow', level: 3 },
        { name: 'ReAct', level: 4 },
      ],
    },
    {
      category: '数据与中间件',
      items: [
        { name: 'MySQL', level: 4 },
        { name: 'Redis', level: 4 },
        { name: 'Oracle', level: 3 },
        { name: 'Nacos', level: 3 },
        { name: '消息队列', level: 3 },
      ],
    },
    {
      category: '前端',
      items: [
        { name: 'React', level: 3 },
        { name: 'TypeScript', level: 3 },
        { name: 'Tailwind CSS', level: 3 },
        { name: 'Ant Design', level: 3 },
      ],
    },
    {
      category: '计算机基础',
      items: [
        { name: '并发 / 线程池 / JVM', level: 4 },
        { name: '计算机网络（TCP / HTTP）', level: 4 },
        { name: '操作系统 / I-O 多路复用', level: 3 },
        { name: '数据结构与算法', level: 4 },
      ],
    },
  ],

  experiences: [
    {
      company: '广州视源电子科技股份有限公司（CVTE）',
      position: 'AI 应用开发实习生',
      department: '商用显示 BG',
      employmentType: 'INTERN',
      city: '广州',
      startDate: '2025-04',
      endDate: null,
      projectName: 'OS 应用智能运维客服助手',
      projectIntro:
        '基于飞书机器人的智能运维系统：FAE 在群里 @机器人 描述故障并上传日志，Agent 自动完成根因定位与代码修复建议，目标是压缩团队翻日志定位的时间。',
      highlights: [
        '负责**整体架构设计**：飞书 Bot 接入、Harness Agent 设计、Tool-Use 形成闭环；构建工具白名单与结构化输出，降低 LLM 胡说导致的错误分析',
        '**群聊并发一致性**：以飞书话题 threadId 实现同 Case 串行、跨 Case 并行，配合 session 锁，避免并发下的会话状态竞争与日志目录互相覆盖',
        '**抽象 Agent 流式事件模型**：渠道渲染与 Agent 事件流解耦，后续扩展网页 / 其他 IM 入口零入侵',
        '设计**多轮日志分析闭环**：补日志 / 追问用户 / 转代码分析 / 开发接管 / 结案等互斥分支，用结构化输出校验会话状态，防止错误结案',
        '搭建文件消息异步协同：用户上传日志后以 CountDownLatch 等待下载完成再注入上下文，保证消息时序正确',
      ],
      techStack: ['AgentScope', 'SpringBoot', 'ReAct', 'Dify Workflow', 'RAG', '飞书 SDK'],
    },
    {
      company: '广东用友网络有限公司',
      position: 'Java 开发实习生',
      department: '技术部',
      employmentType: 'INTERN',
      city: '广东',
      startDate: '2025-07',
      endDate: '2025-10',
      highlights: [
        '参与企业级管理系统开发，负责**支付对账补偿模块**设计与数据中台幂等校验，保障多系统交互的数据一致性与高可用',
        '负责财务共享系统的开发与维护，多项目中为客户提供线上 BUG 排查、业务代码分析与场景优化',
        '主导**报销单 × OA 对接性能优化**：以 ThreadPoolExecutor 异步化解决同步阻塞，响应时间降低 **85%**',
        '设计乐百氏 SaaS **支付补偿机制**：定时调度 + 双字段轻量状态机实现幂等补偿，异常订单自动修复率 **100%**',
      ],
      techStack: ['SpringBoot', 'MySQL', 'Redis', 'ThreadPoolExecutor', '状态机'],
    },
    {
      company: '广东粤建三和软件有限公司',
      position: 'Java 开发实习生',
      department: '开发部',
      employmentType: 'INTERN',
      city: '广东',
      startDate: '2024-07',
      endDate: '2024-09',
      projectName: '建设工程质量安全监督管理系统',
      projectIntro:
        '面向省 / 市 / 县区水利监督人员与企业、社会公众的水利施工质量安全信息化管理系统，技术栈 SpringBoot + MyBatis + Redis + MySQL。',
      highlights: [
        '完成**危大工程上报**开发并上线，实现开工前全流程数字化备案，累计服务 10+ 工程项目，备案审核效率提升 **60%**',
        '**SQL 优化**：对高频查询字段加联合索引，避免全表扫描与回表，查询耗时从 **1200ms 降到 50ms**',
        '优化 **1000 万行日志表归档**：主键分批删除，规避大事务与长锁风险，保留近 3 个月数据',
      ],
      techStack: ['SpringBoot', 'MyBatis', 'Redis', 'MySQL'],
    },
  ],

  projects: [
    {
      name: 'AIWorker 智能办公系统',
      slug: 'aiworker',
      role: '开发负责人',
      summary:
        '基于 Java 与 Spring AI Alibaba 的 AI 驱动企业办公助手：Agent 自主编排 + Function Calling，提供待办管理、审批流程与知识库检索的智能化处理。',
      status: 'ONLINE',
      techStack: ['Java', 'Spring AI Alibaba', 'Function Calling', 'RAG', 'MySQL', 'Redis'],
      highlights: [
        '设计 **@Tool 注解的业务工具化架构**：待办 / 审批 / 知识库封装为标准工具，声明式注册、参数自动解析、结果回传',
        '知识库检索准确率 **65% → 90%**：滑动窗口分块（500 字符 + 50 重叠）解决 PDF 语义切断，叠加向量 + BM25 混合检索',
        '设计 **SummaryBufferChatMemory**：Token 超限自动生成摘要压缩历史，Token 使用率降低 **60%**',
        '基于 **ThreadLocal** 实现 Tool 层线程级用户上下文隔离，解决并发调用下的身份串扰',
      ],
      repoUrl: null,
      isFeatured: true,
    },
    {
      name: 'Pulse 定时任务平台',
      slug: 'pulse',
      role: '后端开发负责人',
      summary:
        'Java 编写的定时微服务，作为微服务体系下的「统一闹钟」，集中管理全部业务的定时任务，支撑高精准与高负载两类需求。',
      status: 'ONLINE',
      techStack: ['Spring Boot', 'MyBatis', 'MySQL', 'Redis', 'Nacos', 'Spring Gateway', 'Feign'],
      highlights: [
        '**高精准**：数据分治 + 有序性 + 二级存储（MySQL / Redis）为高频扫描打底，结合线程池把触发误差控制在**秒级**',
        '**高负载**：Redis ZSet 数据分片 + 分布式锁实现任务多机分发与横向扩容，配合线程池扛住同刻批量触发',
        '**冷热分区**：迁移模块 + 缓存预热，热数据常驻缓存，冷数据落盘兜底，降低缓存等关键资源占用',
      ],
      repoUrl: null,
      isFeatured: true,
    },
    {
      name: '更多自研项目',
      slug: 'more',
      role: '个人项目',
      summary: 'Gitee 上还有 AI 智能体、广东白云学院软件协会官网、API 开放平台、趣学伴、用户管理中心等项目。',
      status: 'ONLINE',
      techStack: ['Java', 'React', 'Spring Boot'],
      highlights: [],
      repoUrl: 'https://gitee.com/c-nomad',
      isFeatured: false,
    },
  ],

  education: {
    school: '广东白云学院',
    major: '软件工程',
    degree: '全日制统招本科',
    period: '2023.09 - 2027.06',
    rank: '专业排名前 3',
    campus: ['软件协会会长', '软件著作权', '实用新型专利', '国家励志奖学金', '优秀五四青年', 'CET-4'],
  },

  awards: [
    { name: '中国大学生计算机设计大赛', level: '国家级二等奖', year: '2025' },
    { name: '大学生创新创业训练计划', level: '国家级立项', year: '2025' },
    { name: '中国国际大学生创新大赛', level: '铜奖', year: '2025' },
    { name: '网络技术挑战赛', level: '华南赛区三等奖', year: '2025' },
    { name: '海峡两岸暨港澳地区大学生计算机创新作品赛', level: '广东省优秀奖', year: '2025' },
  ],

  contacts: [
    // 手机号做主入口：`tel:` 在移动端直接进拨号盘，比 `mailto:` 少一次切换。
    // 展示用 3-4-4 分组（大字号下更好读），href 里必须是不带空格的完整号码，且带 +86 国家码。
    { label: '手机', value: '178 1921 2602', href: 'tel:+8617819212602' },
    { label: '微信', value: 'XIH1222', href: null, copyable: true },
    { label: 'Gitee', value: 'gitee.com/c-nomad', href: 'https://gitee.com/c-nomad' },
    { label: 'CSDN', value: 'C 游牧人 · 17 篇 / 访问 1w+', href: 'https://blog.csdn.net/2301_79737596?spm=1000.2115.3001.5343' },
    { label: '个人知识库', value: '语雀 · 成神笔记', href: 'https://www.yuque.com/u42163082/chengshenbj' },
  ],

  stats: [
    { label: '技术文章', value: '17 篇' },
    { label: '文章访问量', value: '1w+' },
    { label: '企业实习', value: '3 段' },
    { label: '国家级 / 省级奖项', value: '5 项' },
  ],
}
