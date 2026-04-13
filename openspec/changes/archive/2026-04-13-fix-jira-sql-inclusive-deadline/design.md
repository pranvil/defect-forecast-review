## Context

DRP 在服务端与 Web 端会拼接 Jira JQL，对 `created` 以及多个自定义日期时间字段使用 `>= start` 且 `<= end` 的形式，其中 `start`/`end` 为 `YYYY-MM-DD`。Jira 对日期时间字段解析仅日期字面量时，上界通常落在该日 **0:00**，导致截止日当天 **0:00 之后** 的记录无法命中，与「包含截止日期当天」不符。`export-service/app/logic.py` 的 `_build_bounded_jql` 与 `defect-forecast-web` 中 `HistoryPage` 的周/团队 JQL 均存在该模式。

## Goals / Non-Goals

**Goals:**

- 使所有由 DRP 生成的、表示「自然日闭区间 [start, end]」的 JQL 片段，在 Jira 语义上等价于 **含首尾自然日全天**（对带时间的字段：从 start 日 0:00 起，到 end 日最后一瞬间止）。
- 前后端对同一语义采用 **同一套边界策略**，避免仅修一端导致拉数与历史页链接不一致。

**Non-Goals:**

- 不改变用户手写 JQL（例如纯 JQL 拉取模式）的解析规则；除非另有产品决策，仅规范 **程序生成** 的片段。
- 不引入对 Jira Server/Data Center 插件 JQL 函数的硬依赖（例如避免强制要求 `endOfDay()` 可用）。

## Decisions

1. **上界表达方式：「次日 0 点」开区间（推荐默认）**  
   - **做法**：将 `field <= 'end'`（end 为 `YYYY-MM-DD`）改为 `field < 'end+1d'`，其中 `end+1d` 为日历上加一天的 ISO 日期；下界保持 `field >= 'start'`。  
   - **理由**：与 Jira 对「仅日期」字面量按日界解析的行为兼容性好，且不依赖实例是否开启高级 JQL。  
   - **备选**：`field <= "end 23:59"` 或 `endOfDay("end")` — 前者在最后一秒边界上仍可能歧义；后者依赖产品与实例能力。

2. **实现位置**  
   - **Python**：在 `logic.py` 中为日期上界增加「日历加一日」辅助函数，在 `_build_bounded_jql` 中生成 `created >= '...' AND created < '...'`（第二项为 exclusive）。  
   - **TypeScript**：在 `HistoryPage` 的 `buildFixedTimeRangeClause` 与 `buildTeamWeekJql` 的 `created` 子句中，对结束日期同样采用 `< end+1d`；可抽取小的纯函数（例如 `addDaysIso`）与现有 `businessWeekBoundsIso` 输出组合使用。

3. **示例与缓存**  
   - `JiraPage` 默认示例 JQL 若仍展示旧模式，改为与上述语义一致的写法，减少误导。

## Risks / Trade-offs

- **[风险] Jira 时区**：服务器默认时区下「自然日」与用户理解可能偶有不一致。  
  - **缓解**：与当前产品一致，继续以 **日历日**（表单中的 `YYYY-MM-DD`）为准；不在本变更中引入显式时区选择。

- **[风险] 手写 JQL 与自动生成混用**：用户若在 JQL 模式中自行写上界，行为不变。  
  - **缓解**：在规格中明确「本要求仅适用于 DRP 生成的 JQL 片段」。

## Migration Plan

- 无数据迁移。发布新版本后，重新拉取或重新打开历史页链接即可得到修正后的查询范围。
- 回滚：还原相关 JQL 拼接提交即可；已落库的历史计数若曾偏少，需按业务决定是否补拉（非本设计强制范围）。

## Open Questions

- 无。若后续需支持「按用户时区」的自然日，应单独立项。
