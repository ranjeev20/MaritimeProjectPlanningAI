from typing import Dict, Any, List, Optional
from abc import ABC, abstractmethod
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from core.config import settings
from models.schemas import ScopeTask, ScopeSubtask
from .extractors_prompt import SHIPYARD_SCOPE_EXTRACTOR_PROMPT

class ScopeExtractionResult(BaseModel):
    scopes: List[ScopeTask] = Field(description="Hierarchical list of tasks and their subtasks extracted from shipyard scopes of work")

class BaseExtractor(ABC):
    @abstractmethod
    def extract(self, text: str) -> Dict[str, Any]:
        """Runs the extraction logic on the raw document text."""
        pass

class ShipyardScopeExtractor(BaseExtractor):
    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            google_api_key=settings.GEMINI_API_KEY
        )
        self.llm_with_structure = self.llm.with_structured_output(ScopeExtractionResult)
        
    def extract(self, text: str) -> Dict[str, Any]:
        # Formulate instructions to extract shipyard scope lists and index structures.
        prompt = (
            f"{SHIPYARD_SCOPE_EXTRACTOR_PROMPT}\n\n"
            "Document Text:\n"
            f"{text}"
        )
        
        try:
            result = self.llm_with_structure.invoke(prompt)
            if result and hasattr(result, "scopes"):
                return {"shipyardScopes": [s.model_dump() for s in result.scopes]}
        except Exception as e:
            # We catch exceptions to prevent pipeline failure and ensure robustness
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error in ShipyardScopeExtractor: {str(e)}")
            
        return {"shipyardScopes": []}

class DocumentExtractorPipeline:
    def __init__(self):
        self.extractors = {
            "shipyard_scopes": ShipyardScopeExtractor()
        }
        
    def run(self, text: str) -> Dict[str, Any]:
        results = {}
        for key, extractor in self.extractors.items():
            res = extractor.extract(text)
            results.update(res)
        return results
