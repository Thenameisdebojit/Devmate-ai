"""
Code Refactor Agent
Automatically applies fixes to code based on error analysis.
"""

from typing import Dict, Any, List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from config import CONFIG, FRAMEWORK_CONFIG
import logging
import json
import re

logger = logging.getLogger(__name__)


class CodeRefactorAgent:
    """Agent that automatically refactors code to fix issues"""
    
    def __init__(self):
        """Initialize the code refactor agent"""
        model_config = FRAMEWORK_CONFIG.model_configs["code"]
        self.llm = ChatGoogleGenerativeAI(
            model=model_config["model"],
            temperature=0.2,  # Low temperature for consistent refactoring
            max_tokens=model_config["max_tokens"],
            google_api_key=CONFIG.google_api_key,
        )
        logger.info("Code Refactor Agent initialized")
    
    def apply_fixes(
        self,
        generated_code: Dict[str, str],
        error_analysis: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Apply suggested fixes to the code"""
        
        if not error_analysis.get("needs_fixes", False):
            return {
                "refactored": False,
                "changes_made": 0,
                "updated_files": [],
                "summary": "No fixes needed"
            }
        
        suggested_fixes = error_analysis.get("suggested_fixes", [])
        if not suggested_fixes:
            return {
                "refactored": False,
                "changes_made": 0,
                "updated_files": [],
                "summary": "No fix suggestions available"
            }
        
        # Group fixes by file
        fixes_by_file = {}
        for fix in suggested_fixes:
            file_path = fix.get("file", "unknown")
            if file_path not in fixes_by_file:
                fixes_by_file[file_path] = []
            fixes_by_file[file_path].append(fix)
        
        refactored_code = {}
        updated_files = []
        changes_made = 0
        
        for file_path, fixes in fixes_by_file.items():
            # Skip if file doesn't exist in generated code
            if file_path not in generated_code:
                logger.warning(f"File {file_path} not found in generated code")
                continue
            
            original_code = generated_code[file_path]
            
            # Apply fixes to this file
            refactored = self._refactor_file(file_path, original_code, fixes)
            
            if refactored and refactored != original_code:
                refactored_code[file_path] = refactored
                updated_files.append(file_path)
                changes_made += len(fixes)
                logger.info(f"Refactored {file_path} with {len(fixes)} fixes")
        
        return {
            "refactored": changes_made > 0,
            "changes_made": changes_made,
            "updated_files": updated_files,
            "refactored_code": refactored_code,
            "summary": f"Applied {changes_made} fixes to {len(updated_files)} files"
        }
    
    def _refactor_file(
        self,
        file_path: str,
        original_code: str,
        fixes: List[Dict[str, Any]]
    ) -> str:
        """Refactor a single file with suggested fixes"""
        
        system_prompt = """You are an expert code refactorer.

Apply the suggested fixes to the code and return ONLY the complete refactored code.

DO NOT:
- Add explanations before or after the code
- Use markdown code fences
- Add comments explaining changes
- Return anything except the refactored code

Return the complete, fixed code file."""
        
        fixes_description = "\n".join([
            f"- {fix.get('issue')}: {fix.get('explanation')}"
            for fix in fixes
        ])
        
        user_prompt = f"""Refactor this code by applying these fixes:

**FILE:** {file_path}

**FIXES TO APPLY:**
{fixes_description}

**ORIGINAL CODE:**
{original_code}

Return the complete refactored code."""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
        
        try:
            response = self.llm.invoke(messages)
            refactored_code = getattr(response, "content", str(response))
            
            # Remove code fences if present
            code_fence = "```"
            if code_fence in refactored_code:
                parts = refactored_code.split(code_fence)
                if len(parts) >= 3:
                    # Get the code between first and second fence
                    refactored_code = parts[1]
                    # Remove language identifier if present
                    if '\n' in refactored_code:
                        lines = refactored_code.split('\n')
                        if lines.strip() in ['javascript', 'typescript', 'python', 'jsx', 'tsx']:
                            refactored_code = '\n'.join(lines[1:])
            
            return refactored_code.strip()
        
        except Exception as e:
            logger.error(f"Error refactoring {file_path}: {e}")
            return original_code


def code_refactor_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node for code refactoring"""
    agent = CodeRefactorAgent()
    
    try:
        generated_code = state.get("generated_code", {})
        error_analysis = state.get("error_analysis", {})
        
        if not error_analysis.get("needs_fixes", False):
            return {
                "logs": [{
                    "phase": "code_refactor",
                    "message": "Skipped refactoring - no fixes needed",
                    "timestamp": state.get("timestamp")
                }]
            }
        
        result = agent.apply_fixes(generated_code, error_analysis)
        
        # Update generated code with refactored versions
        if result.get("refactored", False):
            updated_code = generated_code.copy()
            updated_code.update(result.get("refactored_code", {}))
            
            return {
                "generated_code": updated_code,
                "refactor_result": result,
                "logs": [{
                    "phase": "code_refactor",
                    "message": result.get("summary", "Refactoring complete"),
                    "timestamp": state.get("timestamp")
                }]
            }
        
        return {
            "refactor_result": result,
            "logs": [{
                "phase": "code_refactor",
                "message": "Refactoring attempted but no changes made",
                "timestamp": state.get("timestamp")
            }]
        }
    
    except Exception as e:
        logger.error(f"Code refactor node error: {e}")
        return {
            "refactor_result": {
                "refactored": False,
                "changes_made": 0,
                "summary": f"Refactoring failed: {str(e)}"
            },
            "logs": [{
                "phase": "code_refactor",
                "message": f"Refactoring failed: {str(e)}",
                "timestamp": state.get("timestamp")
            }],
            "errors": state.get("errors", []) + [str(e)]
        }
