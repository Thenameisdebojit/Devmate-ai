"""
Error Analyzer Agent
Analyzes validation failures and suggests fixes.
"""

from typing import Dict, Any, List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from config import CONFIG, FRAMEWORK_CONFIG
import logging
import json

logger = logging.getLogger(__name__)


class ErrorAnalyzer:
    """Agent that analyzes errors and suggests fixes"""
    
    def __init__(self):
        """Initialize the error analyzer"""
        model_config = FRAMEWORK_CONFIG.model_configs["validation"]
        self.llm = ChatGoogleGenerativeAI(
            model=model_config["model"],
            temperature=0.3,
            max_tokens=model_config["max_tokens"],
            google_api_key=CONFIG.google_api_key,
        )
        logger.info("Error Analyzer initialized")
    
    def analyze_errors(
        self,
        validation_report: Dict[str, Any],
        generated_code: Dict[str, str],
    ) -> Dict[str, Any]:
        """Analyze validation errors and suggest fixes"""
        
        if not validation_report or validation_report.get("status") == "ok":
            return {
                "needs_fixes": False,
                "analysis": "No critical errors found",
                "suggested_fixes": []
            }
        
        issues = validation_report.get("issues", [])
        if not issues:
            return {
                "needs_fixes": False,
                "analysis": "No issues to analyze",
                "suggested_fixes": []
            }
        
        # Focus on critical and high severity issues
        critical_issues = [i for i in issues if i.get("severity") in ["critical", "high"]]
        
        if not critical_issues:
            return {
                "needs_fixes": False,
                "analysis": "Only low/medium severity issues",
                "suggested_fixes": []
            }
        
        system_prompt = """You are an expert debugger and code fixer.

Analyze the validation issues and return a JSON report with specific fixes:
{
    "needs_fixes": true | false,
    "analysis": "Summary of issues",
    "suggested_fixes": [
        {
            "file": "path/to/file",
            "issue": "Description of the issue",
            "fix_type": "add" | "modify" | "delete",
            "fix_code": "Corrected code snippet",
            "explanation": "Why this fixes the issue"
        }
    ],
    "priority": "critical" | "high" | "medium"
}

Provide actionable, specific fixes that can be applied automatically."""
        
        user_prompt = f"""Analyze these validation issues and provide fixes:

**ISSUES:**
{json.dumps(critical_issues, indent=2)}

**VALIDATION SCORE:** {validation_report.get('overall_score', 0)}/100

Provide specific code fixes for critical issues."""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
        
        try:
            response = self.llm.invoke(messages)
            content = getattr(response, "content", str(response))
            
            # Extract JSON
            json_marker = "```"
            code_fence = "```"
            
            if json_marker in content:
                parts = content.split(json_marker, 1)
                if len(parts) > 1:
                    end_parts = parts[1].split(code_fence, 1)
                    content = end_parts[0].strip()
            
            first_brace = content.find('{')
            last_brace = content.rfind('}')
            if first_brace != -1 and last_brace != -1:
                content = content[first_brace:last_brace+1]
            
            try:
                analysis = json.loads(content)
                logger.info(f"Error analysis complete: {len(analysis.get('suggested_fixes', []))} fixes suggested")
                return analysis
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse error analysis: {e}")
                return {
                    "needs_fixes": True,
                    "analysis": "Analysis completed but parsing failed",
                    "suggested_fixes": []
                }
        
        except Exception as e:
            logger.error(f"Error during error analysis: {e}")
            return {
                "needs_fixes": False,
                "analysis": f"Analysis failed: {str(e)}",
                "suggested_fixes": []
            }


def error_analyzer_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node for error analysis"""
    analyzer = ErrorAnalyzer()
    
    try:
        validation_report = state.get("validation_report", {})
        generated_code = state.get("generated_code", {})
        
        # Only analyze if validation score is low
        score = validation_report.get("overall_score", 100)
        if score >= 70:
            return {
                "error_analysis": {
                    "needs_fixes": False,
                    "analysis": "Validation score acceptable"
                },
                "logs": [{
                    "phase": "error_analysis",
                    "message": f"Skipped error analysis - score {score}/100 is acceptable",
                    "timestamp": state.get("timestamp")
                }]
            }
        
        analysis = analyzer.analyze_errors(validation_report, generated_code)
        
        fix_count = len(analysis.get("suggested_fixes", []))
        
        return {
            "error_analysis": analysis,
            "logs": [{
                "phase": "error_analysis",
                "message": f"Error analysis complete: {fix_count} fixes suggested",
                "timestamp": state.get("timestamp")
            }]
        }
    
    except Exception as e:
        logger.error(f"Error analysis node error: {e}")
        return {
            "error_analysis": {
                "needs_fixes": False,
                "analysis": f"Analysis failed: {str(e)}"
            },
            "logs": [{
                "phase": "error_analysis",
                "message": f"Error analysis failed: {str(e)}",
                "timestamp": state.get("timestamp")
            }],
            "errors": state.get("errors", []) + [str(e)]
        }
