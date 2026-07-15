import json
from typing import TypedDict, Annotated, Sequence, Dict, Any
import operator
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from core.config import settings
from models.schemas import ProjectInterpretationDTO
from .agent_prompts import INTERPRETER_SYSTEM_PROMPT
from .clarification_agent import clarification_node

class InterpreterState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    context: str
    parsed_output: Dict[str, Any]

def create_interpreter_agent():

    
    llm = ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=settings.GEMINI_API_KEY
    )
    
    llm_with_tools = llm.with_structured_output(ProjectInterpretationDTO)
    
    def process_prompt(state: InterpreterState):
        messages = state['messages']
        
        # Extract user prompt to look for document context
        user_prompt = ""
        for msg in reversed(messages):
            if isinstance(msg, HumanMessage) or hasattr(msg, "content"):
                user_prompt = msg.content
                break
                
        document_text = ""
        if "--- Document Context ---" in user_prompt:
            parts = user_prompt.split("--- Document Context ---")
            if len(parts) > 1:
                document_text = parts[1].strip()
                
        extracted_data = {}
        if document_text:
            try:
                from services.ai.extractors.document_extractor import DocumentExtractorPipeline
                pipeline = DocumentExtractorPipeline()
                extracted_data = pipeline.run(document_text)
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to run extraction pipeline: {str(e)}")
        
        system_msg = SystemMessage(content=INTERPRETER_SYSTEM_PROMPT)
        response = llm_with_tools.invoke([system_msg] + list(messages))
        
        if response:
            parsed = response.model_dump()
            
            # Merge extracted shipyard scopes if found
            if extracted_data.get("shipyardScopes"):
                parsed["shipyardScopes"] = extracted_data["shipyardScopes"]
                
                # Enrich majorWorkPackages if it's empty
                if not parsed.get("majorWorkPackages"):
                    parsed["majorWorkPackages"] = [s["summary"] for s in extracted_data["shipyardScopes"]]
                
                # Enrich scopeSummary if it's empty or short
                if not parsed.get("scopeSummary"):
                    parsed["scopeSummary"] = (
                        "Extracted scope of works: " + 
                        ", ".join([s["summary"] for s in extracted_data["shipyardScopes"]])
                    )
            return {"parsed_output": parsed}
        return {"parsed_output": {}}
        
    workflow = StateGraph(InterpreterState)
    workflow.add_node("process_prompt", process_prompt)
    workflow.add_node("clarification_agent", clarification_node)
    
    workflow.set_entry_point("process_prompt")
    workflow.add_edge("process_prompt", "clarification_agent")
    workflow.add_edge("clarification_agent", END)
    
    return workflow.compile()

interpreter_agent = create_interpreter_agent()
