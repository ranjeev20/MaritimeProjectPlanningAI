import datetime
from datetime import timedelta
from decimal import Decimal
from sqlalchemy.orm import joinedload, Session
from models.domain import Project, Task, Subtask
from core.date_helper import WeekendHelper
from core.budget_helper import BudgetHelper
from services.ai.agents.evm_prediction_agent import predict_evm_trends
from loguru import logger

class EVMService:

    @classmethod
    def calculate_project_evm(cls, project_id: str, db: Session) -> dict:
        """
        Calculates the weekly, monthly, and yearly EVM timeseries data.
        Performs all deterministic calculations on the backend and uses the
        LangGraph agent with Gemini to construct insights and recommendations.
        """
        # 1. Fetch Project
        project = db.query(Project).options(
            joinedload(Project.tasks).joinedload(Task.subtasks)
        ).filter(Project.project_id == project_id).first()

        # Default empty response structure
        default_empty = {
            "Weekly": {"labels": [], "budgeted_cost": [], "actual_cost": [], "predicted_cost": [], "trend_color": "green", "additional_workers_needed": 0, "suggestion": ""},
            "Monthly": {"labels": [], "budgeted_cost": [], "actual_cost": [], "predicted_cost": [], "trend_color": "green", "additional_workers_needed": 0, "suggestion": ""},
            "Yearly": {"labels": [], "budgeted_cost": [], "actual_cost": [], "predicted_cost": [], "trend_color": "green", "additional_workers_needed": 0, "suggestion": ""},
            "metrics": {
                "bac": 0.0, "pv": 0.0, "ev": 0.0, "ac": 0.0,
                "cpi": 1.0, "spi": 1.0, "cv": 0.0, "sv": 0.0,
                "eac": 0.0, "etc": 0.0, "vac": 0.0,
                "predictedCompletionDate": str(datetime.date.today()),
                "predictedCompletionCost": 0.0,
                "remainingBudget": 0.0,
                "remainingDurationDays": 0,
                "remainingWorkHours": 0.0,
                "currentCrewUtilization": 0.0,
                "forecastDelayDays": 0,
                "criticalPathCount": 0,
                "tasksNotStartedCount": 0,
                "blockedTasksCount": 0,
                "delayedTasksCount": 0
            },
            "ai_analysis": {
                "forecast": {"predictedCompletionCost": 0.0, "predictedCompletionDate": str(datetime.date.today()), "confidence": 1.0},
                "budget": {"status": "On Budget", "expectedVariance": 0.0, "risk": "Low"},
                "schedule": {"status": "On Schedule", "expectedDelayDays": 0, "criticalTasks": []},
                "resources": {"currentCrew": 10, "recommendedCrew": 10, "additionalCrewNeeded": 0},
                "recommendations": {
                    "resourceOptimization": ["Project is healthy. Keep resource levels stable."],
                    "scheduleRecovery": [],
                    "budgetOptimization": [],
                    "riskMitigation": []
                }
            }
        }

        if not project:
            return default_empty

        # 2. Gather Work Items
        work_items = []
        for task in project.tasks:
            planned_budget = float(task.planned_cost) if (task.planned_cost is not None and float(task.planned_cost) > 0.0) else BudgetHelper.calculate_budget(
                task.planned_start_date,
                task.planned_end_date,
                task.planned_crew or 1
            )
            actual_cost = float(task.actual_cost) if (task.actual_cost is not None and float(task.actual_cost) > 0.0) else BudgetHelper.calculate_budget(
                task.actual_start_date or task.planned_start_date,
                task.actual_end_date or task.planned_end_date,
                task.actual_crew or task.planned_crew or 1
            )
            
            task_progress = float(task.progress_percent or 0.0)
            if task.subtasks:
                valid_subs = [s for s in task.subtasks if s.progress_percent is not None]
                if valid_subs:
                    task_progress = sum(float(s.progress_percent) for s in valid_subs) / len(valid_subs)
            
            work_items.append({
                "id": task.task_id,
                "name": task.task_name,
                "planned_start": task.planned_start_date,
                "planned_end": task.planned_end_date,
                "actual_start": task.actual_start_date or task.planned_start_date,
                "actual_end": task.actual_end_date,
                "planned_cost": float(planned_budget),
                "actual_cost": float(actual_cost),
                "progress": task_progress,
                "status": task.status or "Not Started",
                "priority": task.priority or "Medium",
                "crew": task.actual_crew or task.planned_crew or 1,
                "is_milestone": getattr(task, "type", "") == "milestone",
                "work_package": getattr(task, "work_package", None)
            })

        # Project Start Date
        project_start = project.planned_start_date
        if not project_start:
            valid_starts = [item["planned_start"] for item in work_items if item["planned_start"]]
            project_start = min(valid_starts) if valid_starts else datetime.date.today()

        # Project Duration Weeks
        duration_weeks = project.planned_duration or 4
        if duration_weeks <= 0:
            duration_weeks = 4

        # Baseline BAC = Sum of tasks planned costs
        project_bac = sum(item["planned_cost"] for item in work_items)

        # 3. Simulate Demo Data if there's no actual progress but the project is marked "In Progress"
        has_progress = any(item["progress"] > 0 for item in work_items)
        if not has_progress and project.status == "In Progress":
            today = datetime.date.today()
            for idx, item in enumerate(work_items):
                start = item["planned_start"] or project_start
                end = item["planned_end"] or (project_start + timedelta(weeks=duration_weeks))
                if start < today:
                    if end <= today:
                        item["progress"] = 100.0
                        item["actual_start"] = start
                        item["actual_end"] = end
                    else:
                        days_elapsed = (today - start).days
                        total_days = (end - start).days or 1
                        item["progress"] = min(round((days_elapsed / total_days) * 100.0, 2), 90.0)
                        item["actual_start"] = start
                    
                    variance_factor = 0.95 if (idx % 2 == 0) else 1.15
                    item["actual_cost"] = item["planned_cost"] * (item["progress"] / 100.0) * variance_factor

        # 4. Generate Timeseries Weekly Data
        today = datetime.date.today()
        weekly_dates = [project_start + timedelta(weeks=w) for w in range(1, duration_weeks + 1)]
        labels = [f"W{w}" for w in range(1, duration_weeks + 1)]

        budgeted_costs = []
        actual_costs = []
        earned_values = []

        for d in weekly_dates:
            cum_pv = 0.0
            cum_ac = 0.0
            cum_ev = 0.0
            is_future = (d - timedelta(weeks=1) > today) if project_start <= today else False

            for item in work_items:
                p_start = item["planned_start"] or project_start
                p_end = item["planned_end"] or (project_start + timedelta(weeks=duration_weeks))
                p_cost = item["planned_cost"]

                # Cumulative PV allocation (linear)
                if d >= p_end:
                    cum_pv += p_cost
                elif d < p_start:
                    cum_pv += 0.0
                else:
                    denom = (p_end - p_start).days or 1
                    ratio = (d - p_start).days / denom
                    cum_pv += p_cost * max(0.0, min(1.0, ratio))

                # Cumulative AC & EV (past/present only)
                if not is_future:
                    act_start = item["actual_start"]
                    act_end = item["actual_end"]
                    act_cost = item["actual_cost"]
                    progress = item["progress"]
                    ev_max = p_cost * (progress / 100.0)

                    if act_start and d >= act_start:
                        effective_end = act_end if act_end else max(today, act_start + timedelta(days=1))
                        denom = (effective_end - act_start).days or 1
                        
                        # AC Cumulative
                        if d >= effective_end:
                            cum_ac += act_cost
                        else:
                            ratio = (d - act_start).days / denom
                            cum_ac += act_cost * max(0.0, min(1.0, ratio))

                        # EV Cumulative
                        if d >= effective_end:
                            cum_ev += ev_max
                        else:
                            ratio = (d - act_start).days / denom
                            cum_ev += ev_max * max(0.0, min(1.0, ratio))

            budgeted_costs.append(round(cum_pv, 2))
            if is_future:
                actual_costs.append(None)
                earned_values.append(None)
            else:
                actual_costs.append(round(cum_ac, 2))
                earned_values.append(round(cum_ev, 2))

        # Boundary index of the current week (last week with actual data)
        current_week_idx = -1
        for idx, ac_val in enumerate(actual_costs):
            if ac_val is not None:
                current_week_idx = idx

        # Gather cumulative values at the current week
        if current_week_idx != -1:
            cum_pv_curr = budgeted_costs[current_week_idx]
            cum_ac_curr = actual_costs[current_week_idx]
            cum_ev_curr = earned_values[current_week_idx]
        else:
            cum_pv_curr = 0.0
            cum_ac_curr = 0.0
            cum_ev_curr = 0.0

        # Standard EVM Formulas
        cpi = cum_ev_curr / cum_ac_curr if cum_ac_curr > 0 else 1.0
        spi = cum_ev_curr / cum_pv_curr if cum_pv_curr > 0 else 1.0
        cv = cum_ev_curr - cum_ac_curr
        sv = cum_ev_curr - cum_pv_curr
        eac = project_bac / cpi if 0.0 < cpi < 1.0 else project_bac
        etc = eac - cum_ac_curr
        vac = project_bac - eac

        # 5. Redesigned Forecasting & Project Controls Calculations
        # Predicted Completion Date & Forecast Delay Days
        planned_end_date = project_start + timedelta(weeks=duration_weeks)
        pred_duration_weeks = duration_weeks / spi if spi > 0.0 else duration_weeks
        predicted_end_date = project_start + timedelta(weeks=pred_duration_weeks)
        forecast_delay_days = max(0, (predicted_end_date - planned_end_date).days)

        remaining_budget = max(0.0, project_bac - cum_ac_curr)
        remaining_duration_days = max(0, (planned_end_date - today).days)

        # Remaining Work Hours
        remaining_work_hours = 0.0
        for item in work_items:
            if item["progress"] < 100.0:
                item_start = item["planned_start"] or project_start
                item_end = item["planned_end"] or planned_end_date
                item_dur_days = max(WeekendHelper.count_work_days(item_start, item_end), 1)
                item_rem_days = item_dur_days * (1.0 - item["progress"] / 100.0)
                item_crew = item["crew"] or 1
                remaining_work_hours += item_rem_days * 8.0 * item_crew

        # Crew Utilization (%)
        active_tasks_crew = sum(item["crew"] for item in work_items if item["status"] == "In Progress")
        total_project_crew = project.crew_size or 10
        crew_utilization = (active_tasks_crew / total_project_crew) * 100.0 if total_project_crew > 0 else 0.0
        crew_utilization = min(100.0, max(0.0, crew_utilization))

        # Project Health Status Badges
        budget_status = "On Budget"
        if cpi < 0.9:
            budget_status = "Over Budget"
        elif cpi < 1.0:
            budget_status = "Slightly Over Budget"

        schedule_status = "On Schedule"
        if spi < 0.9:
            schedule_status = "Delayed"
        elif spi < 1.0:
            schedule_status = "At Risk"

        overall_risk = "Low"
        if budget_status == "Over Budget" or schedule_status == "Delayed":
            overall_risk = "High"
        elif budget_status == "Slightly Over Budget" or schedule_status == "At Risk":
            overall_risk = "Medium"

        # Tasks lists
        tasks_not_started = [t for t in work_items if t["status"] in ("Not Started", "Planned")]
        blocked_tasks = [t for t in work_items if t["status"] == "Blocked"]
        delayed_tasks = [t for t in work_items if t["status"] == "Delayed"]
        
        critical_path_tasks = [
            t["name"] for t in work_items 
            if t["priority"] in ("High", "Critical") or t["is_milestone"] or t["status"] == "Delayed"
        ]

        # Recommended Crew Sizing
        if cpi >= 1.0:
            recommended_crew = total_project_crew
            additional_crew_needed = 0
        else:
            work_left = project_bac - cum_ev_curr
            weeks_left = max(1, duration_weeks - (current_week_idx + 1))
            required_weekly_work_value = work_left / weeks_left
            crew_needed = max(1.0, required_weekly_work_value / 4000.0)
            recommended_crew = int(round(crew_needed))
            additional_crew_needed = max(0, recommended_crew - total_project_crew)

        # 6. Formulate Deterministic Metrics
        metrics = {
            "bac": round(project_bac, 2),
            "pv": round(cum_pv_curr, 2),
            "ev": round(cum_ev_curr, 2),
            "ac": round(cum_ac_curr, 2),
            "cpi": round(cpi, 2),
            "spi": round(spi, 2),
            "cv": round(cv, 2),
            "sv": round(sv, 2),
            "eac": round(eac, 2),
            "etc": round(etc, 2),
            "vac": round(vac, 2),
            "predictedCompletionDate": predicted_end_date.strftime("%Y-%m-%d"),
            "predictedCompletionCost": round(eac, 2),
            "remainingBudget": round(remaining_budget, 2),
            "remainingDurationDays": int(remaining_duration_days),
            "remainingWorkHours": round(remaining_work_hours, 1),
            "currentCrewUtilization": round(crew_utilization, 1),
            "forecastDelayDays": int(forecast_delay_days),
            "criticalPathCount": len(critical_path_tasks),
            "tasksNotStartedCount": len(tasks_not_started),
            "blockedTasksCount": len(blocked_tasks),
            "delayedTasksCount": len(delayed_tasks)
        }

        # 7. Package task information for LLM
        def get_work_package(task_name: str) -> str:
            tn = task_name.lower()
            if "hull" in tn or "structure" in tn or "steel" in tn:
                return "Hull & Structure"
            elif "pipe" in tn or "piping" in tn or "valve" in tn or "mechanical" in tn or "pump" in tn:
                return "Piping & Mechanical"
            elif "elect" in tn or "wiring" in tn or "cable" in tn or "sensor" in tn:
                return "Electrical & Systems"
            elif "paint" in tn or "coating" in tn or "blast" in tn:
                return "Surface Preparation & Painting"
            else:
                return "General Installation"

        tasks_info = []
        for item in work_items:
            tasks_info.append({
                "name": item["name"],
                "status": item["status"],
                "priority": item["priority"],
                "crew": item["crew"],
                "progress": round(item["progress"], 1),
                "is_milestone": item["is_milestone"],
                "work_package": get_work_package(item["name"])
            })

        # 8. Build historical data to feed LangGraph AI Agent
        historical_weekly = []
        for idx in range(duration_weeks):
            historical_weekly.append({
                "week": idx + 1,
                "pv": budgeted_costs[idx],
                "ac": actual_costs[idx],
                "ev": earned_values[idx]
            })

        # 9. Invoke LangGraph Prediction Agent
        llm_metrics = {
            "predictedCompletionCost": eac,
            "predictedCompletionDate": predicted_end_date.strftime("%Y-%m-%d"),
            "budgetStatus": budget_status,
            "expectedVariance": vac,
            "overallRisk": overall_risk,
            "scheduleStatus": schedule_status,
            "forecastDelayDays": forecast_delay_days,
            "recommendedCrew": recommended_crew,
            "additionalCrewNeeded": additional_crew_needed,
            "criticalPathTasks": critical_path_tasks
        }

        try:
            ai_analysis = predict_evm_trends(
                project_title=project.project_title,
                duration_weeks=duration_weeks,
                budget_at_completion=project_bac,
                current_crew_size=total_project_crew,
                historical_data=historical_weekly,
                metrics=llm_metrics,
                tasks_info=tasks_info
            )
        except Exception as e:
            logger.warning(f"LangGraph Agent failed, falling back to structured mathematical defaults: {e}")
            # Dynamic fallback matching exact requirements
            ai_analysis = EVMAgentAnalysisResponse(
                forecast={
                    "predictedCompletionCost": round(eac, 2),
                    "predictedCompletionDate": predicted_end_date.strftime("%Y-%m-%d"),
                    "confidence": 0.85
                },
                budget={
                    "status": budget_status,
                    "expectedVariance": round(vac, 2),
                    "risk": overall_risk
                },
                schedule={
                    "status": schedule_status,
                    "expectedDelayDays": forecast_delay_days,
                    "criticalTasks": critical_path_tasks[:5]
                },
                resources={
                    "currentCrew": total_project_crew,
                    "recommendedCrew": recommended_crew,
                    "additionalCrewNeeded": additional_crew_needed
                },
                recommendations={
                    "resourceOptimization": [
                        f"Increase welder/fitter resources on critical tasks: {', '.join(critical_path_tasks[:2])}."
                    ] if additional_crew_needed > 0 else ["Maintain current crew sizing levels."],
                    "scheduleRecovery": [
                        "Review task relationships and shift independent activities to run in parallel.",
                        "Fast-track procurement work packages to prevent field delays."
                    ] if forecast_delay_days > 0 else ["No recovery needed, project is on schedule."],
                    "budgetOptimization": [
                        "Minimize premium overtime by reorganizing daily crew structures.",
                        "Reduce equipment rental times by optimizing crane and drydock utilization."
                    ] if vac < 0 else ["Review work packages for additional baseline cost optimization."],
                    "riskMitigation": [
                        "Closely monitor active critical path tasks to resolve resource constraints.",
                        "Track blocked/delayed tasks daily to mitigate downstream structural alignment slips."
                    ]
                }
            )

        # 10. Compute Projected Costs for Timeseries Display (using EAC for linear remaining mapping)
        predicted_costs = [0.0] * duration_weeks
        for idx in range(duration_weeks):
            if idx <= current_week_idx:
                predicted_costs[idx] = actual_costs[idx]
            else:
                progress_ratio = (idx - current_week_idx) / (duration_weeks - 1 - current_week_idx) if (duration_weeks - 1 - current_week_idx) > 0 else 1.0
                predicted_costs[idx] = round(cum_ac_curr + (eac - cum_ac_curr) * progress_ratio, 2)

        # Pack Timeseries Chart Data
        trend_color = "red" if cpi < 1.0 else "green"
        suggestion = ai_analysis.recommendations.resourceOptimization[0] if ai_analysis.recommendations.resourceOptimization else "Project on track."

        weekly_result = {
            "labels": labels,
            "budgeted_cost": budgeted_costs,
            "actual_cost": actual_costs,
            "predicted_cost": predicted_costs,
            "trend_color": trend_color,
            "additional_workers_needed": additional_crew_needed,
            "suggestion": suggestion
        }

        # Monthly aggregation
        monthly_labels = []
        monthly_bc = []
        monthly_ac = []
        monthly_pc = []
        for idx in range(0, duration_weeks, 4):
            m_idx = idx + 3 if idx + 3 < duration_weeks else duration_weeks - 1
            monthly_labels.append(f"Month {len(monthly_labels) + 1}")
            monthly_bc.append(budgeted_costs[m_idx])
            monthly_ac.append(actual_costs[m_idx] if m_idx <= current_week_idx else None)
            monthly_pc.append(predicted_costs[m_idx])

        # Yearly aggregation
        yearly_labels = []
        yearly_bc = []
        yearly_ac = []
        yearly_pc = []
        for idx in range(0, duration_weeks, 52):
            y_idx = idx + 51 if idx + 51 < duration_weeks else duration_weeks - 1
            year_num = project_start.year + len(yearly_labels)
            yearly_labels.append(str(year_num))
            yearly_bc.append(budgeted_costs[y_idx])
            yearly_ac.append(actual_costs[y_idx] if y_idx <= current_week_idx else None)
            yearly_pc.append(predicted_costs[y_idx])

        return {
            "Weekly": weekly_result,
            "Monthly": {
                "labels": monthly_labels,
                "budgeted_cost": monthly_bc,
                "actual_cost": monthly_ac,
                "predicted_cost": monthly_pc,
                "trend_color": trend_color,
                "additional_workers_needed": additional_crew_needed,
                "suggestion": suggestion
            },
            "Yearly": {
                "labels": yearly_labels,
                "budgeted_cost": yearly_bc,
                "actual_cost": yearly_ac,
                "predicted_cost": yearly_pc,
                "trend_color": trend_color,
                "additional_workers_needed": additional_crew_needed,
                "suggestion": suggestion
            },
            "metrics": metrics,
            "ai_analysis": ai_analysis.dict()
        }
