import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { BarChart3, Database, Download, FileSpreadsheet, History, LayoutPanelLeft, Plus, Search, Settings, Sparkles, Trash2, Users, Wand2 } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, AreaChart, Area } from "recharts";

const weeks = ["W2","W3","W4","W5","W6","W7","W8","W9","W10","W11","W12","W13","W14","W15","W16","W17","W18","W19","W20","W21","W22","W23","W24","W25","W26","W27"];
const weekLabels = weeks.map((w) => `26${w}`);
const dates = ["1/5","1/12","1/19","1/26","2/2","2/9","2/16","2/23","3/2","3/9","3/16","3/23","3/30","4/6","4/13","4/20","4/27","5/4","5/11","5/18","5/25","6/1","6/8","6/15","6/22","6/29"];
const monthSegments = [
  { label: "2026年1月", span: 4, color: "bg-sky-100" },
  { label: "2026年2月", span: 4, color: "bg-orange-100" },
  { label: "2026年3月", span: 5, color: "bg-stone-100" },
  { label: "2026年4月", span: 4, color: "bg-lime-200" },
  { label: "2026年5月", span: 5, color: "bg-blue-200" },
  { label: "2026年6月", span: 4, color: "bg-yellow-200" },
];

const baseCreated = [0,2,21,158,220,206,35,121,84,55,27,17,12,7,5,4,2,1,2,1,0,0,0,0,0,0];
const baseFixed = [0,0,10,78,115,152,3,187,132,101,86,53,15,7,6,6,6,5,5,3,1,0,0,0,0,0];

function cumulative(arr) {
  return arr.map((_, idx) => arr.slice(0, idx + 1).reduce((s, x) => s + x, 0));
}

function makeWeekly(created, fixed) {
  const cumCreated = cumulative(created);
  const cumFixed = cumulative(fixed);
  return weeks.map((week, i) => ({
    week,
    weekLabel: weekLabels[i],
    date: dates[i],
    created: created[i],
    fixed: fixed[i],
    cumCreated: cumCreated[i],
    cumFixed: cumFixed[i],
    backlog: cumCreated[i] - cumFixed[i],
  }));
}

function scaleSeries(arr, ratio, shifts = {}) {
  return arr.map((value, idx) => Math.max(0, Math.round(value * ratio + (shifts[idx] || 0))));
}

const projectLibrary = {
  "Monet NP Dish": {
    cycle: "26W2-26W27",
    defects: 980,
    teams: 8,
    similarity: 91,
    weekly: makeWeekly(baseCreated, baseFixed),
    createdTeams: [
      { team: "Google XTS", values: [0,0,6,5,5,4,0,3,2,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0] },
      { team: "系统质量二部-运营商系统测试组", values: [0,0,4,75,84,77,0,64,52,38,19,15,11,5,4,2,2,1,1,1,0,0,0,0,0,0] },
      { team: "系统质量二部-北美需求交付组", values: [0,0,2,5,8,6,0,4,2,2,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
      { team: "北美测试部", values: [0,0,3,32,42,36,0,7,6,3,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
      { team: "专项与协议测试部-运营商专项测试二组", values: [0,0,0,0,22,26,0,4,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
      { team: "专项与协议测试部-运营商协议测试一组", values: [0,2,5,41,58,56,35,37,21,10,5,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0] },
      { team: "流水线", values: [0,0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0] },
      { team: "Hera/Usersupport/APRUUT", values: [0,0,0,0,1,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
    ],
    fixedTeams: [
      { team: "协议技术部", values: [0,0,1,8,12,23,3,28,20,15,13,8,2,1,1,1,1,1,1,1,0,0,0,0,0,0] },
      { team: "底软技术部", values: [0,0,1,8,12,15,0,19,13,6,4,3,1,1,0,0,0,0,0,0,0,0,0,0,0,0] },
      { team: "系统技术部", values: [0,0,1,8,12,23,0,28,20,20,17,10,3,1,1,1,1,1,1,1,1,0,0,0,0,0] },
      { team: "运营商应用开发部", values: [0,0,2,16,22,23,0,28,20,20,17,11,3,1,1,1,1,1,1,1,1,0,0,0,0,0] },
      { team: "基础应用开发部", values: [0,0,3,23,34,30,0,37,26,15,13,8,2,1,1,1,1,1,1,1,0,0,0,0,0,0] },
      { team: "独立应用开发部", values: [0,0,2,15,23,15,0,19,13,10,9,5,2,1,1,1,1,1,1,1,0,0,0,0,0,0] },
      { team: "工程效能部", values: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
      { team: "终端OS部", values: [0,0,0,0,0,8,0,9,7,10,9,5,1,1,1,1,1,0,0,0,0,0,0,0,0,0] },
      { team: "Camera", values: [0,0,0,0,0,15,0,19,13,5,4,3,1,0,0,0,0,0,0,0,0,0,0,0,0,0] },
    ],
    milestones: [
      { label: "FC checklist", week: "W4" },
      { label: "M1-1", week: "W5" },
      { label: "M1-2", week: "W6" },
      { label: "M1-3", week: "W7" },
      { label: "M1-4", week: "W9" },
      { label: "M1-5", week: "W10" },
      { label: "M2", week: "W11" },
      { label: "M3", week: "W12" },
      { label: "M4", week: "W13" },
      { label: "M5-1", week: "W14" },
      { label: "M5-L", week: "W15" },
      { label: "V1", week: "W17" },
      { label: "V2", week: "W18" },
      { label: "V3", week: "W22" },
      { label: "V4", week: "W23" },
    ],
  },
  "Beryl TMO": {
    cycle: "26W4-26W29",
    defects: 1126,
    teams: 9,
    similarity: 84,
    weekly: makeWeekly(scaleSeries(baseCreated, 1.12, { 4: 25, 5: 16, 10: 8 }), scaleSeries(baseFixed, 1.08, { 8: 12, 9: 8 })),
  },
  "Goldfinch TMO": {
    cycle: "26W3-26W26",
    defects: 865,
    teams: 8,
    similarity: 79,
    weekly: makeWeekly(scaleSeries(baseCreated, 0.9, { 4: -20, 5: -18 }), scaleSeries(baseFixed, 0.92, { 7: 6 })),
  },
  "Atlas VZW": {
    cycle: "26W6-26W30",
    defects: 1038,
    teams: 8,
    similarity: 68,
    weekly: makeWeekly(scaleSeries(baseCreated, 1.03, { 6: 28, 7: -10, 12: 6 }), scaleSeries(baseFixed, 1.01, { 9: 6, 10: 5 })),
  },
};

const projectNames = Object.keys(projectLibrary);
const compareColors = ["#0f172a", "#0284c7", "#16a34a", "#f59e0b", "#7c3aed"];

const forecastWeeklyBase = makeWeekly(
  [0,4,18,71,105,122,96,87,73,62,50,40,34,26,20,15,11,8,6,4,3,2,2,1,1,0],
  [0,0,5,28,54,70,83,95,91,80,73,61,52,46,38,31,25,19,14,10,7,4,3,2,2,1]
);

const forecastCreatedTeams = [
  { team: "测试-系统质量二部", group: "测试团队", values: [0,2,10,31,43,49,40,34,28,20,17,11,9,6,5,4,3,2,2,1,1,0,0,0,0,0] },
  { team: "测试-北美测试部", group: "测试团队", values: [0,1,5,19,28,31,24,20,17,13,10,8,6,5,4,3,2,2,1,1,0,0,0,0,0,0] },
  { team: "测试-专项与协议测试", group: "测试团队", values: [0,1,3,15,22,24,18,17,14,12,8,7,5,4,3,2,2,1,1,1,0,0,0,0,0,0] },
  { team: "开发支持/其他", group: "开发团队", values: [0,0,0,6,12,18,14,16,14,17,15,14,14,11,8,6,4,3,2,1,1,1,1,1,1,0] },
];

const forecastFixedTeams = [
  { team: "开发-协议技术部", group: "开发团队", values: [0,0,1,5,8,10,13,14,13,12,11,9,8,7,6,5,4,3,2,2,1,1,1,1,1,0] },
  { team: "开发-系统技术部", group: "开发团队", values: [0,0,1,6,12,16,17,19,18,15,13,11,10,9,7,6,5,4,3,2,2,1,1,0,0,0] },
  { team: "开发-应用开发部", group: "开发团队", values: [0,0,1,8,14,18,21,24,22,19,18,15,12,10,8,6,5,4,3,2,1,1,1,1,1,1] },
  { team: "测试验证闭环", group: "测试团队", values: [0,0,2,9,20,26,32,38,38,34,31,26,22,20,17,14,11,8,6,4,3,1,0,0,0,0] },
];

const systemFieldMappings = [
  { business: "团队字段", jiraField: "customfield_12345", purpose: "按团队统计 Created / Fixed；供团队配置和预测拆分使用", example: "系统质量二部-运营商系统测试组", active: true },
  { business: "创建时间", jiraField: "created", purpose: "按业务周统计每周创建量", example: "2026-01-12", active: true },
  { business: "解决时间", jiraField: "resolved", purpose: "按业务周统计每周解决量", example: "2026-03-09", active: true },
  { business: "Issue Type", jiraField: "issuetype.name", purpose: "过滤 defect / bug / defect_new 等类型", example: "Defect", active: true },
  { business: "项目字段", jiraField: "project.key", purpose: "拉取指定项目，生成历史项目汇总", example: "MONETNPDISH", active: true },
];

const teamCatalog = [
  { name: "系统质量二部-运营商系统测试组", type: "测试团队", enabled: true, note: "主要承担系统测试" },
  { name: "系统质量二部-北美需求交付组", type: "测试团队", enabled: true, note: "需求交付与验证" },
  { name: "北美测试部", type: "测试团队", enabled: true, note: "实网及专项验证" },
  { name: "专项与协议测试部-运营商专项测试二组", type: "测试团队", enabled: true, note: "专项测试" },
  { name: "专项与协议测试部-运营商协议测试一组", type: "测试团队", enabled: true, note: "协议测试" },
  { name: "协议技术部", type: "开发团队", enabled: true, note: "开发修复" },
  { name: "系统技术部", type: "开发团队", enabled: true, note: "平台与系统修复" },
  { name: "运营商应用开发部", type: "开发团队", enabled: true, note: "运营商功能修复" },
  { name: "基础应用开发部", type: "开发团队", enabled: true, note: "应用侧修复" },
];

const defaultRefProjects = [
  { project: "Monet NP Dish", similarity: 91, source: "自动识别" },
  { project: "Beryl TMO", similarity: 84, source: "自动识别" },
  { project: "Goldfinch TMO", similarity: 79, source: "手工添加" },
];

const defaultMilestones = [
  { name: "FC checklist", week: "26W4", date: "1/19" },
  { name: "M1-1", week: "26W5", date: "1/26" },
  { name: "M1-2", week: "26W6", date: "2/2" },
  { name: "M1-3", week: "26W7", date: "2/9" },
  { name: "V1", week: "26W17", date: "4/20" },
  { name: "V4", week: "26W23", date: "6/1" },
];

function Kpi({ title, value, sub, icon: Icon }) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-5 flex items-start justify-between">
        <div>
          <div className="text-sm text-slate-500">{title}</div>
          <div className="text-2xl font-semibold mt-1">{value}</div>
          <div className="text-xs text-slate-500 mt-1">{sub}</div>
        </div>
        <div className="p-2 rounded-2xl bg-slate-100">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
      </CardContent>
    </Card>
  );
}

function Sidebar({ current, setCurrent }) {
  const items = [
    ["config", "系统配置", Settings],
    ["jira", "JIRA 数据获取", Database],
    ["teams", "团队配置", Users],
    ["history", "历史项目", History],
    ["params", "预测参数", Wand2],
    ["forecast", "预测结果", BarChart3],
  ];

  return (
    <div className="w-64 border-r bg-white/70 backdrop-blur">
      <div className="p-5 border-b">
        <div className="flex items-center gap-2 font-semibold text-lg">
          <LayoutPanelLeft className="h-5 w-5" />
          Defect Forecast
        </div>
        <div className="text-xs text-slate-500 mt-1">React 桌面风格 UI Demo</div>
      </div>
      <div className="p-3 space-y-1">
        {items.map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setCurrent(key)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm transition ${current === key ? "bg-slate-900 text-white shadow" : "hover:bg-slate-100 text-slate-700"}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ExcelTemplatePreview({ projectName, dataset, compact = false }) {
  const createdRows = dataset.createdTeams || [];
  const fixedRows = dataset.fixedTeams || [];
  const totalCreated = dataset.weekly.map((x) => x.created);
  const totalFixed = dataset.weekly.map((x) => x.fixed);
  const cumCreated = dataset.weekly.map((x) => x.cumCreated);
  const cumFixed = dataset.weekly.map((x) => x.cumFixed);
  const backlog = dataset.weekly.map((x) => x.backlog);

  return (
    <ScrollArea className="w-full whitespace-nowrap rounded-xl border">
      <div className="min-w-[1800px] bg-white">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="border p-2 bg-slate-100 text-left">项目名</th>
              <th className="border p-2 bg-slate-100 text-left">Month</th>
              {monthSegments.map((m) => (
                <th key={m.label} colSpan={m.span} className={`border p-2 text-center font-semibold ${m.color}`}>{m.label}</th>
              ))}
            </tr>
            <tr>
              <th className="border p-2 bg-white text-left text-red-600">{projectName}</th>
              <th className="border p-2 bg-slate-50 text-left">Date</th>
              {dates.map((d) => <th key={d} className="border p-2 bg-slate-50 text-center">{d}</th>)}
            </tr>
            <tr>
              <th className="border p-2 bg-white text-left">部门</th>
              <th className="border p-2 bg-slate-50 text-left">Week</th>
              {weekLabels.map((w) => <th key={w} className="border p-2 bg-slate-50 text-center">{w}</th>)}
            </tr>
          </thead>
          <tbody>
            {createdRows.map((row) => (
              <tr key={row.team}>
                <td className="border p-2">Created</td>
                <td className="border p-2">{row.team}</td>
                {row.values.map((value, idx) => <td key={idx} className="border p-2 text-center">{value}</td>)}
              </tr>
            ))}
            <tr className="bg-yellow-200 font-semibold">
              <td className="border p-2">Created</td>
              <td className="border p-2">Total Created</td>
              {totalCreated.map((value, idx) => <td key={idx} className="border p-2 text-center">{value}</td>)}
            </tr>
            <tr className="bg-sky-400 text-slate-900 font-semibold">
              <td className="border p-2">Created</td>
              <td className="border p-2">累计创建</td>
              {cumCreated.map((value, idx) => <td key={idx} className="border p-2 text-center">{value}</td>)}
            </tr>
            {fixedRows.map((row) => (
              <tr key={row.team}>
                <td className="border p-2">Fixed</td>
                <td className="border p-2">{row.team}</td>
                {row.values.map((value, idx) => <td key={idx} className="border p-2 text-center">{value}</td>)}
              </tr>
            ))}
            <tr className="bg-yellow-200 font-semibold">
              <td className="border p-2">Fixed</td>
              <td className="border p-2">Total Fixed</td>
              {totalFixed.map((value, idx) => <td key={idx} className="border p-2 text-center">{value}</td>)}
            </tr>
            <tr className="bg-sky-400 text-slate-900 font-semibold">
              <td className="border p-2">Fixed</td>
              <td className="border p-2">累计解决</td>
              {cumFixed.map((value, idx) => <td key={idx} className="border p-2 text-center">{value}</td>)}
            </tr>
            <tr className="bg-cyan-400 text-slate-900 font-semibold">
              <td className="border p-2">遗留</td>
              <td className="border p-2">Backlog</td>
              {backlog.map((value, idx) => <td key={idx} className="border p-2 text-center">{value}</td>)}
            </tr>
            <tr>
              <td className="border p-2">MV 版本</td>
              <td className="border p-2"></td>
              {weeks.map((w) => {
                const m = (dataset.milestones || []).find((x) => x.week === w);
                return <td key={w} className="border p-2 text-center">{m ? m.label : ""}</td>;
              })}
            </tr>
            {!compact && (
              <>
                <tr className="bg-violet-50">
                  <td className="border p-2">问题提交率</td>
                  <td className="border p-2"></td>
                  {weeks.map((w, idx) => <td key={w} className="border p-2 text-center">{idx === 4 ? "30%" : idx === 9 ? "70%" : idx === 11 ? "85%" : idx === 13 ? "90%" : idx === 20 ? "99%" : ""}</td>)}
                </tr>
                <tr className="bg-rose-50">
                  <td className="border p-2">问题解决率</td>
                  <td className="border p-2"></td>
                  {weeks.map((w, idx) => <td key={w} className="border p-2 text-center">{idx === 4 ? "50%" : idx === 9 ? "80%" : idx === 11 ? "93%" : ""}</td>)}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </ScrollArea>
  );
}

function ConfigPage() {
  const [mappings] = useState(systemFieldMappings);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">系统配置</h2>
        <p className="text-sm text-slate-500 mt-1">这里主要配置 Jira 连接、字段映射，以及导入导出一套可复用的映射方案给其他人使用。</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 rounded-2xl">
          <CardHeader>
            <CardTitle>Jira 连接配置</CardTitle>
            <CardDescription>支持 PAT / Basic Auth，两种方式都可以保留</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Jira Base URL</Label>
              <Input defaultValue="https://jira.company.com" />
            </div>
            <div className="space-y-2">
              <Label>认证方式</Label>
              <Select defaultValue="pat">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pat">PAT</SelectItem>
                  <SelectItem value="basic">Basic Auth</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>用户名</Label>
              <Input defaultValue="hao.lin" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Token / 密码</Label>
              <Input type="password" defaultValue="**************" />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <Button className="rounded-2xl">测试连接</Button>
              <Button variant="outline" className="rounded-2xl">保存配置</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>字段映射说明</CardTitle>
            <CardDescription>这张表决定系统拿 Jira 的哪个字段去做统计和预测</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-slate-600">
            <div>字段映射会被以下模块使用：</div>
            <div>1. JIRA 数据获取时决定拉哪些字段</div>
            <div>2. 历史项目汇总时决定按哪个字段统计团队 / 周 / 类型</div>
            <div>3. 预测时决定参考哪些字段口径生成结果</div>
            <Separator />
            <div className="flex gap-3">
              <Button variant="outline" className="rounded-2xl w-full">导出映射</Button>
              <Button variant="outline" className="rounded-2xl w-full">导入映射</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>字段映射表</CardTitle>
              <CardDescription>可以人为添加、修改、删除。当前生效表示这一行会参与实际拉数和统计。</CardDescription>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="rounded-2xl"><Plus className="h-4 w-4 mr-2" />新增映射</Button>
              <Button variant="outline" className="rounded-2xl">批量编辑</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>业务含义</TableHead>
                <TableHead>Jira 字段 ID / 路径</TableHead>
                <TableHead>用途</TableHead>
                <TableHead>示例值</TableHead>
                <TableHead>当前生效</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((row) => (
                <TableRow key={row.business}>
                  <TableCell className="font-medium">{row.business}</TableCell>
                  <TableCell>{row.jiraField}</TableCell>
                  <TableCell className="text-slate-500">{row.purpose}</TableCell>
                  <TableCell>{row.example}</TableCell>
                  <TableCell><Badge variant={row.active ? "default" : "outline"}>{row.active ? "是" : "否"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" className="h-8 px-3 rounded-xl">编辑</Button>
                      <Button variant="outline" className="h-8 px-3 rounded-xl">删除</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function JiraPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">JIRA 数据获取</h2>
        <p className="text-sm text-slate-500 mt-1">支持直接输入 JQL。周期统一显示成业务周格式，例如 26W2-26W27。</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 rounded-2xl">
          <CardHeader>
            <CardTitle>拉数条件</CardTitle>
            <CardDescription>用户可以直接输入 JQL，也可以通过项目周期辅助理解当前抓取范围</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>项目 Key</Label>
                <Input defaultValue="MONETNPDISH" />
              </div>
              <div className="space-y-2">
                <Label>开始周期</Label>
                <Input defaultValue="26W2" />
              </div>
              <div className="space-y-2">
                <Label>结束周期</Label>
                <Input defaultValue="26W27" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>JQL 输入</Label>
              <textarea
                className="w-full min-h-[140px] rounded-2xl border bg-white p-4 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                defaultValue={`project = MONETNPDISH\nAND issuetype in (defect, bug)\nAND created >= 2026-01-01\nAND created < 2026-07-01`}
              />
            </div>
            <div className="flex gap-3">
              <Button className="rounded-2xl">抓取数据</Button>
              <Button variant="outline" className="rounded-2xl">增量更新</Button>
              <Button variant="outline" className="rounded-2xl">覆盖重拉</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>抓取结果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-slate-500">最近一次同步</div>
              <div className="font-medium mt-1">2026-04-02 10:35</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">周期</div>
              <div className="font-medium mt-1">26W2 - 26W27</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">本次抓取</div>
              <div className="font-medium mt-1">2,184 条</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">写入数据库</div>
              <div className="font-medium mt-1">2,184 / 2,184</div>
            </div>
            <Progress value={100} />
            <Badge className="rounded-xl">同步成功</Badge>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>历史项目缓存</CardTitle>
          <CardDescription>给后续历史项目对比和相似项目识别使用</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>项目</TableHead>
                <TableHead>周期</TableHead>
                <TableHead>Defect 数</TableHead>
                <TableHead>团队数</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectNames.map((name) => (
                <TableRow key={name}>
                  <TableCell className="font-medium">{name}</TableCell>
                  <TableCell>{projectLibrary[name].cycle}</TableCell>
                  <TableCell>{projectLibrary[name].defects}</TableCell>
                  <TableCell>{projectLibrary[name].teams}</TableCell>
                  <TableCell><Badge variant="outline">已缓存</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function TeamsPage() {
  const testingTeams = teamCatalog.filter((x) => x.type === "测试团队");
  const devTeams = teamCatalog.filter((x) => x.type === "开发团队");
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">团队配置</h2>
        <p className="text-sm text-slate-500 mt-1">这里只维护一个统一的团队名称，并区分开发团队和测试团队，不再放权重或多套名字。</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>测试团队</CardTitle>
            <CardDescription>主要用于 Created 侧的测试分布与预测拆分</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>启用</TableHead>
                  <TableHead>团队名称</TableHead>
                  <TableHead>说明</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testingTeams.map((t) => (
                  <TableRow key={t.name}>
                    <TableCell><Checkbox checked={t.enabled} /></TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-slate-500">{t.note}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>开发团队</CardTitle>
            <CardDescription>主要用于 Fixed 侧的开发修复团队统计与预测拆分</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>启用</TableHead>
                  <TableHead>团队名称</TableHead>
                  <TableHead>说明</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devTeams.map((t) => (
                  <TableRow key={t.name}>
                    <TableCell><Checkbox checked={t.enabled} /></TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-slate-500">{t.note}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>团队操作</CardTitle>
          <CardDescription>后续如果确实需要别名映射，可以作为高级功能再补，不放在 MVP 的主界面里。</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button className="rounded-2xl"><Plus className="h-4 w-4 mr-2" />新增团队</Button>
          <Button variant="outline" className="rounded-2xl">导入团队</Button>
          <Button variant="outline" className="rounded-2xl">导出团队配置</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryPage({ selectedProjects, setSelectedProjects, focusProject, setFocusProject }) {
  const compareData = weeks.map((week, idx) => {
    const row = { week: weekLabels[idx] };
    selectedProjects.forEach((project) => {
      row[project] = projectLibrary[project].weekly[idx].created;
    });
    return row;
  });

  const focusDataset = projectLibrary[focusProject];
  const backlogPeak = Math.max(...focusDataset.weekly.map((x) => x.backlog));
  const teamDistribution = [
    ...focusDataset.createdTeams.map((t) => ({ team: t.team, created: t.values.reduce((a, b) => a + b, 0) })),
  ].slice(0, 6);

  const toggleProject = (name) => {
    if (selectedProjects.includes(name)) {
      const next = selectedProjects.filter((x) => x !== name);
      setSelectedProjects(next.length ? next : [name]);
      if (focusProject === name && next.length) setFocusProject(next[0]);
    } else {
      setSelectedProjects([...selectedProjects, name]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">历史项目</h2>
          <p className="text-sm text-slate-500 mt-1">选择一个或多个项目做趋势对比；聚焦某个项目时，下方 KPI、团队分布和 Excel 预览会切到该项目。</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-2xl"><Search className="h-4 w-4 mr-2" />筛选项目</Button>
          <Button className="rounded-2xl"><FileSpreadsheet className="h-4 w-4 mr-2" />导出汇总</Button>
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>项目选择</CardTitle>
          <CardDescription>可多选做趋势对比，点击“设为当前查看项目”切换右侧详细信息和 Excel 预览。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            {projectNames.map((name) => (
              <div key={name} className={`rounded-2xl border px-4 py-3 ${selectedProjects.includes(name) ? "bg-slate-900 text-white" : "bg-white"}`}>
                <div className="font-medium">{name}</div>
                <div className={`text-xs mt-1 ${selectedProjects.includes(name) ? "text-slate-200" : "text-slate-500"}`}>{projectLibrary[name].cycle}</div>
                <div className="flex gap-2 mt-3">
                  <Button variant={selectedProjects.includes(name) ? "secondary" : "outline"} className="rounded-xl h-8" onClick={() => toggleProject(name)}>
                    {selectedProjects.includes(name) ? "已选中" : "加入对比"}
                  </Button>
                  <Button variant="outline" className="rounded-xl h-8 bg-white text-slate-900" onClick={() => setFocusProject(name)}>
                    设为当前查看项目
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi title="当前项目总 Created" value={focusDataset.weekly.at(-1).cumCreated} sub={focusProject} icon={Database} />
        <Kpi title="当前项目总 Fixed" value={focusDataset.weekly.at(-1).cumFixed} sub={focusProject} icon={Sparkles} />
        <Kpi title="当前项目最终 Backlog" value={focusDataset.weekly.at(-1).backlog} sub="累计创建 - 累计解决" icon={History} />
        <Kpi title="当前项目 Backlog 峰值" value={backlogPeak} sub={focusProject} icon={BarChart3} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <Card className="xl:col-span-3 rounded-2xl">
          <CardHeader>
            <CardTitle>历史项目趋势对比</CardTitle>
            <CardDescription>多个项目同图对比，线条颜色区分不同项目</CardDescription>
          </CardHeader>
          <CardContent className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={compareData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                {selectedProjects.map((project, idx) => (
                  <Line key={project} type="monotone" dataKey={project} stroke={compareColors[idx % compareColors.length]} strokeWidth={2.5} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2 rounded-2xl">
          <CardHeader>
            <CardTitle>{focusProject} 团队分布</CardTitle>
          </CardHeader>
          <CardContent className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teamDistribution} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="team" width={120} />
                <Tooltip />
                <Bar dataKey="created" fill="#0f172a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Excel 预览</CardTitle>
          <CardDescription>当前展示项目：{focusProject}。这个预览会尽量贴近你的模板结构，最终导出按模板文件落地。</CardDescription>
        </CardHeader>
        <CardContent>
          <ExcelTemplatePreview projectName={focusProject} dataset={focusDataset} />
        </CardContent>
      </Card>
    </div>
  );
}

function ParamsPage({ refProjects, setRefProjects, milestones, setMilestones, setCurrent }) {
  const removeRefProject = (project) => setRefProjects(refProjects.filter((x) => x.project !== project));
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">预测参数</h2>
        <p className="text-sm text-slate-500 mt-1">先填基础参数，再自动识别相似项目或手工维护参考项目；节点信息也作为基础参数单独维护。</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 rounded-2xl">
          <CardHeader>
            <CardTitle>基础参数</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>新项目名称</Label>
              <Input defaultValue="Aurora NP TMO" />
            </div>
            <div className="space-y-2">
              <Label>开始周期</Label>
              <Input defaultValue="26W2" />
            </div>
            <div className="space-y-2">
              <Label>结束周期</Label>
              <Input defaultValue="26W27" />
            </div>
            <div className="space-y-2">
              <Label>目标总量</Label>
              <Input defaultValue="916" />
            </div>
            <div className="space-y-2">
              <Label>测试团队范围</Label>
              <Select defaultValue="default">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">默认测试团队</SelectItem>
                  <SelectItem value="subset">自定义子集</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>开发团队范围</Label>
              <Select defaultValue="default">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">默认开发团队</SelectItem>
                  <SelectItem value="subset">自定义子集</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>系统建议</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between"><span>自动识别相似项目</span><Badge>可执行</Badge></div>
            <div className="flex items-center justify-between"><span>建议目标总量</span><Badge variant="secondary">890 ~ 940</Badge></div>
            <div className="flex items-center justify-between"><span>团队拆分方式</span><Badge variant="secondary">开发 / 测试两大类</Badge></div>
            <div className="flex items-center justify-between"><span>节点信息</span><Badge variant="outline">按项目单独维护</Badge></div>
            <div className="flex gap-3 pt-2">
              <Button className="rounded-2xl w-full"><Search className="h-4 w-4 mr-2" />自动识别</Button>
              <Button variant="outline" className="rounded-2xl w-full"><Plus className="h-4 w-4 mr-2" />手工添加</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <Card className="xl:col-span-3 rounded-2xl">
          <CardHeader>
            <CardTitle>参考项目</CardTitle>
            <CardDescription>可以自动识别，也可以完全手工添加/删除</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目</TableHead>
                  <TableHead>周期</TableHead>
                  <TableHead>相似度</TableHead>
                  <TableHead>来源</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {refProjects.map((row) => (
                  <TableRow key={row.project}>
                    <TableCell className="font-medium">{row.project}</TableCell>
                    <TableCell>{projectLibrary[row.project]?.cycle || "26W?-26W?"}</TableCell>
                    <TableCell>{row.similarity}%</TableCell>
                    <TableCell><Badge variant="outline">{row.source}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" className="h-8 px-3 rounded-xl">替换</Button>
                        <Button variant="outline" className="h-8 px-3 rounded-xl" onClick={() => removeRefProject(row.project)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2 rounded-2xl">
          <CardHeader>
            <CardTitle>节点信息</CardTitle>
            <CardDescription>不同项目节点数量和名称都不同，所以作为基础参数单独维护</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>节点名</TableHead>
                  <TableHead>周期</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {milestones.map((m) => (
                  <TableRow key={m.name + m.week}>
                    <TableCell>{m.name}</TableCell>
                    <TableCell>{m.week}</TableCell>
                    <TableCell><Button variant="outline" className="h-8 px-3 rounded-xl">编辑</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex gap-3 mt-4">
              <Button variant="outline" className="rounded-2xl"><Plus className="h-4 w-4 mr-2" />新增节点</Button>
              <Button variant="outline" className="rounded-2xl">批量导入节点</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>测试团队拆分</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>团队</TableHead>
                  <TableHead>默认来源</TableHead>
                  <TableHead>启用</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamCatalog.filter((x) => x.type === "测试团队").map((t) => (
                  <TableRow key={t.name}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>按历史项目自动识别</TableCell>
                    <TableCell><Checkbox checked={t.enabled} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>开发团队拆分</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>团队</TableHead>
                  <TableHead>默认来源</TableHead>
                  <TableHead>启用</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamCatalog.filter((x) => x.type === "开发团队").map((t) => (
                  <TableRow key={t.name}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>按历史项目自动识别</TableCell>
                    <TableCell><Checkbox checked={t.enabled} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button className="rounded-2xl px-6" onClick={() => setCurrent("forecast")}><Sparkles className="h-4 w-4 mr-2" />开始预测</Button>
      </div>
    </div>
  );
}

function ForecastPage() {
  const dataset = {
    weekly: forecastWeeklyBase,
    createdTeams: forecastCreatedTeams,
    fixedTeams: forecastFixedTeams,
    milestones: defaultMilestones.map((m) => ({ label: m.name, week: m.week.replace("26", "") })),
  };
  const finalRow = dataset.weekly[dataset.weekly.length - 1];
  const teamSummary = [
    { group: "测试团队", created: forecastCreatedTeams.flatMap((x) => x.values).reduce((s, x) => s + x, 0), fixed: forecastFixedTeams.filter((x) => x.group === "测试团队").flatMap((x) => x.values).reduce((s, x) => s + x, 0) },
    { group: "开发团队", created: forecastCreatedTeams.filter((x) => x.group === "开发团队").flatMap((x) => x.values).reduce((s, x) => s + x, 0), fixed: forecastFixedTeams.filter((x) => x.group === "开发团队").flatMap((x) => x.values).reduce((s, x) => s + x, 0) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">预测结果</h2>
          <p className="text-sm text-slate-500 mt-1">点击“开始预测”后跳转到这里。结果页重点展示总量、趋势、开发/测试两大类拆分，以及按模板导出的 Excel 预览。</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-2xl"><Download className="h-4 w-4 mr-2" />保存预测记录</Button>
          <Button className="rounded-2xl"><FileSpreadsheet className="h-4 w-4 mr-2" />导出 Excel</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi title="预测总 Created" value={finalRow.cumCreated} sub="Aurora NP TMO" icon={Sparkles} />
        <Kpi title="预测总 Fixed" value={finalRow.cumFixed} sub="截至 26W27" icon={Database} />
        <Kpi title="最终 Backlog" value={finalRow.backlog} sub="累计创建 - 累计解决" icon={History} />
        <Kpi title="参考项目数" value="3" sub="自动识别 + 手工补充" icon={Wand2} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <Card className="xl:col-span-3 rounded-2xl">
          <CardHeader>
            <CardTitle>Created / Fixed / Backlog 预测趋势</CardTitle>
          </CardHeader>
          <CardContent className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataset.weekly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="weekLabel" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="created" stroke="#0284c7" fill="#7dd3fc" fillOpacity={0.25} strokeWidth={2} />
                <Area type="monotone" dataKey="fixed" stroke="#16a34a" fill="#86efac" fillOpacity={0.2} strokeWidth={2} />
                <Line type="monotone" dataKey="backlog" stroke="#0f172a" strokeWidth={2.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2 rounded-2xl">
          <CardHeader>
            <CardTitle>开发 / 测试两大类拆分</CardTitle>
          </CardHeader>
          <CardContent className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teamSummary}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="group" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="created" fill="#0284c7" />
                <Bar dataKey="fixed" fill="#16a34a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="weekly" className="w-full">
        <TabsList className="rounded-2xl">
          <TabsTrigger value="weekly">按周结果</TabsTrigger>
          <TabsTrigger value="team">开发/测试拆分</TabsTrigger>
          <TabsTrigger value="excel">Excel 模板预览</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="mt-4">
          <Card className="rounded-2xl">
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>周期</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Fixed</TableHead>
                    <TableHead>累计创建</TableHead>
                    <TableHead>累计解决</TableHead>
                    <TableHead>Backlog</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataset.weekly.map((r) => (
                    <TableRow key={r.week}>
                      <TableCell className="font-medium">{r.weekLabel}</TableCell>
                      <TableCell>{r.created}</TableCell>
                      <TableCell>{r.fixed}</TableCell>
                      <TableCell>{r.cumCreated}</TableCell>
                      <TableCell>{r.cumFixed}</TableCell>
                      <TableCell>{r.backlog}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>测试团队</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>团队</TableHead>
                      <TableHead>预测 Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forecastCreatedTeams.filter((x) => x.group === "测试团队").map((r) => (
                      <TableRow key={r.team}>
                        <TableCell className="font-medium">{r.team}</TableCell>
                        <TableCell>{r.values.reduce((a, b) => a + b, 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>开发团队</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>团队</TableHead>
                      <TableHead>预测 Fixed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forecastFixedTeams.filter((x) => x.group === "开发团队").map((r) => (
                      <TableRow key={r.team}>
                        <TableCell className="font-medium">{r.team}</TableCell>
                        <TableCell>{r.values.reduce((a, b) => a + b, 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="excel" className="mt-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Excel 模板预览</CardTitle>
              <CardDescription>这里按你提供的模板结构做了更接近的预览。最终导出时会以模板文件为准，尽量做到完全一致。</CardDescription>
            </CardHeader>
            <CardContent>
              <ExcelTemplatePreview projectName="Aurora NP TMO" dataset={dataset} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function DefectForecastUIDemo() {
  const [current, setCurrent] = useState("history");
  const [selectedProjects, setSelectedProjects] = useState(["Monet NP Dish", "Beryl TMO"]);
  const [focusProject, setFocusProject] = useState("Monet NP Dish");
  const [refProjects, setRefProjects] = useState(defaultRefProjects);
  const [milestones, setMilestones] = useState(defaultMilestones);

  const content = useMemo(() => ({
    config: <ConfigPage />,
    jira: <JiraPage />,
    teams: <TeamsPage />,
    history: <HistoryPage selectedProjects={selectedProjects} setSelectedProjects={setSelectedProjects} focusProject={focusProject} setFocusProject={setFocusProject} />,
    params: <ParamsPage refProjects={refProjects} setRefProjects={setRefProjects} milestones={milestones} setMilestones={setMilestones} setCurrent={setCurrent} />,
    forecast: <ForecastPage />,
  }), [selectedProjects, focusProject, refProjects, milestones]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar current={current} setCurrent={setCurrent} />
        <main className="flex-1 p-6 lg:p-8">{content[current]}</main>
      </div>
    </div>
  );
}
