## Why

在 Jira JQL 中，对日期时间型字段使用仅含 `YYYY-MM-DD` 的上界（例如 `created <= "2026-06-30"`）时，Jira 通常按该日 **0 点** 解析，导致 **截止日期当天内** 产生的记录被错误排除，与产品期望的「包含截止日期当天」不一致。

## What Changes

- 统一调整所有用于 **时间窗口上界** 的 JQL 片段，使区间在语义上 **包含结束日期的整天**（与「开始日期当天 0 点起」对齐的常见做法是：上界使用次日 0 点的 **开区间**，或等价地使用 `endOfDay`/带时间的上界，具体以 `design.md` 选定方案为准）。
- 覆盖导出服务中基于起止日期/业务周拼接的 `created` 边界，以及前端历史页中用于团队周统计的 `created` 与各「首次/最后设置」时间字段的 OR 子句。
- 更新 Jira 拉取页中的示例 JQL（若仍使用仅日期上界），与上述语义保持一致。

## Capabilities

### New Capabilities

- `jira-inclusive-date-range`: 定义 DRP 生成的 JQL 中日期/日期时间窗口的语义（含起止日期的自然日），以及上界在 Jira 中的表达方式，避免「截止日当天」被截断。

### Modified Capabilities

（无：`openspec/specs/` 下尚无既有能力规格。）

## Impact

- `export-service/app/logic.py`（`_build_bounded_jql` 等拼接 `created` 边界的逻辑）
- `defect-forecast-web/src/components/pages/HistoryPage.tsx`（`buildFixedTimeRangeClause`、按周 JQL 的 `created` 上界）
- `defect-forecast-web/src/components/pages/JiraPage.tsx`（默认/示例 JQL 文案，如有）
