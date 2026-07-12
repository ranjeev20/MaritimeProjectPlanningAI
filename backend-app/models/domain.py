import uuid
from sqlalchemy import Column, String, Text, Date, Integer, Numeric, TIMESTAMP, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, synonym
from sqlalchemy.sql import func
from core.database import Base

class Project(Base):
    __tablename__ = "projects"

    project_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_code = Column(String(50), unique=True, nullable=False)
    project_title = Column(String(255), nullable=False)
    project_type = Column(String(100), nullable=False)
    vessel_name = Column(String(255), nullable=False)
    vessel_type = Column(String(100), nullable=False)
    scope_summary = Column(Text)
    priority_level = Column(String(50))
    planned_start_date = Column(Date)
    planned_duration = Column(Integer)
    planned_cost = Column(Numeric(15, 2))
    actual_start_date = Column(Date)
    actual_cost = Column(Numeric(15, 2))
    actual_duration = Column(Integer)
    currency = Column(String(10))
    crew_size = Column(Integer)
    known_risks = Column(Text)
    weather_constraints = Column(Text)
    status = Column(String(50), default='To Do')
    created_by = Column(String(255))
    updated_by = Column(String(255))
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")

    # Synonyms for backward compatibility and typo-safety
    budget_at_completion = synonym("planned_cost")
    duration_weeks = synonym("planned_duration")
    actaul_cost = synonym("actual_cost")


class Task(Base):
    __tablename__ = "tasks"

    task_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_code = Column(String(50), unique=True, nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False)
    task_name = Column(String(255), nullable=False)
    task_description = Column(Text)
    planned_start_date = Column(Date)
    planned_end_date = Column(Date)
    actual_start_date = Column(Date)
    actual_end_date = Column(Date)
    planned_cost = Column(Numeric(15, 2), default=0)
    actual_cost = Column(Numeric(15, 2), default=0)
    progress_percent = Column(Numeric(5, 2), default=0)
    status = Column(String(50), default='Not Started')
    priority = Column(String(50))
    planned_crew = Column(Integer, default=1)
    actual_crew = Column(Integer, default=1)
    order_index = Column(Integer, default=1)
    created_by = Column(String(255))
    updated_by = Column(String(255))
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    project = relationship("Project", back_populates="tasks")
    subtasks = relationship("Subtask", back_populates="task", cascade="all, delete-orphan")


class Crew(Base):
    __tablename__ = "crew"

    crew_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crew_code = Column(String(50), unique=True, nullable=False)
    crew_name = Column(String(255), nullable=False)
    specialization = Column(String(100))
    role = Column(String(100))
    availability_status = Column(String(50), default='Available')
    hourly_rate = Column(Numeric(10, 2))
    created_by = Column(String(255))
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())


class Subtask(Base):
    __tablename__ = "subtasks"

    subtask_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subtask_code = Column(String(50), unique=True, nullable=False)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.task_id", ondelete="CASCADE"), nullable=False)
    assigned_crew_id = Column(UUID(as_uuid=True), ForeignKey("crew.crew_id", ondelete="SET NULL"))
    subtask_name = Column(String(255), nullable=False)
    subtask_description = Column(Text)
    planned_start_date = Column(Date)
    planned_end_date = Column(Date)
    actual_start_date = Column(Date)
    actual_end_date = Column(Date)
    planned_hours = Column(Integer, default=0)
    actual_hours = Column(Integer, default=0)
    planned_cost = Column(Numeric(15, 2), default=0)
    actual_cost = Column(Numeric(15, 2), default=0)
    progress_percent = Column(Numeric(5, 2), default=0)
    status = Column(String(50), default='Pending')
    planned_crew = Column(Integer, default=1)
    actual_crew = Column(Integer, default=1)
    order_index = Column(Integer, default=1)
    created_by = Column(String(255))
    updated_by = Column(String(255))
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    task = relationship("Task", back_populates="subtasks")

class User(Base):
    __tablename__ = "users"

    employee_id = Column(String(20), primary_key=True)
    employee_name = Column(String(100))
    designation = Column(String(100))
    permissions = Column(Text)
    email = Column(String(255), unique=True, nullable=False)
    password = Column(String(255), nullable=False)

class TaskLink(Base):
    __tablename__ = "task_links"

    link_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False)
    source_id = Column(String, nullable=False)
    target_id = Column(String, nullable=False)
    link_type = Column(String(10), nullable=False)


class SurveyReport(Base):
    __tablename__ = "survey_reports"

    report_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False)
    template_id = Column(String(100), nullable=False)
    document_name = Column(String(255))
    doc_nr = Column(String(100))
    reference = Column(String(100))
    revision = Column(String(50))
    company_name = Column(String(255))
    vessel_name = Column(String(255))
    arrival_date = Column(Date)
    total_lead_time = Column(Integer)
    drydock_duration = Column(Integer)
    cover_image_path = Column(String(500))
    interior_image_path = Column(String(500))
    company_logo_path = Column(String(500))
    status = Column(String(50), default='Draft')
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    project = relationship("Project")
    subcontractors = relationship("SurveyReportSubcontractor", back_populates="report", cascade="all, delete-orphan")
    work_scopes = relationship("SurveyReportWorkScope", back_populates="report", cascade="all, delete-orphan")


class SurveyReportSubcontractor(Base):
    __tablename__ = "survey_report_subcontractors"

    subcontractor_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id = Column(UUID(as_uuid=True), ForeignKey("survey_reports.report_id", ondelete="CASCADE"), nullable=False)
    scope_of_works = Column(Text)
    subcontractor = Column(String(255))

    report = relationship("SurveyReport", back_populates="subcontractors")


class SurveyReportWorkScope(Base):
    __tablename__ = "survey_report_work_scopes"

    scope_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id = Column(UUID(as_uuid=True), ForeignKey("survey_reports.report_id", ondelete="CASCADE"), nullable=False)
    sequence_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    image_path = Column(String(500))
    status = Column(String(50), default='New')
    start_date = Column(String(100))
    categories = Column(Text)  # Comma-separated list of categories, e.g. "Steel,Piping"
    permits = Column(Text)      # Comma-separated list of permits, e.g. "Confined space,Hot work"

    report = relationship("SurveyReport", back_populates="work_scopes")



