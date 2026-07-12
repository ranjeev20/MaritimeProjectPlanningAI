from pydantic import BaseModel, Field
from typing import Optional, List

class ScopeSubtask(BaseModel):
    summary: str = Field(description="Title of the subtask")
    description: Optional[str] = Field(default=None, description="Detailed description of the subtask")
    original_estimate: Optional[str] = Field(default="0d", description="Estimated effort (e.g., '2d', '4h')")

class ScopeTask(BaseModel):
    summary: str = Field(description="Title of the main task")
    description: Optional[str] = Field(default=None, description="Detailed description of the task")
    subtasks: List[ScopeSubtask] = Field(default_factory=list, description="Subtasks belonging to this task")

class ProjectInterpretationDTO(BaseModel):
    projectTitle: Optional[str] = Field(default=None, description="Main identity of the maritime project for tracking and reporting")
    projectType: Optional[str] = Field(default=None, description="Defines planning logic and workflow type")
    vesselName: Optional[str] = Field(default=None, description="Identifies the vessel involved in the project")
    vesselType: Optional[str] = Field(default=None, description="Helps generate vessel-specific planning templates and tasks")
    clientName: Optional[str] = Field(default=None, description="Used for reporting, approvals, and stakeholder visibility")
    scopeSummary: Optional[str] = Field(default=None, description="Gives AI and planner a high-level understanding of the work scope")
    majorWorkPackages: Optional[List[str]] = Field(default_factory=list, description="Used to generate WBS, activities, and scheduling structure")
    shipyardScopes: Optional[List[ScopeTask]] = Field(default_factory=list, description="Extracted shipyard scope of works")
    priorityLevel: Optional[str] = Field(default=None, description="Determines urgency, planning focus, and resource allocation")
    plannedStartDate: Optional[str] = Field(default=None, description="Establishes the project schedule baseline")
    durationWeeks: Optional[int] = Field(default=None, description="Defines the expected project planning duration")
    dryDockRequired: Optional[str] = Field(default=None, description="Critical maritime scheduling dependency affecting execution planning")
    milestones: Optional[List[str]] = Field(default_factory=list, description="Defines key delivery checkpoints and tracking events")
    budgetAtCompletion: Optional[float] = Field(default=None, description="Defines baseline project budget for EVM calculations")
    currency: Optional[str] = Field(default=None, description="Ensures financial consistency across estimates and reporting")
    crewSize: Optional[int] = Field(default=None, description="Used for manpower estimation and schedule feasibility")
    specializedTeams: Optional[List[str]] = Field(default_factory=list, description="Identifies required expert teams for execution")
    knownRisks: Optional[List[str]] = Field(default_factory=list, description="Helps identify early schedule or cost risks")
    weatherConstraints: Optional[str] = Field(default=None, description="Captures environmental conditions impacting maritime execution")
    missingFields: Optional[List[str]] = Field(default_factory=list, description="Tracks missing information required before planning can begin")
    planningConfidence: Optional[str] = Field(default=None, description="Indicates completeness and reliability of interpreted planning data")
    assumptionsMade: Optional[List[str]] = Field(default_factory=list, description="Records assumptions made by AI/system for transparency")
    userConfirmedFields: Optional[List[str]] = Field(default_factory=list, description="Tracks which critical fields were explicitly approved by the user")

class InterpretationResponse(BaseModel):
    action: str
    confidence: float
    dto: ProjectInterpretationDTO
    warnings: List[str]
    requiresConfirmation: bool

class PromptRequest(BaseModel):
    prompt: str

# Task schemas for the Planner Agent
class Subtask(BaseModel):
    summary: str = Field(description="Title of the subtask")
    description: str = Field(description="Detailed description of the subtask")
    assignee: str = Field(description="Role or person assigned to this subtask")
    original_estimate: str = Field(description="Estimated effort (e.g., '2d', '4h')")
    priority: str = Field(description="Priority (Highest, High, Medium, Low, Lowest)")
    planned_start_date: Optional[str] = Field(default=None, description="Predicted start date (YYYY-MM-DD)")
    planned_end_date: Optional[str] = Field(default=None, description="Predicted end date (YYYY-MM-DD)")
    actual_start_date: Optional[str] = Field(default=None, description="Actual start date (YYYY-MM-DD)")
    actual_end_date: Optional[str] = Field(default=None, description="Actual end date (YYYY-MM-DD)")
    planned_crew: Optional[int] = Field(default=1, description="Estimated number of crew members needed for this subtask")
    actual_crew: Optional[int] = Field(default=1, description="Actual number of crew members used for this subtask")
    planned_cost: Optional[float] = Field(default=0.0, description="Estimated budget cost for this subtask")
    actual_cost: Optional[float] = Field(default=0.0, description="Actual cost for this subtask")
    order_index: Optional[int] = Field(default=1, description="Execution order index (1, 2, 3...)")

class Task(BaseModel):
    summary: str = Field(description="Title of the main task")
    description: str = Field(description="Detailed description of the task")
    assignee: str = Field(description="Role or person assigned to this task")
    reporter: str = Field(description="Role or person who reported/created this task")
    priority: str = Field(description="Priority (Highest, High, Medium, Low, Lowest)")
    status: str = Field(description="Initial status (e.g., 'To Do')")
    original_estimate: str = Field(description="Total estimated effort (e.g., '1w', '3d')")
    start_date: str = Field(description="Estimated start period (e.g., 'Week 1', 'Day 1')")
    due_date: str = Field(description="Estimated due period (e.g., 'Week 2', 'Day 5')")
    planned_start_date: Optional[str] = Field(default=None, description="Predicted start date (YYYY-MM-DD)")
    planned_end_date: Optional[str] = Field(default=None, description="Predicted end date (YYYY-MM-DD)")
    actual_start_date: Optional[str] = Field(default=None, description="Actual start date (YYYY-MM-DD)")
    actual_end_date: Optional[str] = Field(default=None, description="Actual end date (YYYY-MM-DD)")
    labels: List[str] = Field(description="Tags or labels for categorization")
    subtasks: List[Subtask] = Field(description="List of subtasks breaking down this task")
    planned_crew: Optional[int] = Field(default=1, description="Estimated number of crew members needed for this task")
    actual_crew: Optional[int] = Field(default=1, description="Actual number of crew members used for this task")
    planned_cost: Optional[float] = Field(default=0.0, description="Estimated budget cost for this task")
    actual_cost: Optional[float] = Field(default=0.0, description="Actual cost for this task")
    order_index: Optional[int] = Field(default=1, description="Execution order index (1, 2, 3...)")

class ProjectPlan(BaseModel):
    project_title: str
    total_duration_weeks: int
    tasks: List[Task] = Field(description="List of all main tasks to complete the project")

class ExecuteRequest(BaseModel):
    interpretationId: Optional[str] = None
    confirmedDto: ProjectInterpretationDTO

class SavePlanRequest(BaseModel):
    plan: ProjectPlan
    dto: ProjectInterpretationDTO

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    message: str
    employee_id: str
    employee_name: str
    email: str
    designation: Optional[str] = None
    permissions: Optional[str] = None

class CreateUserRequest(BaseModel):
    employee_id: str
    employee_name: str
    designation: str
    permissions: str
    email: str
    password: str

class UpdateUserRequest(BaseModel):
    employee_name: Optional[str] = None
    designation: Optional[str] = None
    permissions: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None

class UserResponse(BaseModel):
    employee_id: str
    employee_name: str
    designation: Optional[str] = None
    permissions: Optional[str] = None
    email: str

class GanttTaskUpdate(BaseModel):
    id: str | int
    start_date: Optional[str] = None
    duration: Optional[int] = None
    progress: Optional[float] = None
    text: Optional[str] = None
    parent: Optional[str | int] = None
    planned_crew: Optional[int] = None
    actual_crew: Optional[int] = None
    planned_cost: Optional[float] = None
    actual_cost: Optional[float] = None
    status: Optional[str] = None

    # Mapped Actual & Planned fields
    Actual_start_date: Optional[str] = None
    Actual_end_date: Optional[str] = None
    Actual_duration: Optional[int] = None
    Actual_crew: Optional[int] = None
    Actual_cost: Optional[float] = None
    planned_start_date: Optional[str] = None
    planned_end_date: Optional[str] = None
    Planned_duration: Optional[int] = None
    Planned_crew: Optional[int] = None
    Planned_cost: Optional[float] = None

class GanttLinkCreate(BaseModel):
    id: str | int
    source: str | int
    target: str | int
    type: str | int

class GanttLinkUpdate(BaseModel):
    id: str | int
    source: str | int
    target: str | int
    type: str | int

# Redesigned EVM Project Health Dashboard Schemas
class EVMForecast(BaseModel):
    predictedCompletionCost: float
    predictedCompletionDate: str
    confidence: float

class EVMBudget(BaseModel):
    status: str
    expectedVariance: float
    risk: str

class EVMSchedule(BaseModel):
    status: str
    expectedDelayDays: int
    criticalTasks: List[str]

class EVMResources(BaseModel):
    currentCrew: int
    recommendedCrew: int
    additionalCrewNeeded: int

class EVMRecommendations(BaseModel):
    resourceOptimization: List[str]
    scheduleRecovery: List[str]
    budgetOptimization: List[str]
    riskMitigation: List[str]

class EVMAgentAnalysisResponse(BaseModel):
    forecast: EVMForecast
    budget: EVMBudget
    schedule: EVMSchedule
    resources: EVMResources
    recommendations: EVMRecommendations

class EVMTimeSeriesData(BaseModel):
    labels: List[str]
    budgeted_cost: List[float]
    actual_cost: List[Optional[float]]
    predicted_cost: List[float]
    trend_color: str

class EVMDeterministicMetrics(BaseModel):
    bac: float
    pv: float
    ev: float
    ac: float
    cpi: float
    spi: float
    cv: float
    sv: float
    eac: float
    etc: float
    vac: float
    predictedCompletionDate: str
    predictedCompletionCost: float
    remainingBudget: float
    remainingDurationDays: int
    remainingWorkHours: float
    currentCrewUtilization: float
    forecastDelayDays: int
    criticalPathCount: int
    tasksNotStartedCount: int
    blockedTasksCount: int
    delayedTasksCount: int

class EVMDashboardResponse(BaseModel):
    Weekly: EVMTimeSeriesData
    Monthly: EVMTimeSeriesData
    Yearly: EVMTimeSeriesData
    metrics: EVMDeterministicMetrics
    ai_analysis: EVMAgentAnalysisResponse
