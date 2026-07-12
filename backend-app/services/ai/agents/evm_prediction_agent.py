from typing import List, Dict, Any, TypedDict
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from core.config import settings
from loguru import logger
from langgraph.graph import StateGraph, END
from models.schemas import EVMAgentAnalysisResponse

# Define the State for our LangGraph Agent
class AgentState(TypedDict):
    project_title: str
    duration_weeks: int
    budget_at_completion: float
    current_crew_size: int
    historical_data: List[Dict[str, Any]]
    metrics: Dict[str, Any]
    tasks_info: List[Dict[str, Any]]
    response: Any  # Holds the final EVMAgentAnalysisResponse

def analyze_and_forecast_node(state: AgentState) -> Dict[str, Any]:
    """
    Node function that invokes Gemini using structured output to analyze the project status
    and populate recommendations based on deterministic backend calculations.
    """
    try:
        # Initialize Gemini LLM with structured output mapping
        llm = ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0.2
        )
        structured_llm = llm.with_structured_output(EVMAgentAnalysisResponse)

        # 1. System Prompt detailing constraints and formatting rules
        system_msg = SystemMessage(
            content=(
                "You are a Senior Project Controls Engineer and AI Project Scheduler.\n"
                "Your objective is to analyze the provided calculated EVM metrics and generate qualitative insights and recommendations.\n\n"
                "CRITICAL RULES:\n"
                "1. DO NOT invent or recalculate any project metrics. You must use the EXACT system-calculated values provided in the prompt to populate the JSON forecast, budget, schedule, and resources properties.\n"
                "2. The forecast.predictedCompletionCost must match the calculated Predicted Completion Cost.\n"
                "3. The forecast.predictedCompletionDate must match the calculated Predicted Completion Date.\n"
                "4. The budget.status must match the calculated Budget Status.\n"
                "5. The budget.expectedVariance must match the calculated Expected Budget Variance (VAC).\n"
                "6. The budget.risk must match the calculated Risk Level.\n"
                "7. The schedule.status must match the calculated Schedule Status.\n"
                "8. The schedule.expectedDelayDays must match the calculated Forecast Delay Days.\n"
                "9. The schedule.criticalTasks must list the calculated Critical Path Task names.\n"
                "10. The resources.currentCrew, recommendedCrew, and additionalCrewNeeded must match the calculated crew metrics.\n"
                "11. Generate professional, realistic, and actionable recommendations in the four specific categories:\n"
                "    - resourceOptimization (e.g. adding crew to specific delayed critical tasks, reassigning crew from non-critical tasks)\n"
                "    - scheduleRecovery (e.g. running independent tasks in parallel, start independent tasks earlier, fast-track procurement)\n"
                "    - budgetOptimization (e.g. reducing overtime, reallocating unused budget, delaying low-priority tasks)\n"
                "    - riskMitigation (e.g. weather impacts on offshore operations, multiple critical tasks remaining unstarted)\n"
                "12. Assess your own confidence level (0.0 to 1.0) based on task completeness and data consistency."
            )
        )

        # 2. Compile user query containing calculations and task statuses
        user_content = (
            f"Project Title: {state['project_title']}\n"
            f"Planned Duration: {state['duration_weeks']} weeks\n"
            f"Budget at Completion (BAC): €{state['budget_at_completion']:.2f}\n"
            f"Current Crew Size: {state['current_crew_size']} workers\n\n"
            "SYSTEM CALCULATED METRICS (DO NOT MODIFY THESE):\n"
            f"- Predicted Completion Cost (EAC): €{state['metrics']['predictedCompletionCost']:.2f}\n"
            f"- Predicted Completion Date: {state['metrics']['predictedCompletionDate']}\n"
            f"- Budget Status: {state['metrics']['budgetStatus']}\n"
            f"- Expected Budget Variance (VAC): €{state['metrics']['expectedVariance']:.2f}\n"
            f"- Overall Risk Level: {state['metrics']['overallRisk']}\n"
            f"- Schedule Status: {state['metrics']['scheduleStatus']}\n"
            f"- Forecast Delay Days: {state['metrics']['forecastDelayDays']} days\n"
            f"- Recommended Crew Size: {state['metrics']['recommendedCrew']}\n"
            f"- Additional Crew Needed: {state['metrics']['additionalCrewNeeded']}\n"
            f"- Critical Path Tasks: {', '.join(state['metrics']['criticalPathTasks']) if state['metrics']['criticalPathTasks'] else 'None'}\n\n"
            "TASK STATUS & RESOURCE ALLOCATIONS:\n"
        )
        for t in state["tasks_info"]:
            user_content += (
                f"- Task: {t['name']} | Status: {t['status']} | Priority: {t['priority']} | "
                f"Crew Assigned: {t['crew']} | Progress: {t['progress']}% | "
                f"Milestone: {t['is_milestone']} | Package: {t['work_package'] or 'N/A'}\n"
            )

        user_msg = HumanMessage(content=user_content)

        logger.info(f"Invoking Gemini structured analysis for project: {state['project_title']}")
        response = structured_llm.invoke([system_msg, user_msg])
        if response:
            return {"response": response}
        raise ValueError("LLM returned an empty response.")
    except Exception as e:
        logger.error(f"EVM Prediction Agent error: {str(e)}")
        raise e

# Define and Compile LangGraph StateGraph Workflow
workflow = StateGraph(AgentState)
workflow.add_node("analyze_and_forecast", analyze_and_forecast_node)
workflow.set_entry_point("analyze_and_forecast")
workflow.add_edge("analyze_and_forecast", END)
compiled_agent = workflow.compile()

def predict_evm_trends(
    project_title: str,
    duration_weeks: int,
    budget_at_completion: float,
    current_crew_size: int,
    historical_data: List[Dict[str, Any]],
    metrics: Dict[str, Any],
    tasks_info: List[Dict[str, Any]]
) -> EVMAgentAnalysisResponse:
    """
    EVM Prediction Agent API. Runs the compiled LangGraph workflow.
    """
    inputs = {
        "project_title": project_title,
        "duration_weeks": duration_weeks,
        "budget_at_completion": budget_at_completion,
        "current_crew_size": current_crew_size,
        "historical_data": historical_data,
        "metrics": metrics,
        "tasks_info": tasks_info,
        "response": None
    }
    result = compiled_agent.invoke(inputs)
    return result["response"]
