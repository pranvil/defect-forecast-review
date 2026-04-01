from __future__ import annotations

from typing import List, Literal, Optional

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


class ExportForecastRequest(BaseModel):
    projectName: str = Field(min_length=1)
    dataset: ForecastDataset


class ExportError(BaseModel):
    detail: str
    code: Literal["INVALID_INPUT", "TEMPLATE_NOT_FOUND", "EXPORT_FAILED"]
    extra: Optional[dict] = None

