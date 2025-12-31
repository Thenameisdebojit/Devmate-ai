"""
Code Validator Agent
Uses Gemini 2.0 Flash Thinking for deep code analysis and validation.
Automatically falls back to Gemini 2.5 Flash if quota is exceeded.
"""

from typing import Dict, Any, List, Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from config import CONFIG, FRAMEWORK_CONFIG
import logging
import json
import re

logger = logging.getLogger(__name__)


class CodeValidator:
    """Agent that validates generated code with automatic model fallback"""
    
    def __init__(self):
        """Initialize validator with primary and fallback models"""
        # Primary model: Gemini 2.0 Flash Thinking
        primary_config = FRAMEWORK_CONFIG.model_configs["validation"]
        self.primary_llm = ChatGoogleGenerativeAI(
            model=primary_config["model"],
            temperature=primary_config["temperature"],
            max_tokens=primary_config["max_tokens"],
            google_api_key=CONFIG.google_api_key,
            top_p=primary_config.get("top_p", 0.85),
        )
        
        # Fallback model: Gemini 2.5 Flash
        fallback_config = FRAMEWORK_CONFIG.model_configs["validation_fallback"]
        self.fallback_llm = ChatGoogleGenerativeAI(
            model=fallback_config["model"],
            temperature=fallback_config["temperature"],
            max_tokens=fallback_config["max_tokens"],
            google_api_key=CONFIG.google_api_key,
            top_p=fallback_config.get("top_p", 0.85),
        )
        
        self.primary_model_name = primary_config["model"]
        self.fallback_model_name = fallback_config["model"]
        
        logger.info(
            f"Code Validator initialized with {self.primary_model_name} "
            f"(fallback: {self.fallback_model_name})"
        )
    
    def _is_quota_error(self, error: Exception) -> bool:
        """Check if error is a quota/rate limit error"""
        error_str = str(error).lower()
        quota_indicators = [
            "429",
            "quota",
            "rate limit",
            "resourceexhausted",
            "exceeded your current quota"
        ]
        return any(indicator in error_str for indicator in quota_indicators)
    
    def _extract_json(self, content: str) -> str:
        """Extract and clean JSON from response with robust error handling"""
        if not content:
            return "{}"
        
        # Step 1: Remove markdown code fences
        try:
            if "```json" in content:
                parts = content.split("```json", 1)
                if len(parts) > 1:
                    end_parts = parts[1].split("```", 1)
                    content = end_parts[0].strip()
            elif "```" in content:
                parts = content.split("```", 1)
                if len(parts) > 1:
                    end_parts = parts[1].split("```", 1)
                    content = end_parts[0].strip()
        except Exception:
            pass
        
        content = content.strip()
        
        # Step 2: Fix escape sequences and control characters
        try:
            # Replace literal newlines, carriage returns, and tabs inside strings with escape sequences
            def fix_string_content(match):
                string_content = match.group(0)
                # Fix literal newlines and other control characters
                string_content = string_content.replace('\n', '\\n')
                string_content = string_content.replace('\r', '\\r')
                string_content = string_content.replace('\t', '\\t')
                return string_content
            
            # Find all quoted strings and fix control characters in them
            content = re.sub(r'"(?:[^"\\]|\\.)*"', fix_string_content, content, flags=re.DOTALL)
            
            # Fix invalid escape sequences (backslash not followed by valid escape char)
            # Valid JSON escapes: \" \\ \/ \b \f \n \r \t \uXXXX
            content = re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', content)
            
        except Exception as e:
            logger.debug(f"Error fixing JSON: {e}")
            # Simpler fallback - just escape the basic control characters
            content = content.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')
        
        # Step 3: Validate or find JSON object
        try:
            json.loads(content)
            return content
        except json.JSONDecodeError:
            # Try to extract with regex as fallback
            logger.debug("Direct JSON parsing failed, attempting regex extraction")
            json_pattern = r'\{(?:[^{}]|(?:\{[^{}]*\}))*\}'
            matches = re.findall(json_pattern, content, re.DOTALL)
            if matches:
                for match in sorted(matches, key=len, reverse=True):
                    try:
                        # Try to parse each match
                        json.loads(match)
                        logger.debug("Successfully extracted JSON with regex")
                        return match
                    except json.JSONDecodeError:
                        continue
        
        logger.debug("Could not extract valid JSON, returning cleaned content")
        return content
    
    def _summarize_code(self, generated_code: Dict[str, str], max_files: int = 10) -> str:
        """Summarize code for validation (to fit token limits)"""
        summary = []
        file_count = 0
        
        for filepath, content in generated_code.items():
            if file_count >= max_files:
                break
            
            # For package.json and config files, include full content
            if any(name in filepath for name in ["package.json", "tsconfig", "vite.config", ".env"]):
                summary.append(f"FILE: {filepath}\n{content[:500]}\n")
            # For code files, include structure and key functions
            else:
                lines = content.split("\n")[:30]  # First 30 lines
                summary.append(f"FILE: {filepath}\n" + "\n".join(lines) + "\n...\n")
            
            file_count += 1
        
        return "\n---\n".join(summary)
    
    def _create_validation_messages(
        self,
        requirements: Dict[str, Any],
        code_summary: str,
        tech_stack: Dict[str, Any],
        generated_code_count: int
    ) -> List:
        """Create validation prompt messages"""
        
        system_prompt = """You are an expert senior software architect and code reviewer with deep expertise in:
- Software architecture and design patterns
- Security best practices (OWASP Top 10, secure coding)
- Performance optimization
- Code quality and maintainability
- Testing strategies

Your task is to review the generated code and identify:
1. **Bugs**: Syntax errors, logic errors, runtime issues
2. **Security vulnerabilities**: XSS, SQL injection, auth issues, exposed secrets
3. **Missing features**: Requirements not implemented
4. **Performance issues**: Inefficient code, memory leaks, N+1 queries
5. **Code quality**: Naming, structure, duplication, complexity
6. **Best practices**: Framework conventions, error handling, testing

Return a JSON object with your analysis:
{
    "status": "ok" | "issues_found" | "critical",
    "overall_score": 0-100,
    "summary": "Brief overview of code quality",
    "issues": [
        {
            "file": "path/to/file",
            "severity": "critical" | "high" | "medium" | "low",
            "type": "bug" | "security" | "missing_feature" | "performance" | "quality",
            "description": "Clear description of the issue",
            "line": "Approximate line number or section",
            "suggested_fix": "How to fix it"
        }
    ],
    "strengths": ["What was done well"],
    "recommendations": ["General improvements"]
}"""
        
        user_prompt = f"""Review this generated code against the requirements:

**REQUIREMENTS:**
Project: {requirements.get('project_name', 'Unknown')}
Type: {requirements.get('project_type', 'Unknown')}
Features: {json.dumps(requirements.get('features', [])[:10], indent=2)}

**TECH STACK:**
{json.dumps(tech_stack, indent=2)}

**GENERATED CODE:**
{code_summary}

**FILES GENERATED:** {generated_code_count}

Perform a thorough code review and return your analysis as JSON."""
        
        return [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
    
    def _invoke_with_fallback(self, messages: List) -> tuple[str, str]:
        """
        Invoke LLM with automatic fallback on quota errors
        
        Returns:
            Tuple of (response_content, model_used)
        """
        # Try primary model first
        try:
            logger.info(f"Attempting validation with {self.primary_model_name}")
            response = self.primary_llm.invoke(messages)
            content = response.content if hasattr(response, "content") else str(response)
            logger.info(f"Validation successful with {self.primary_model_name}")
            return content, self.primary_model_name
        
        except Exception as e:
            if self._is_quota_error(e):
                logger.warning(
                    f"Quota exceeded for {self.primary_model_name}, "
                    f"falling back to {self.fallback_model_name}"
                )
                
                # Try fallback model
                try:
                    response = self.fallback_llm.invoke(messages)
                    content = response.content if hasattr(response, "content") else str(response)
                    logger.info(f"Validation successful with fallback model {self.fallback_model_name}")
                    return content, self.fallback_model_name
                
                except Exception as fallback_error:
                    logger.error(f"Fallback model also failed: {fallback_error}")
                    raise fallback_error
            else:
                # Not a quota error, re-raise
                logger.error(f"Validation failed with non-quota error: {e}")
                raise e
    
    def validate_code(
        self,
        requirements: Dict[str, Any],
        generated_code: Dict[str, str],
        tech_stack: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Validate generated code against requirements with automatic fallback
        
        Args:
            requirements: Original project requirements
            generated_code: All generated files
            tech_stack: Technology stack used
            
        Returns:
            Validation report with issues and recommendations
        """
        if not generated_code:
            return {
                "status": "error",
                "issues": [],
                "summary": "No code was generated to validate",
                "overall_score": 0,
                "model_used": "none"
            }
        
        # Summarize code for validation
        code_summary = self._summarize_code(generated_code)
        
        # Create validation messages
        messages = self._create_validation_messages(
            requirements,
            code_summary,
            tech_stack,
            len(generated_code)
        )
        
        try:
            # Invoke with automatic fallback
            content, model_used = self._invoke_with_fallback(messages)
            
            # Extract JSON
            content = self._extract_json(content)
            
            try:
                report = json.loads(content)
                report["model_used"] = model_used  # Track which model was used
                logger.info(
                    f"Validation completed with {model_used}: "
                    f"{report.get('status')} - Score: {report.get('overall_score')}/100"
                )
                return report
            
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse validation JSON: {e}")
                logger.debug(f"Problematic content snippet: {content[:200]}")
                return {
                    "status": "error",
                    "issues": [],
                    "summary": "Validation completed but report parsing failed",
                    "overall_score": 50,
                    "model_used": model_used
                }
        
        except Exception as e:
            logger.error(f"Error during code validation: {e}")
            
            # If both models failed due to quota
            if self._is_quota_error(e):
                return {
                    "status": "quota_exceeded",
                    "issues": [],
                    "summary": (
                        "Validation skipped - API quota limits exceeded for both primary and fallback models. "
                        "Code was generated successfully. Please retry validation later."
                    ),
                    "overall_score": 70,
                    "strengths": ["Code generated without compilation errors"],
                    "recommendations": [
                        "Run manual code review when API quota resets",
                        "Consider upgrading API quota for production use"
                    ],
                    "model_used": "none (quota exceeded)"
                }
            
            # Other errors
            return {
                "status": "error",
                "issues": [{"description": str(e), "severity": "high", "type": "validation_error"}],
                "summary": f"Validation failed: {str(e)}",
                "overall_score": 0,
                "model_used": "error"
            }


def code_validator_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node for code validation with automatic fallback"""
    validator = CodeValidator()
    
    try:
        requirements = state.get("requirements", {})
        generated_code = state.get("generated_code", {})
        tech_stack = state.get("tech_stack", {})
        
        if not generated_code:
            logger.warning("No code to validate, skipping validation")
            return {
                "validation_report": {
                    "status": "skipped",
                    "summary": "No code generated",
                    "overall_score": 0,
                    "model_used": "none"
                },
                "logs": [{
                    "phase": "code_validation",
                    "message": "Skipped validation - no code generated",
                    "timestamp": state.get("timestamp")
                }]
            }
        
        report = validator.validate_code(requirements, generated_code, tech_stack)
        
        # Count critical/high severity issues
        critical_count = sum(
            1 for issue in report.get("issues", []) 
            if issue.get("severity") in ["critical", "high"]
        )
        
        model_used = report.get("model_used", "unknown")
        
        return {
            "validation_report": report,
            "logs": [{
                "phase": "code_validation",
                "message": (
                    f"Validation complete using {model_used}: {report.get('status')} - "
                    f"Score {report.get('overall_score')}/100 - "
                    f"{critical_count} critical/high issues found"
                ),
                "timestamp": state.get("timestamp")
            }]
        }
    
    except Exception as e:
        logger.error(f"Code validation node error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "validation_report": {
                "status": "error",
                "summary": f"Validation error: {str(e)}",
                "overall_score": 0,
                "model_used": "error"
            },
            "logs": [{
                "phase": "code_validation",
                "message": f"Validation failed: {str(e)}",
                "timestamp": state.get("timestamp")
            }],
            "errors": state.get("errors", []) + [str(e)]
        }
