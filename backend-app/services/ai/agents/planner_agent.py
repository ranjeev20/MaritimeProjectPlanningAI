import json
from typing import TypedDict, Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from core.config import settings
from models.schemas import ProjectPlan
from .agent_prompts import PLANNER_SYSTEM_PROMPT
import re
from datetime import datetime, timedelta

def parse_start_offset_days(start_period: str) -> int:
    """
    Parse strings like 'Week 1', 'Week 2', 'Day 3', 'Day 10' into offset days.
    - Week 1 = 0 days
    - Week 2 = 7 days
    - Day 3 = 2 days
    """
    if not start_period:
        return 0
    normalized = start_period.strip().lower()
    
    # Check for Week N
    week_match = re.search(r"week\s*(\d+)", normalized)
    if week_match:
        week_num = int(week_match.group(1))
        return max(0, (week_num - 1) * 7)
        
    # Check for Day N
    day_match = re.search(r"day\s*(\d+)", normalized)
    if day_match:
        day_num = int(day_match.group(1))
        return max(0, day_num - 1)
        
    return 0

class PlannerState(TypedDict):
    project_dto: Dict[str, Any]
    project_plan: Dict[str, Any]

def create_planner_agent():
    llm = ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=settings.GEMINI_API_KEY
    )
    
    llm_with_tools = llm.with_structured_output(ProjectPlan)
    
    def generate_plan(state: PlannerState):
        dto = state['project_dto']
        
        system_msg = SystemMessage(content=PLANNER_SYSTEM_PROMPT)
        
        user_content = f"Create a detailed project plan for this confirmed project:\n{json.dumps(dto, indent=2)}\n\n"
        if dto.get("shipyardScopes"):
            user_content += (
                "IMPORTANT: The project has pre-extracted shipyard scopes of work. "
                "You MUST construct the project plan tasks and subtasks so that they map exactly to these extracted scopes:\n"
            )
            for idx, task in enumerate(dto["shipyardScopes"]):
                user_content += f"{idx+1}. Task Summary: {task.get('summary')}\n"
                for s_idx, sub in enumerate(task.get("subtasks", [])):
                    user_content += f"   - Subtask Summary: {sub.get('summary')}\n"
            user_content += "\nPlease plan schedule estimates, priorities, descriptions, and assignees for each of these items."
            
        user_msg = HumanMessage(content=user_content)
        
        response = llm_with_tools.invoke([system_msg, user_msg])
        
        if response:
            plan_dict = response.model_dump()
            from core.date_helper import add_work_days, count_work_days, roll_to_monday_if_weekend, DATE_FORMAT, parse_estimate_to_work_days, WeekendHelper
            from core.budget_helper import BudgetHelper
            from loguru import logger
            
            # Predict dates and calculate budgets
            proj_start_str = dto.get("plannedStartDate")
            duration_weeks = dto.get("durationWeeks") or 1
            crew_size = dto.get("crewSize") or 10
            
            if proj_start_str:
                try:
                    proj_start = datetime.strptime(proj_start_str, DATE_FORMAT)
                    # Roll project start to Monday if weekend
                    proj_start = roll_to_monday_if_weekend(proj_start)
                    dto["plannedStartDate"] = proj_start.strftime(DATE_FORMAT)
                    
                    # Project total work days using weekend helper
                    proj_work_days = WeekendHelper.weeks_to_working_days(duration_weeks)
                    
                    tasks = plan_dict.get("tasks", [])
                    if tasks:
                        # 1. Group tasks by order_index
                        for t in tasks:
                            if t.get("order_index") is None:
                                t["order_index"] = 1
                                
                        tasks_by_order = {}
                        for t in tasks:
                            idx = int(t["order_index"])
                            tasks_by_order.setdefault(idx, []).append(t)
                            
                        sorted_order_indices = sorted(tasks_by_order.keys())
                        
                        # 2. For each task, calculate its raw duration based on subtasks or task estimate
                        for t in tasks:
                            subtasks = t.get("subtasks", [])
                            if subtasks:
                                for s in subtasks:
                                    if s.get("order_index") is None:
                                        s["order_index"] = 1
                                        
                                sub_by_order = {}
                                for s in subtasks:
                                    idx = int(s["order_index"])
                                    sub_by_order.setdefault(idx, []).append(s)
                                    
                                # Raw duration is sum of max duration of each subtask group
                                raw_dur = 0
                                for s_idx in sorted(sub_by_order.keys()):
                                    max_sub_dur = max([parse_estimate_to_work_days(s.get("original_estimate", "1d")) for s in sub_by_order[s_idx]], default=1)
                                    raw_dur += max_sub_dur
                                t["raw_duration"] = max(1, raw_dur)
                            else:
                                t["raw_duration"] = max(1, parse_estimate_to_work_days(t.get("original_estimate", "1d")))
                        
                        # 3. Calculate raw duration for each task group
                        group_raw_durations = {}
                        for idx in sorted_order_indices:
                            group_raw_durations[idx] = max([t["raw_duration"] for t in tasks_by_order[idx]], default=1)
                            
                        total_raw_proj_duration = sum(group_raw_durations.values())
                        if total_raw_proj_duration <= 0:
                            total_raw_proj_duration = 1
                            
                        # 4. Scale group durations to match project total work days exactly
                        scaled_group_durations = {}
                        accumulated = 0
                        for i, idx in enumerate(sorted_order_indices):
                            if i == len(sorted_order_indices) - 1:
                                scaled_group_durations[idx] = max(1, proj_work_days - accumulated)
                            else:
                                scaled = round((group_raw_durations[idx] / total_raw_proj_duration) * proj_work_days)
                                scaled_group_durations[idx] = max(1, scaled)
                                accumulated += scaled_group_durations[idx]
                                
                        # 5. Schedule task groups and their subtasks
                        current_group_start = proj_start
                        
                        for idx in sorted_order_indices:
                            group_duration = scaled_group_durations[idx]
                            group_tasks = tasks_by_order[idx]
                            
                            group_end = add_work_days(current_group_start, group_duration)
                            group_end = roll_to_monday_if_weekend(group_end)
                            
                            for t in group_tasks:
                                t["planned_start_date"] = current_group_start.strftime(DATE_FORMAT)
                                t["planned_end_date"] = group_end.strftime(DATE_FORMAT)
                                
                                subtasks = t.get("subtasks", [])
                                if subtasks:
                                    sub_by_order = {}
                                    for s in subtasks:
                                        s_idx = int(s.get("order_index", 1))
                                        sub_by_order.setdefault(s_idx, []).append(s)
                                        
                                    sorted_sub_indices = sorted(sub_by_order.keys())
                                    
                                    # Subtasks raw group durations
                                    sub_group_raw = {}
                                    for s_idx in sorted_sub_indices:
                                        sub_group_raw[s_idx] = max([parse_estimate_to_work_days(s.get("original_estimate", "1d")) for s in sub_by_order[s_idx]], default=1)
                                        
                                    total_sub_raw = sum(sub_group_raw.values())
                                    if total_sub_raw <= 0:
                                        total_sub_raw = 1
                                        
                                    # Scale subtask groups to match task duration exactly
                                    scaled_sub_group_durations = {}
                                    sub_accumulated = 0
                                    for i, s_idx in enumerate(sorted_sub_indices):
                                        if i == len(sorted_sub_indices) - 1:
                                            scaled_sub_group_durations[s_idx] = max(1, group_duration - sub_accumulated)
                                        else:
                                            scaled = round((sub_group_raw[s_idx] / total_sub_raw) * group_duration)
                                            scaled_sub_group_durations[s_idx] = max(1, scaled)
                                            sub_accumulated += scaled_sub_group_durations[s_idx]
                                            
                                    # Schedule subtasks within task start/end
                                    current_sub_start = current_group_start
                                    for s_idx in sorted_sub_indices:
                                        sub_duration = scaled_sub_group_durations[s_idx]
                                        sub_end = add_work_days(current_sub_start, sub_duration)
                                        sub_end = roll_to_monday_if_weekend(sub_end)
                                        
                                        for s in sub_by_order[s_idx]:
                                            s["planned_start_date"] = current_sub_start.strftime(DATE_FORMAT)
                                            s["planned_end_date"] = sub_end.strftime(DATE_FORMAT)
                                            
                                            s_crew = int(s.get("planned_crew") or s.get("crew_needed") or 1)
                                            s["planned_crew"] = s_crew
                                            s["actual_crew"] = s_crew
                                            
                                            cost = BudgetHelper.calculate_budget(
                                                s["planned_start_date"], 
                                                s["planned_end_date"], 
                                                s_crew
                                            )
                                            s["planned_cost"] = cost
                                            s["actual_cost"] = cost
                                            
                                        current_sub_start = roll_to_monday_if_weekend(sub_end + timedelta(days=1))
                                        
                                    # Task cost is sum of subtasks' costs
                                    t_crew = int(t.get("planned_crew") or t.get("crew_needed") or 1)
                                    t["planned_crew"] = t_crew
                                    t["actual_crew"] = t_crew
                                    t["planned_cost"] = sum(s.get("planned_cost", 0.0) for s in subtasks)
                                    t["actual_cost"] = sum(s.get("actual_cost", 0.0) for s in subtasks)
                                else:
                                    t_crew = int(t.get("planned_crew") or t.get("crew_needed") or 1)
                                    t["planned_crew"] = t_crew
                                    t["actual_crew"] = t_crew
                                    cost = BudgetHelper.calculate_budget(
                                        t["planned_start_date"], 
                                        t["planned_end_date"], 
                                        t_crew
                                    )
                                    t["planned_cost"] = cost
                                    t["actual_cost"] = cost
                                    
                            current_group_start = roll_to_monday_if_weekend(group_end + timedelta(days=1))
                            
                        # Calculate project budget at completion (BAC) in DTO
                        dto["budgetAtCompletion"] = sum([t.get("planned_cost", 0.0) for t in tasks])
                        plan_dict["total_duration_weeks"] = duration_weeks
                        
                except Exception as e:
                    import traceback
                    logger.error(f"Error in planner dates estimation: {str(e)}\n{traceback.format_exc()}")
                    
            return {"project_plan": plan_dict}
        return {"project_plan": {}}
        
    workflow = StateGraph(PlannerState)
    workflow.add_node("generate_plan", generate_plan)
    workflow.set_entry_point("generate_plan")
    workflow.add_edge("generate_plan", END)
    
    return workflow.compile()

planner_agent = create_planner_agent()
