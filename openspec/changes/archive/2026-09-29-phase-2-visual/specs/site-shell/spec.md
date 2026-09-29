# Spec Delta

## MODIFIED Requirements

### Requirement: 减少动态效果降级

当系统开启「减少动态效果」时，站点 SHALL NOT 播放入场动效、常驻背景动画与滚动联动动效，且正文 SHALL 保持可见（不得因动效被禁用而停在隐藏态）。滚动进度指示 SHALL 仍然可见——它是信息的呈现，不是装饰动效。

#### Scenario: 开启减少动态效果

- **WHEN** 访客在 `prefers-reduced-motion: reduce` 的环境下打开首页
- **THEN** 页面不启用入场序列，所有正文元素自始可见（无元素停留在 `opacity: 0`）

#### Scenario: 背景与滚动联动一并静止

- **WHEN** 在 `prefers-reduced-motion: reduce` 的环境下滚动首页
- **THEN** 流线布景层不播放动画、装饰层不发生视差位移
- **AND** 环标记与聚光仍然可见

#### Scenario: 进度指示不因降级消失

- **WHEN** 在 `prefers-reduced-motion: reduce` 的环境下从顶部滚动到底部
- **THEN** 滚动进度指示仍然可见并随位置前进，只是不播放过渡动画

## ADDED Requirements

### Requirement: 滚动进度指示

站点 SHALL 在视口顶部提供一条滚动进度指示，其前进量 SHALL 与页面滚动位置一致。该指示 SHALL NOT 遮挡正文（`pointer-events: none`），且 SHALL NOT 成为获得页面信息的唯一途径。

#### Scenario: 随滚动前进

- **WHEN** 访客从页面顶部滚动到底部
- **THEN** 进度指示的填充量从 0 单调增加到满格
- **AND** 中途任意位置停下时，填充量与滚动位置一致

#### Scenario: 不吞点击也不遮挡信息

- **WHEN** 检查进度指示元素
- **THEN** 它是 `pointer-events: none` 的纯装饰/指示元素
- **AND** 页面上的信息不依赖它呈现
