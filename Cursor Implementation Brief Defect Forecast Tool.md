# Defect Forecast Tool — Cursor 实施说明（MVP）

## 1. 目标

基于当前已确认的 UI 原型，实现一个 **Windows 本地使用** 的 Defect 预测工具 MVP。

本阶段目标：

* 先做 **可运行的前端原型 + 本地假数据逻辑**
* 再接入 **本地数据存储**
* 最后接入 **Jira Data Center / Server REST API**
* Excel 导出先做“结构正确”，后续再对齐到用户模板完全一致

## 2. 推荐技术路线

### 前端/UI

* React
* TypeScript
* Tailwind CSS
* shadcn/ui
* recharts

### 桌面化

优先两阶段：

1. 先以普通 React Web App 跑通
2. 再接 Tauri 打包成 Windows 桌面应用

### 数据与服务

* 前期：前端本地 mock data / local JSON
* 中期：Python FastAPI 本地服务（仅本机）
* 后期：接 Jira REST API + SQLite

## 3. 为什么这样分阶段

因为当前 UI 已基本确认，但以下内容仍会变化：

* Jira 字段映射
* 历史项目统计口径
* 相似项目识别逻辑
* 预测算法
* Excel 模板细节

所以不建议一开始就把后端、数据库、Jira 接口全部做死。

## 4. MVP 范围

### 本期必须实现

1. 系统配置页
2. JIRA 数据获取页
3. 团队配置页
4. 历史项目页
5. 预测参数页
6. 预测结果页
7. 页面间状态联动
8. 使用本地 mock 数据驱动
9. 基础导出按钮占位

### 本期不做

* 真正 Jira 登录鉴权
* 真正 Excel 模板生成
* 真正数据库持久化
* 真正相似项目算法
* 真正预测算法
* 多用户/权限

## 5. 页面功能定义

### 5.1 系统配置

用途：配置 Jira 连接信息与字段映射。

字段映射表需要支持：

* 新增
* 编辑
* 删除
* 导入 JSON
* 导出 JSON

字段映射项建议结构：

```ts
interface FieldMapping {
  id: string;
  businessName: string;   // 业务含义，如 团队字段 / 创建时间 / 解决时间
  jiraFieldPath: string;  // 如 customfield_12345 / created / resolved
  purpose: string;        // 用途说明
  exampleValue: string;   // 示例值
  enabled: boolean;       // 当前是否生效
}
```

### 5.2 JIRA 数据获取

用途：输入项目周期和 JQL，执行“假抓取”。

本期：

* 保留表单与交互
* 点击抓取后展示 mock 返回结果
* 缓存项目列表到前端状态

### 5.3 团队配置

分为：

* 测试团队
* 开发团队

本期先只维护：

```ts
interface TeamItem {
  id: string;
  name: string;
  type: 'testing' | 'development';
  enabled: boolean;
  note?: string;
}
```

### 5.4 历史项目

支持：

* 多选项目
* 趋势图多线对比
* 指定当前查看项目
* Excel 预览跟随当前查看项目切换

项目数据结构建议：

```ts
interface WeeklyPoint {
  week: string;       // W2
  weekLabel: string;  // 26W2
  date: string;       // 1/5
  created: number;
  fixed: number;
  cumCreated: number;
  cumFixed: number;
  backlog: number;
}

interface TeamWeeklyRow {
  team: string;
  values: number[];
}

interface ProjectHistory {
  name: string;
  cycle: string;
  defects: number;
  teams: number;
  similarity?: number;
  weekly: WeeklyPoint[];
  createdTeams?: TeamWeeklyRow[];
  fixedTeams?: TeamWeeklyRow[];
  milestones?: { label: string; week: string }[];
}
```

### 5.5 预测参数

支持：

* 基础参数
* 自动识别相似项目（本期可用 mock 结果）
* 手工添加/删除参考项目
* 节点信息维护
* 开发/测试两大类团队启用情况展示
* 点击“开始预测”跳转结果页

### 5.6 预测结果

展示：

* KPI
* Created / Fixed / Backlog 趋势图
* 开发/测试两大类拆分
* 按周表格
* Excel 模板预览

## 6. 状态管理建议

若项目还不复杂，可先用：

* React `useState`
* React `useMemo`
* prop drilling

若想稍微规范一些，可用：

* Zustand

建议当前就用 Zustand，避免后期页面联动越来越难维护。

建议 store：

* `settingsStore`
* `teamStore`
* `projectStore`
* `forecastStore`

## 7. 目录结构建议

```text
src/
  app/
  components/
    layout/
    pages/
    charts/
    excel-preview/
    common/
  data/
    mock/
      fieldMappings.ts
      teams.ts
      projects.ts
      forecast.ts
  stores/
    settingsStore.ts
    teamStore.ts
    projectStore.ts
    forecastStore.ts
  types/
    settings.ts
    team.ts
    project.ts
    forecast.ts
  utils/
    calendar.ts
    cumulative.ts
    export.ts
```

## 8. 实施顺序

### Phase 1：整理现有 UI 原型

* 把当前原型拆成独立页面组件
* 把 mock 数据从组件里抽离出来
* 把类型定义抽离到 `types/`

### Phase 2：状态管理

* 建立 Zustand stores
* 页面切换和页面数据联动由 store 管理

### Phase 3：交互完善

* 字段映射表增删改
* 参考项目增删改
* 节点增删改
* 当前查看项目切换

### Phase 4：导出与占位接口

* Excel 导出按钮先预留 handler
* Jira 抓取按钮先接 mock service

### Phase 5：准备后续接后端

* 定义 frontend service interface
* 把 mock service 抽象成 `services/`

## 9. 对 Cursor 的执行要求

### 编码要求

* 全部使用 TypeScript
* 组件拆分清晰，避免超大单文件
* 抽出重复组件
* 所有 mock 数据独立文件管理
* 不要把所有逻辑堆在页面组件里
* 优先可维护性

### UI 要求

* 保持当前原型风格
* 使用圆角卡片、清晰留白
* 不要改整体视觉风格
* 不要擅自删减页面

### 代码组织要求

* 每个页面一个独立文件
* Excel 预览作为独立组件
* 图表组件单独抽离
* 所有类型定义单独管理

## 10. 第一轮让 Cursor 完成的具体任务

1. 初始化 React + TypeScript 项目结构
2. 把当前 demo 拆分为多个页面组件
3. 抽离 mock 数据
4. 建立 types
5. 建立 Zustand store
6. 修复页面之间的数据联动
7. 确保项目可以直接运行

## 11. 第二轮让 Cursor 完成的任务

1. 字段映射表的新增/编辑/删除弹窗
2. 历史项目多选/切换逻辑优化
3. 参考项目增删逻辑
4. 节点信息增删逻辑
5. 预测按钮联动结果页
6. Excel 预览组件继续逼近模板结构

## 12. 第三轮让 Cursor 完成的任务

1. 定义 mock service 层
2. 定义 Jira service interface
3. 定义 export interface
4. 为未来接 Python/SQLite 预留数据接口

## 13. Cursor 首轮提示词

你正在实现一个 Defect Forecast Tool 的前端 MVP。

请基于现有 React UI 原型完成以下工作：

* 使用 TypeScript 重构
* 将单文件原型拆分为可维护的多文件结构
* 抽离类型定义到 `types/`
* 抽离 mock 数据到 `data/mock/`
* 使用 Zustand 管理全局状态
* 保持当前 UI 风格和页面结构不变
* 不要引入真实后端
* 所有按钮先接 mock 逻辑
* 确保历史项目、预测参数、预测结果之间有基本联动

请先完成：

1. 项目结构重构
2. 页面拆分
3. 状态管理
4. mock 数据接入
5. 本地可运行

## 14. Cursor 第二轮提示词

请继续实现交互增强：

* 系统配置页：字段映射支持新增/编辑/删除
* 历史项目页：支持多选项目对比、指定当前查看项目
* 预测参数页：支持参考项目手工添加/删除
* 预测参数页：支持节点信息增删改
* 预测结果页：根据预测参数和 mock 数据刷新显示
* Excel 预览组件继续优化，结构更接近给定模板

要求：

* 继续保持当前 UI 风格
* 不要引入后端
* 所有数据暂时存在 Zustand store 中

## 15. 后续真实实现建议

当前端 MVP 稳定后，再分两步：

1. 接 Python 本地服务（Jira / SQLite / Excel）
2. 接桌面壳（Tauri）

不建议现在就直接让 Cursor 一口气做完整系统。

## 16. 当前最合理的下一步

让 Cursor 先把 **前端原型工程化**，也就是：

* 可维护
* 可运行
* 可继续迭代
* 方便后续接 Jira / Excel / 数据库存储
