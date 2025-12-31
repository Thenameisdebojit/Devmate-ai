"""
Performance Optimizer Agent
Optimizes frontend bundle sizes, implements code splitting, lazy loading,
and generates performance recommendations.
"""

from typing import Dict, Any, List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from config import CONFIG, FRAMEWORK_CONFIG
import logging
import json
import re

logger = logging.getLogger(__name__)


class PerformanceOptimizer:
    """Agent that optimizes code for performance"""
    
    def __init__(self):
        """Initialize the performance optimizer"""
        model_config = FRAMEWORK_CONFIG.model_configs["refactor"]
        self.llm = ChatGoogleGenerativeAI(
            model=model_config["model"],
            temperature=0.2,
            max_tokens=model_config["max_tokens"],
            google_api_key=CONFIG.google_api_key,
        )
        logger.info("Performance Optimizer initialized")
    
    def _extract_json(self, content: str) -> str:
        """Extract JSON from response"""
        if not content:
            return "{}"
        
        json_marker = "```"
        code_fence = "```"
        
        if json_marker in content:
            parts = content.split(json_marker, 1)
            if len(parts) > 1:
                end_parts = parts[1].split(code_fence, 1)
                content = end_parts[0].strip()
        elif code_fence in content:
            parts = content.split(code_fence, 1)
            if len(parts) > 1:
                end_parts = parts[1].split(code_fence, 1)
                content = end_parts[0].strip()
        
        first_brace = content.find('{')
        last_brace = content.rfind('}')
        if first_brace != -1 and last_brace != -1:
            content = content[first_brace:last_brace+1]
        
        return content.strip()
    
    def analyze_performance(
        self,
        generated_code: Dict[str, str],
        tech_stack: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Analyze code for performance issues"""
        
        if not generated_code:
            return {
                "status": "skipped",
                "issues": [],
                "recommendations": [],
                "estimated_bundle_size": 0
            }
        
        frontend_framework = tech_stack.get("frontend", {}).get("framework", "react")
        
        # Identify frontend files
        frontend_files = {}
        for filepath, content in generated_code.items():
            if any(pattern in filepath.lower() for pattern in ["frontend", "src", "component", "page"]):
                if filepath.endswith(('.tsx', '.jsx', '.ts', '.js', '.vue')):
                    frontend_files[filepath] = content[:1000]
        
        if not frontend_files:
            return {
                "status": "no_frontend_files",
                "issues": [],
                "recommendations": [],
                "estimated_bundle_size": 0
            }
        
        system_prompt = f"""You are a frontend performance expert specializing in {frontend_framework}.

Analyze the code and return a JSON performance report:
{{
    "status": "optimized" | "needs_optimization" | "critical",
    "estimated_bundle_size": 500 (in KB),
    "performance_score": 0-100,
    "issues": [
        {{
            "severity": "critical" | "high" | "medium" | "low",
            "type": "bundle_size" | "lazy_loading" | "code_splitting" | "unnecessary_deps" | "render_performance",
            "file": "path/to/file",
            "description": "Issue description",
            "impact": "Impact on performance",
            "fix": "How to optimize"
        }}
    ],
    "recommendations": [
        {{
            "priority": "high" | "medium" | "low",
            "category": "code_splitting" | "lazy_loading" | "tree_shaking" | "caching" | "compression",
            "description": "Recommendation",
            "implementation": "How to implement"
        }}
    ],
    "optimizations": [
        {{
            "file": "path/to/file",
            "optimization": "code splitting" | "lazy loading" | "memoization" | "virtualization",
            "before_size": "50KB",
            "after_size": "25KB",
            "savings": "50%"
        }}
    ]
}}

Focus on:
1. **Bundle Size**: Large dependencies, unused imports
2. **Code Splitting**: Dynamic imports, route-based splitting
3. **Lazy Loading**: Images, components, third-party scripts
4. **Render Performance**: Unnecessary re-renders, memo usage
5. **Tree Shaking**: Dead code elimination
6. **Asset Optimization**: Image compression, font loading
7. **Caching**: Service workers, HTTP caching headers"""
        
        files_summary = "\n".join([
            f"FILE: {fp}\n{content[:400]}..."
            for fp, content in list(frontend_files.items())[:6]
        ])
        
        user_prompt = f"""Analyze performance for this {frontend_framework} application:

{files_summary}

Identify:
1. Bundle size issues (large dependencies)
2. Missing code splitting opportunities
3. Components that should be lazy loaded
4. Render performance issues
5. Unnecessary re-renders

Return comprehensive performance analysis as JSON."""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
        
        try:
            response = self.llm.invoke(messages)
            content = getattr(response, "content", str(response))
            
            content = self._extract_json(content)
            
            try:
                report = json.loads(content)
                logger.info(
                    f"Performance analysis complete: {report.get('status')} - "
                    f"Score: {report.get('performance_score', 0)}/100"
                )
                return report
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse performance report: {e}")
                return {
                    "status": "error",
                    "issues": [],
                    "recommendations": [],
                    "estimated_bundle_size": 0
                }
        
        except Exception as e:
            logger.error(f"Error during performance analysis: {e}")
            return {
                "status": "error",
                "issues": [],
                "recommendations": [],
                "estimated_bundle_size": 0
            }
    
    def generate_optimizations(
        self,
        generated_code: Dict[str, str],
        performance_report: Dict[str, Any],
    ) -> Dict[str, str]:
        """Generate optimized code versions"""
        
        if not performance_report.get("issues"):
            return {}
        
        # Get critical and high priority issues
        critical_issues = [
            i for i in performance_report.get("issues", [])
            if i.get("severity") in ["critical", "high"]
        ]
        
        if not critical_issues:
            return {}
        
        optimized_files = {}
        
        for issue in critical_issues[:5]:  # Limit to top 5 issues
            file_path = issue.get("file")
            if not file_path or file_path not in generated_code:
                continue
            
            original_code = generated_code[file_path]
            
            system_prompt = """You are a performance optimization expert.

Apply the suggested optimization and return ONLY the optimized code.

Do NOT:
- Add explanations
- Use markdown code fences
- Add comments explaining changes

Return the complete optimized code file."""
            
            user_prompt = f"""Optimize this code:

**FILE:** {file_path}
**ISSUE:** {issue.get('description')}
**FIX:** {issue.get('fix')}

**ORIGINAL CODE:**
{original_code}

Apply the performance optimization and return the complete file."""
            
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt),
            ]
            
            try:
                response = self.llm.invoke(messages)
                optimized_code = getattr(response, "content", str(response))
                
                # Remove code fences
                code_fence = "```"
                if code_fence in optimized_code:
                    parts = optimized_code.split(code_fence)
                    if len(parts) >= 3:
                        optimized_code = parts[1]
                        lines = optimized_code.split('\n')
                        if lines.strip() in ['javascript', 'typescript', 'jsx', 'tsx']:
                            optimized_code = '\n'.join(lines[1:])
                
                optimized_files[file_path] = optimized_code.strip()
                logger.info(f"Optimized {file_path}")
            
            except Exception as e:
                logger.error(f"Error optimizing {file_path}: {e}")
        
        return optimized_files


def performance_optimizer_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node for performance optimization"""
    optimizer = PerformanceOptimizer()
    
    try:
        generated_code = state.get("generated_code", {})
        tech_stack = state.get("tech_stack", {})
        
        if not generated_code:
            return {
                "performance_report": {
                    "status": "skipped",
                    "issues": []
                },
                "logs": [{
                    "phase": "performance_optimization",
                    "message": "Skipped performance optimization - no code generated",
                    "timestamp": state.get("timestamp")
                }]
            }
        
        # Analyze performance
        report = optimizer.analyze_performance(generated_code, tech_stack)
        
        # Generate optimizations if needed
        optimized_files = {}
        if report.get("status") == "needs_optimization":
            optimized_files = optimizer.generate_optimizations(generated_code, report)
        
        # Update generated code with optimizations
        if optimized_files:
            updated_code = generated_code.copy()
            updated_code.update(optimized_files)
            
            return {
                "generated_code": updated_code,
                "performance_report": report,
                "performance_optimizations": optimized_files,
                "logs": [{
                    "phase": "performance_optimization",
                    "message": f"Performance optimization complete: {len(optimized_files)} files optimized",
                    "timestamp": state.get("timestamp")
                }]
            }
        
        return {
            "performance_report": report,
            "logs": [{
                "phase": "performance_optimization",
                "message": f"Performance analysis complete: {report.get('status')}",
                "timestamp": state.get("timestamp")
            }]
        }
    
    except Exception as e:
        logger.error(f"Performance optimization node error: {e}")
        return {
            "performance_report": {
                "status": "error",
                "issues": []
            },
            "logs": [{
                "phase": "performance_optimization",
                "message": f"Performance optimization failed: {str(e)}",
                "timestamp": state.get("timestamp")
            }],
            "errors": state.get("errors", []) + [str(e)]
        }
