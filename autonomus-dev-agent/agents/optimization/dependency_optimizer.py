"""
Dependency Optimizer Agent
Analyzes and optimizes package dependencies, removes unused packages,
suggests lighter alternatives, and minimizes bundle size.
"""

from typing import Dict, Any, List, Set
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from config import CONFIG, FRAMEWORK_CONFIG
import logging
import json
import re

logger = logging.getLogger(__name__)


class DependencyOptimizer:
    """Agent that optimizes project dependencies"""
    
    def __init__(self):
        """Initialize the dependency optimizer"""
        model_config = FRAMEWORK_CONFIG.model_configs["refactor"]
        self.llm = ChatGoogleGenerativeAI(
            model=model_config["model"],
            temperature=0.2,
            max_tokens=model_config["max_tokens"],
            google_api_key=CONFIG.google_api_key,
        )
        logger.info("Dependency Optimizer initialized")
    
    def _extract_dependencies(self, package_json_content: str) -> Dict[str, List[str]]:
        """Extract dependencies from package.json"""
        try:
            package_data = json.loads(package_json_content)
            return {
                "dependencies": list(package_data.get("dependencies", {}).keys()),
                "devDependencies": list(package_data.get("devDependencies", {}).keys())
            }
        except json.JSONDecodeError:
            return {"dependencies": [], "devDependencies": []}
    
    def _find_package_files(self, generated_code: Dict[str, str]) -> Dict[str, str]:
        """Find all package.json files"""
        package_files = {}
        for filepath, content in generated_code.items():
            if filepath.endswith("package.json"):
                package_files[filepath] = content
        return package_files
    
    def analyze_dependencies(
        self,
        generated_code: Dict[str, str],
        tech_stack: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Analyze dependencies for optimization opportunities"""
        
        package_files = self._find_package_files(generated_code)
        
        if not package_files:
            return {
                "status": "no_package_files",
                "unused_dependencies": [],
                "heavy_dependencies": [],
                "alternative_suggestions": [],
                "total_dependencies": 0
            }
        
        # Analyze each package.json
        all_deps = {"dependencies": [], "devDependencies": []}
        for filepath, content in package_files.items():
            deps = self._extract_dependencies(content)
            all_deps["dependencies"].extend(deps["dependencies"])
            all_deps["devDependencies"].extend(deps["devDependencies"])
        
        system_prompt = """You are a dependency optimization expert.

Analyze package dependencies and return a JSON report:
{
    "status": "optimized" | "bloated" | "critical",
    "total_dependencies": 45,
    "total_estimated_size": "15MB",
    "unused_dependencies": [
        {
            "package": "lodash",
            "reason": "Not imported in any file",
            "size": "500KB"
        }
    ],
    "heavy_dependencies": [
        {
            "package": "moment",
            "size": "2.5MB",
            "lighter_alternative": "dayjs (7KB)",
            "migration_difficulty": "easy" | "medium" | "hard"
        }
    ],
    "alternative_suggestions": [
        {
            "current": "axios",
            "alternative": "native fetch",
            "size_savings": "50KB",
            "pros": ["Native", "No extra dependency"],
            "cons": ["Less features"]
        }
    ],
    "duplicate_dependencies": [
        {
            "package": "react",
            "versions": ["17.0.2", "18.2.0"],
            "resolve_to": "18.2.0"
        }
    ],
    "recommendations": [
        "Use tree-shakable imports (import {x} from 'lib' instead of import * as lib)",
        "Replace moment with dayjs to save 2.4MB",
        "Remove unused dependencies"
    ]
}

Focus on:
1. **Unused Dependencies**: Not imported anywhere
2. **Heavy Dependencies**: Large packages with lighter alternatives
3. **Duplicate Dependencies**: Multiple versions of same package
4. **Outdated Dependencies**: Security vulnerabilities
5. **Tree-shaking**: Packages that support partial imports"""
        
        deps_summary = f"""
**DEPENDENCIES:** {', '.join(all_deps['dependencies'][:20])}
**DEV DEPENDENCIES:** {', '.join(all_deps['devDependencies'][:15])}
**TOTAL:** {len(all_deps['dependencies']) + len(all_deps['devDependencies'])} packages
"""
        
        # Get sample of code files to check imports
        code_files_sample = []
        for filepath, content in list(generated_code.items())[:10]:
            if filepath.endswith(('.js', '.jsx', '.ts', '.tsx')):
                imports = re.findall(r'import .+ from [\'"](.+)[\'"]', content)
                code_files_sample.append(f"{filepath}: {', '.join(imports[:5])}")
        
        code_sample = "\n".join(code_files_sample)
        
        user_prompt = f"""Analyze these dependencies for optimization:

{deps_summary}

**CODE IMPORTS (sample):**
{code_sample}

Identify:
1. Unused dependencies (not imported)
2. Heavy packages with lighter alternatives
3. Duplicate or conflicting versions
4. Packages that can be replaced with native features

Return comprehensive dependency analysis as JSON."""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
        
        try:
            response = self.llm.invoke(messages)
            content = getattr(response, "content", str(response))
            
            # Extract JSON
            json_marker = "```" + "json"
            code_fence = "```"
            
            if json_marker in content:
                parts = content.split(json_marker, 1)
                if len(parts) > 1:
                    end_parts = parts.split(code_fence, 1)[1]
                    content = end_parts.strip()
            
            first_brace = content.find('{')
            last_brace = content.rfind('}')
            if first_brace != -1 and last_brace != -1:
                content = content[first_brace:last_brace+1]
            
            try:
                report = json.loads(content)
                logger.info(
                    f"Dependency analysis complete: {report.get('status')} - "
                    f"{len(report.get('unused_dependencies', []))} unused packages found"
                )
                return report
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse dependency report: {e}")
                return {
                    "status": "error",
                    "unused_dependencies": [],
                    "heavy_dependencies": [],
                    "alternative_suggestions": [],
                    "total_dependencies": len(all_deps["dependencies"]) + len(all_deps["devDependencies"])
                }
        
        except Exception as e:
            logger.error(f"Error during dependency analysis: {e}")
            return {
                "status": "error",
                "unused_dependencies": [],
                "heavy_dependencies": [],
                "alternative_suggestions": [],
                "total_dependencies": 0
            }
    
    def optimize_package_json(
        self,
        package_json_content: str,
        dependency_report: Dict[str, Any],
    ) -> str:
        """Generate optimized package.json"""
        
        try:
            package_data = json.loads(package_json_content)
            
            # Remove unused dependencies
            unused_deps = [d["package"] for d in dependency_report.get("unused_dependencies", [])]
            
            if "dependencies" in package_data:
                for dep in unused_deps:
                    if dep in package_data["dependencies"]:
                        del package_data["dependencies"][dep]
                        logger.info(f"Removed unused dependency: {dep}")
            
            if "devDependencies" in package_data:
                for dep in unused_deps:
                    if dep in package_data["devDependencies"]:
                        del package_data["devDependencies"][dep]
                        logger.info(f"Removed unused devDependency: {dep}")
            
            # Return optimized package.json
            return json.dumps(package_data, indent=2)
        
        except Exception as e:
            logger.error(f"Error optimizing package.json: {e}")
            return package_json_content


def dependency_optimizer_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node for dependency optimization"""
    optimizer = DependencyOptimizer()
    
    try:
        generated_code = state.get("generated_code", {})
        tech_stack = state.get("tech_stack", {})
        
        if not generated_code:
            return {
                "dependency_report": {
                    "status": "skipped",
                    "unused_dependencies": []
                },
                "logs": [{
                    "phase": "dependency_optimization",
                    "message": "Skipped dependency optimization - no code generated",
                    "timestamp": state.get("timestamp")
                }]
            }
        
        # Analyze dependencies
        report = optimizer.analyze_dependencies(generated_code, tech_stack)
        
        # Optimize package.json files if needed
        optimized_files = {}
        if report.get("unused_dependencies"):
            package_files = optimizer._find_package_files(generated_code)
            
            for filepath, content in package_files.items():
                optimized_content = optimizer.optimize_package_json(content, report)
                if optimized_content != content:
                    optimized_files[filepath] = optimized_content
        
        # Update generated code
        if optimized_files:
            updated_code = generated_code.copy()
            updated_code.update(optimized_files)
            
            return {
                "generated_code": updated_code,
                "dependency_report": report,
                "logs": [{
                    "phase": "dependency_optimization",
                    "message": f"Dependency optimization complete: {len(report.get('unused_dependencies', []))} packages removed",
                    "timestamp": state.get("timestamp")
                }]
            }
        
        return {
            "dependency_report": report,
            "logs": [{
                "phase": "dependency_optimization",
                "message": f"Dependency analysis complete: {report.get('status')}",
                "timestamp": state.get("timestamp")
            }]
        }
    
    except Exception as e:
        logger.error(f"Dependency optimization node error: {e}")
        return {
            "dependency_report": {
                "status": "error",
                "unused_dependencies": []
            },
            "logs": [{
                "phase": "dependency_optimization",
                "message": f"Dependency optimization failed: {str(e)}",
                "timestamp": state.get("timestamp")
            }],
            "errors": state.get("errors", []) + [str(e)]
        }
