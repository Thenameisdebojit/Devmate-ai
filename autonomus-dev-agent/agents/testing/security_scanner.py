"""
Security Scanner Agent
Performs static security analysis on generated code.
"""

from typing import Dict, Any, List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from config import CONFIG, FRAMEWORK_CONFIG
import logging
import json
import re

logger = logging.getLogger(__name__)


class SecurityScanner:
    """Agent that scans code for security vulnerabilities"""
    
    def __init__(self):
        """Initialize the security scanner"""
        model_config = FRAMEWORK_CONFIG.model_configs["validation"]
        self.llm = ChatGoogleGenerativeAI(
            model=model_config["model"],
            temperature=0.2,  # Low temperature for consistent security analysis
            max_tokens=model_config["max_tokens"],
            google_api_key=CONFIG.google_api_key,
        )
        logger.info("Security Scanner initialized")
    
    def scan_code(
        self,
        generated_code: Dict[str, str],
        tech_stack: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Scan code for security vulnerabilities"""
        
        if not generated_code:
            return {
                "status": "skipped",
                "vulnerabilities": [],
                "risk_score": 0,
                "summary": "No code to scan"
            }
        
        # Summarize code for analysis
        code_summary = []
        for filepath, content in list(generated_code.items())[:10]:
            if any(pattern in filepath.lower() for pattern in ["route", "api", "auth", "model", "service"]):
                code_summary.append(f"FILE: {filepath}\n{content[:500]}")
        
        if not code_summary:
            return {
                "status": "skipped",
                "vulnerabilities": [],
                "risk_score": 0,
                "summary": "No security-sensitive files found"
            }
        
        system_prompt = """You are a security expert specializing in OWASP Top 10 and secure coding practices.

Analyze the code for security vulnerabilities and return a JSON report:
{
    "status": "safe" | "warnings" | "critical",
    "risk_score": 0-100,
    "summary": "Brief security assessment",
    "vulnerabilities": [
        {
            "severity": "critical" | "high" | "medium" | "low",
            "type": "SQL Injection" | "XSS" | "Authentication" | "Authorization" | "CSRF" | "Secrets Exposure" | etc,
            "file": "path/to/file",
            "description": "Detailed vulnerability description",
            "recommendation": "How to fix it",
            "cwe_id": "CWE-XXX"
        }
    ],
    "best_practices": ["Security recommendations"]
}

Focus on:
- SQL/NoSQL injection
- XSS vulnerabilities
- Hardcoded secrets/credentials
- Weak authentication
- Missing authorization checks
- CSRF protection
- Insecure dependencies
- Sensitive data exposure"""
        
        user_prompt = f"""Perform security analysis on this code:

{chr(10).join(code_summary[:5])}

Technology stack:
{json.dumps(tech_stack, indent=2)}

Return a comprehensive security report as JSON."""
        
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
            
            try:
                report = json.loads(content)
                critical_count = sum(1 for v in report.get("vulnerabilities", []) if v.get("severity") == "critical")
                logger.info(f"Security scan complete: {report.get('status')} - {critical_count} critical issues")
                return report
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse security report: {e}")
                return {
                    "status": "error",
                    "vulnerabilities": [],
                    "risk_score": 0,
                    "summary": "Security scan completed but report parsing failed"
                }
        
        except Exception as e:
            logger.error(f"Error during security scan: {e}")
            return {
                "status": "error",
                "vulnerabilities": [],
                "risk_score": 0,
                "summary": f"Security scan failed: {str(e)}"
            }


def security_scanner_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node for security scanning"""
    scanner = SecurityScanner()
    
    try:
        generated_code = state.get("generated_code", {})
        tech_stack = state.get("tech_stack", {})
        
        if not generated_code:
            return {
                "security_report": {
                    "status": "skipped",
                    "vulnerabilities": [],
                    "risk_score": 0
                },
                "logs": [{
                    "phase": "security_scan",
                    "message": "Skipped security scan - no code generated",
                    "timestamp": state.get("timestamp")
                }]
            }
        
        report = scanner.scan_code(generated_code, tech_stack)
        
        vuln_count = len(report.get("vulnerabilities", []))
        critical_count = sum(1 for v in report.get("vulnerabilities", []) if v.get("severity") == "critical")
        
        return {
            "security_report": report,
            "logs": [{
                "phase": "security_scan",
                "message": f"Security scan complete: {report.get('status')} - {vuln_count} issues ({critical_count} critical)",
                "timestamp": state.get("timestamp")
            }]
        }
    
    except Exception as e:
        logger.error(f"Security scan node error: {e}")
        return {
            "security_report": {
                "status": "error",
                "vulnerabilities": [],
                "risk_score": 0
            },
            "logs": [{
                "phase": "security_scan",
                "message": f"Security scan failed: {str(e)}",
                "timestamp": state.get("timestamp")
            }],
            "errors": state.get("errors", []) + [str(e)]
        }
