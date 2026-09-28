# 实现期决策记录（decisions）

> 依据 `docs/项目前期规划.md` 附录 B：实现阶段的偏差记录在这里，**不回改**规划文档结论。

## 2026-09-28 · 首页（关于我）实现

| # | 决策 / 偏差 | 说明 |
| --- | --- | --- |
| 1 | **新增三个首页区块**：关键数字、教育背景、荣誉奖项 | 规划 §4.1 面向有工作经验者；本站作者是应届生，竞赛奖项与专业排名是可信度最强信号。数据层影响：M2 需新增 `education` 与 `award` 表（或并入 profile seed），当前由前端常量承载 |
| 2 | **首页数据先走前端常量** `src/data/profile.ts` | 后端未起。常量结构对齐 `/api/v1/profile` VO，后端就绪后只换 `useProfile()` 实现，组件零改动 |
| 3 | **手机号默认不上站** | 公网个人站防骚扰；需要时在 `profileData.contacts` 加一项即可 |
| 4 | **实习经历排序规则：按结束时间倒序（至今优先）** | CVTE（2025-04 起，至今）与用友（2025-07 ~ 2025-10）时间重叠，按开始时间排序会把用友排前面，不符合「当前主线」语义。已用测试固化（`profile.test.ts`） |
| 5 | **简历 PDF 入仓** `frontend/public/resume.pdf` | 供「下载简历」CTA；441KB，可接受 |
| 6 | **规划评审发现 5 处硬伤**（详见 2026-09-28 对话记录，待用户确认后落改）：① §8.4「公开接口无写方法」与 §9.2 `POST /articles/{slug}/view` 矛盾；② Sa-Token 分库未真正落地（需自定义 SaTokenDao）；③ 全文索引只覆盖 title+summary，正文不可搜，且 MySQL 需启动参数 `ngram_token_size=2`；④ 浏览量三处真相、回写语义未定义；⑤ M1 DoD 过重建议拆 M1a/b/c |
| 7 | 未决决策建议值：D1=C · D4=A（CSS 变量 + CSS Modules）· D5=A · D6=A（DB 存相对路径，VO 层拼完整 URL）· D7=A · D11=A · D12=A | 待用户最终确认后更新规划 §15 |

## 环境注意事项（Windows + WorkBuddy 沙箱）

| 坑 | 现象 | 绕过方式 |
| --- | --- | --- |
| esbuild / rollup postinstall 失败 | `npm install` 报 spawn EPERM，`@esbuild/*` 平台包缺失 | `npm install --ignore-scripts`，缺失的平台包用 `--no-save` 显式补装（`@rollup/rollup-win32-x64-msvc` 需与 rollup 版本一致） |
| vitest 缓存写入 EPERM | 经 `npm.cmd` 运行 vitest 时随机丢测试文件（`EPERM ... AppData/Local/Temp/.../web/...`） | 直接用 node 运行：`node node_modules/vitest/vitest.mjs run`（或 `env -u NODE_OPTIONS` + node 直跑） |
| React Router future flag 警告 | v6.28 提示 v7 变更 | 无害；升级 v7 时统一处理 |
