from __future__ import annotations

from typing import Any, List, Literal, Optional

from pydantic import BaseModel, Field


class WeeklyPoint(BaseModel):
    week: str
    weekLabel: str
    date: str
    created: int
    fixed: int
    cumCreated: int
    cumFixed: int
    backlog: int


class TeamWeeklyRow(BaseModel):
    team: str
    values: List[int]
    issueKeysByWeek: List[List[str]] = Field(default_factory=list)


class ForecastTeamRow(BaseModel):
    team: str
    group: str
    values: List[int]


class MilestoneLabel(BaseModel):
    label: str
    week: str


class ForecastDataset(BaseModel):
    weekly: List[WeeklyPoint] = Field(min_length=1)
    createdTeams: List[ForecastTeamRow] = Field(default_factory=list)
    fixedTeams: List[ForecastTeamRow] = Field(default_factory=list)
    milestones: List[MilestoneLabel] = Field(default_factory=list)


class ProjectSummary(BaseModel):
    name: str
    displayName: Optional[str] = None
    cycle: str
    defects: int
    teams: int
    similarity: Optional[float] = None


class ProjectHistory(BaseModel):
    name: str
    displayName: Optional[str] = None
    cycle: str
    defects: int
    teams: int
    similarity: Optional[float] = None
    weekly: List[WeeklyPoint]
    createdTeams: List[TeamWeeklyRow] = Field(default_factory=list)
    fixedTeams: List[TeamWeeklyRow] = Field(default_factory=list)
    milestones: List[MilestoneLabel] = Field(default_factory=list)


class JiraFetchRequest(BaseModel):
    projectKey: str = Field(min_length=1)
    startWeek: str = ""
    endWeek: str = ""
    pullMode: Literal["jql", "projectStart"] = "jql"
    jql: str = ""
    startDate: str = ""
    endDate: str = ""
    mode: Literal["normal", "incremental", "overwrite"] = "normal"
    baseUrl: str = Field(min_length=1)
    authType: Literal["pat", "basic"] = "pat"
    username: str = ""
    token: str = Field(min_length=1)
    verifySsl: bool = True
    timeoutSec: int = Field(default=10, ge=3, le=60)


class JiraFetchResult(BaseModel):
    syncedAt: str
    cycleLabel: str
    fetchedCount: int
    writtenCount: int
    status: Literal["success", "failed"]


class JiraConnectionTestRequest(BaseModel):
    baseUrl: str = Field(min_length=1)
    authType: Literal["pat", "basic"] = "pat"
    username: str = ""
    token: str = Field(min_length=1)
    verifySsl: bool = True
    timeoutSec: int = Field(default=10, ge=3, le=60)


class JiraConnectionTestResult(BaseModel):
    ok: bool
    statusCode: int
    message: str
    site: str
    account: str = ""


class ForecastParams(BaseModel):
    newProjectName: str
    startWeek: str
    endWeek: str


class RefProjectRow(BaseModel):
    project: str
    similarity: float
    source: str


class MilestoneParam(BaseModel):
    name: str
    week: str
    date: str
    devResolutionRate: Optional[float] = None
    testCompletionRate: Optional[float] = None
    testSubmissionRate: Optional[float] = None


class ForecastInput(BaseModel):
    params: ForecastParams
    enabledTestingTeams: List[str] = Field(default_factory=list)
    enabledDevTeams: List[str] = Field(default_factory=list)
    milestones: List[MilestoneParam] = Field(default_factory=list)
    refProjects: List[RefProjectRow] = Field(default_factory=list)


class ForecastTeamSummaryRow(BaseModel):
    group: str
    created: int
    fixed: int


class ForecastResult(BaseModel):
    dataset: ForecastDataset
    teamSummary: List[ForecastTeamSummaryRow]


class SaveForecastVersionRequest(BaseModel):
    projectName: str = Field(min_length=1)
    input: ForecastInput
    result: ForecastResult
    note: str = ""


class ForecastVersionRow(BaseModel):
    id: str
    projectName: str
    cycle: str
    note: str
    createdAt: str


class CompareSeriesPoint(BaseModel):
    weekLabel: str
    historyCreated: int
    historyFixed: int
    jiraCreated: int
    jiraFixed: int
    forecastCreated: int
    forecastFixed: int
    backlogHistory: int
    backlogJira: int
    backlogForecast: int


class CompareMetrics(BaseModel):
    totalHistoryCreated: int
    totalJiraCreated: int
    totalForecastCreated: int
    jiraVsForecastGap: int
    historyVsForecastGap: int


class CompareResponse(BaseModel):
    projectName: str
    forecastVersionId: Optional[str] = None
    metrics: CompareMetrics
    weekly: List[CompareSeriesPoint]


class ExportForecastRequest(BaseModel):
    projectName: str = Field(min_length=1)
    dataset: ForecastDataset


class ExportError(BaseModel):
    detail: str
    code: Literal["INVALID_INPUT", "TEMPLATE_NOT_FOUND", "EXPORT_FAILED"]
    extra: Optional[dict[str, Any]] = None


class TeamConfigRow(BaseModel):
    id: str
    name: str
    type: Literal["testing", "development"]
    enabled: bool = True
    note: str = ""


class FieldMappingRow(BaseModel):
    id: str
    businessName: str
    jiraFieldPath: str
    purpose: str
    exampleValue: str
    enabled: bool


class ForecastDefaultsParams(BaseModel):
    newProjectName: str
    startWeek: str
    endWeek: str


class ForecastDefaults(BaseModel):
    refProjects: List[RefProjectRow] = Field(default_factory=list)
    milestones: List[MilestoneParam] = Field(default_factory=list)
    params: ForecastDefaultsParams


class CompareColorsConfig(BaseModel):
    colors: List[str] = Field(default_factory=list)


class JiraIssueDebugRow(BaseModel):
    key: str
    created: str = ""
    resolved: str = ""
    assignee: str = ""
    summary: str = ""
    reporterTeam: str = ""
    assigneeTeam: str = ""
    verifiedSw: str = ""


class JiraFetchDebugInfo(BaseModel):
    projectKey: str
    pullMode: Literal["jql", "projectStart"]
    mode: Literal["normal", "incremental", "overwrite"]
    cycleLabel: str
    requestJql: str
    boundedJql: str
    fetchedCount: int
    writtenCount: int
    syncedAt: str
    requestedFields: List[str] = Field(default_factory=list)
    sampleIssues: List[JiraIssueDebugRow] = Field(default_factory=list)
    error: str = ""


class BugDistCreateTaskRequest(BaseModel):
    primaryProjectKey: str = Field(min_length=1)
    compareProjectKey: str = ""
    forceRefresh: bool = False
    baseUrl: str = Field(min_length=1)
    authType: Literal["pat", "basic"] = "pat"
    username: str = ""
    token: str = Field(min_length=1)
    verifySsl: bool = True
    timeoutSec: int = Field(default=10, ge=3, le=60)


class BugDistTaskProgress(BaseModel):
    pageSize: int = 0
    startAt: int = 0
    fetched: int = 0
    total: int = 0
    message: str = ""


class BugDistCountRow(BaseModel):
    name: str
    primary: int
    compare: int
    gap: int


class BugDistTabResult(BaseModel):
    rows: List[BugDistCountRow]
    top15: List[BugDistCountRow] = Field(default_factory=list)


class BugDistTaskResult(BaseModel):
    primaryProjectKey: str
    compareProjectKey: str = ""
    generatedAt: str
    cached: bool = False
    module: BugDistTabResult
    team: BugDistTabResult


class BugDistTaskStatus(BaseModel):
    taskId: str
    status: Literal["running", "success", "failed"]
    progress: BugDistTaskProgress = Field(default_factory=BugDistTaskProgress)
    result: Optional[BugDistTaskResult] = None
    error: str = ""


class BugDistExportFormat(BaseModel):
    format: Literal["csv", "xlsx"]

