## 1. 服务端 JQL 边界

- [x] 1.1 在 `export-service/app/logic.py` 中新增日历日加一日的辅助函数（输入 `date` 或 `YYYY-MM-DD`，输出次日 ISO 日期字符串）。
- [x] 1.2 修改 `_build_bounded_jql`：将 `created <= '{finish}'` 改为 `created < '{finishExclusive}'`，其中 `finishExclusive` 为结束日历日的下一日；保持 `created >= '{begin}'` 不变；周界回退路径与日期界路径均覆盖。
- [x] 1.3 检索 `logic.py` 中是否还有其他程序生成的 `created` 或日期窗口使用 `<=` + 纯日期上界，一并按 `design.md` 对齐。

## 2. Web 历史页与示例 JQL

- [x] 2.1 在 `defect-forecast-web/src/components/pages/HistoryPage.tsx` 中为 `buildFixedTimeRangeClause` 引入结束日「次日」上界（`< end+1d`），替换各字段子句中的 `<= "${end}"` 上界表达。
- [x] 2.2 更新 `buildTeamWeekJql` 中测试提报分支的 `created` 条件，使结束周界日与 2.1 语义一致。
- [x] 2.3 更新 `defect-forecast-web/src/components/pages/JiraPage.tsx` 默认示例 JQL，使 `created` 上界与上述语义一致（或注明若为用户手写则可保留，但默认示例 MUST 反映产品语义）。

## 3. 验证

- [ ] 3.1 手工构造起止为同一日历日、结束日为周日的用例，在 Jira UI 或 API 中对比修改前后命中条数（应包含截止日当天 0:00 之后的 issue）。
- [x] 3.2 运行前端/后端现有测试（若有）并修复因 JQL 字符串变化导致的快照或单测失败。
