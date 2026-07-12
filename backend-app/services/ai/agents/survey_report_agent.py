import base64
from typing import TypedDict, Annotated, Sequence, Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from core.config import settings

class SurveyReportAgentState(TypedDict):
    image_base64: str
    prompt_caption: str
    description: str

def create_survey_report_agent():
    llm = ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=settings.GEMINI_API_KEY
    )
    
    def generate_description(state: SurveyReportAgentState):
        image_base64 = state.get("image_base64", "")
        prompt_caption = state.get("prompt_caption", "")
        
        prompt = (
            f"You are an expert maritime surveyor. Analyze this vessel structure/machinery picture.\n"
            f"Inspector caption/context: {prompt_caption or 'No comments provided'}\n\n"
            f"Write a short, crispy, and to-the-point shipyard scope of work description. "
            f"Focus on the exact engineering actions required (e.g. crop & renew steel, high pressure wash, blasting, overhaul valve, test). "
            f"Keep it under 3 sentences. Write ONLY the final paragraph. No lists, bullet points, or markdown formatting."
        )
        
        content_parts = [{"type": "text", "text": prompt}]
        if image_base64:
            clean_image = image_base64
            if "," in clean_image:
                clean_image = clean_image.split(",")[1]
            content_parts.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{clean_image}"}
            })
            
        message = HumanMessage(content=content_parts)
        response = llm.invoke([message])
        
        # Parse output safely whether it returns a list of dictionaries or a string
        desc_text = ""
        if isinstance(response.content, list):
            for part in response.content:
                if isinstance(part, dict) and part.get("type") == "text":
                    desc_text += part.get("text", "")
                elif isinstance(part, str):
                    desc_text += part
        else:
            desc_text = str(response.content)
            
        return {"description": desc_text.strip()}

    workflow = StateGraph(SurveyReportAgentState)
    workflow.add_node("generate_description", generate_description)
    workflow.set_entry_point("generate_description")
    workflow.add_edge("generate_description", END)
    
    return workflow.compile()

survey_report_agent = create_survey_report_agent()
