## ADDED Requirements

### Requirement: DRP 生成的 JQL 日期窗口须包含结束自然日全天

凡由 DRP 代码拼接、用于表达「自开始日期起至结束日期止（含两端日历日）」的 Jira JQL 条件，对 **日期时间型** 字段 MUST 使用 **下界含首日起**、**上界含末日止** 的等价表达。具体 MUST 满足：下界为 `field >= 'start'`，其中 `start` 为 `YYYY-MM-DD`；上界 MUST NOT 单独使用 `field <= 'end'`（`end` 仅为 `YYYY-MM-DD`）作为唯一上界方式；MUST 采用与 `design.md` 一致的策略（例如 `field < 'endExclusive'`，其中 `endExclusive` 为结束日历日的下一日历日的 `YYYY-MM-DD`），从而在 Jira 默认解析下覆盖结束日当天 0:00 之后的时刻。

#### Scenario: 周界 created 查询含周期末日

- **WHEN** 系统为某业务周生成 `created` 时间窗口，且该周结束日为 `D`（`YYYY-MM-DD`）
- **THEN** 拼接结果 MUST 包含 `D` 日当天创建的 issue（含 `D` 日 0:00 之后的时间戳），且 MUST NOT 依赖 `created <= 'D'` 作为唯一上界表达。

#### Scenario: 历史页修复类字段 OR 子句含周期末日

- **WHEN** 系统为历史页生成包含 `"last time to set verified_sw"`、`"1st time to set closed"`、`"1st time to set postponed"`、`"1st time to set deleted"` 中任一字段的周区间 JQL，且区间结束日为 `D`
- **THEN** 该字段对应子条件 MUST 能命中发生在 `D` 日全天内的时间戳，并与服务端拉数使用的日期边界语义一致。

#### Scenario: 手写 JQL 模式不在本要求范围内

- **WHEN** 用户仅在 JQL 文本框中自行输入完整 JQL（非 DRP 自动拼接的日期片段）
- **THEN** 本要求 MUST NOT 强制改写用户输入；行为变更仅适用于 DRP 生成的 JQL 片段。
