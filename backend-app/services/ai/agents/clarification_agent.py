from typing import Dict, Any

# REQUIRED_MARITIME_FIELDS = [
#     "projectTitle", "projectType", "vesselName", "vesselType", "clientName",
#     "scopeSummary", "majorWorkPackages", "priorityLevel", "plannedStartDate",
#     "durationWeeks", "dryDockRequired", "milestones", "budgetAtCompletion",
#     "currency", "crewSize", "specializedTeams"
# ]

REQUIRED_MARITIME_FIELDS = [
    "projectTitle", 
    "projectType", 
    "vesselName", 
    "vesselType", 
    "scopeSummary", 
    "majorWorkPackages",
    "priorityLevel", 
    "plannedStartDate",
    "durationWeeks",   
    # "budgetAtCompletion",
    "currency", 
    # "crewSize"
]

def clarification_node(state: dict) -> dict:
    """
    Analyzes the parsed output from the Interpreter Agent to identify missing fields.
    Updates the parsed output with a list of missing fields and a calculated planning confidence score.
    """
    parsed = state.get("parsed_output", {})
    if not parsed:
        return {"parsed_output": {}}
        
    required_fields = REQUIRED_MARITIME_FIELDS
    
    missing = []
    for field in required_fields:
        val = parsed.get(field)
        if val is None or (isinstance(val, list) and len(val) == 0):
            missing.append(field)
            
    parsed["missingFields"] = missing
    
    total = len(required_fields)
    present = total - len(missing)
    confidence = int((present / total) * 100) if total > 0 else 0
    parsed["planningConfidence"] = f"{confidence}%"
    
    return {"parsed_output": parsed}
