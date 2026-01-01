"""
Backend Code Generation Agent
Generates Node.js/FastAPI backend code using Gemini 2.5 Pro.
"""

from typing import Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from config import CONFIG, FRAMEWORK_CONFIG
import logging
import json
import re
import traceback

logger = logging.getLogger(__name__)


class BackendGenerator:
    """Agent that generates backend code using Gemini 1.5 Pro"""
    
    def __init__(self):
        """Initialize the backend generator with Gemini 2.5 Pro"""
        model_config = FRAMEWORK_CONFIG.model_configs["code"]
        
        # Validate API key
        if not CONFIG.google_api_key:
            raise ValueError("GOOGLE_API_KEY not set. Please set it in your .env file or environment variables.")
        
        try:
            self.llm = ChatGoogleGenerativeAI(
                model=model_config["model"],
                temperature=model_config["temperature"],
                max_tokens=model_config["max_tokens"],
                google_api_key=CONFIG.google_api_key,
                top_p=model_config.get("top_p", 0.9),
            )
            logger.info(f"Backend Generator initialized with {model_config['model']} (Gemini 1.5 Pro)")
        except Exception as e:
            logger.error(f"Failed to initialize Backend Generator: {e}")
            raise
    
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
            # Replace literal newlines, carriage returns, and tabs inside strings
            def fix_string_content(match):
                string_content = match.group(0)
                string_content = string_content.replace('\n', '\\n')
                string_content = string_content.replace('\r', '\\r')
                string_content = string_content.replace('\t', '\\t')
                return string_content
            
            # Find all quoted strings and fix control characters
            content = re.sub(r'"(?:[^"\\]|\\.)*"', fix_string_content, content, flags=re.DOTALL)
            
            # Fix invalid escape sequences
            content = re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', content)
            
        except Exception as e:
            logger.debug(f"Error fixing JSON: {e}")
            content = content.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')
        
        # Step 3: Validate or find JSON object
        try:
            json.loads(content)
            return content
        except json.JSONDecodeError:
            logger.debug("Direct JSON parsing failed, attempting regex extraction")
            json_pattern = r'\{(?:[^{}]|(?:\{[^{}]*\}))*\}'
            matches = re.findall(json_pattern, content, re.DOTALL)
            if matches:
                for match in sorted(matches, key=len, reverse=True):
                    try:
                        json.loads(match)
                        logger.debug("Successfully extracted JSON with regex")
                        return match
                    except json.JSONDecodeError:
                        continue
        
        logger.debug("Could not extract valid JSON, returning cleaned content")
        return content
    
    def generate_code(
        self,
        requirements: Dict[str, Any],
        tech_stack: Dict[str, Any],
        architecture: Dict[str, Any],
    ) -> Dict[str, str]:
        """Generate backend code based on requirements using Gemini 2.5 Pro"""
        
        # Add None checks
        if tech_stack is None:
            tech_stack = {}
        if requirements is None:
            requirements = {}
        if architecture is None:
            architecture = {}
        
        backend_tech = tech_stack.get("backend", {})
        # Ensure backend_tech is a dict
        if not isinstance(backend_tech, dict):
            backend_tech = {"framework": str(backend_tech) if backend_tech else "nodejs-express"}
        
        framework = backend_tech.get("framework", "nodejs-express")
        
        database_tech = tech_stack.get("database", {})
        if not isinstance(database_tech, dict):
            database_tech = {"primary": str(database_tech) if database_tech else "mongodb"}
        
        database = database_tech.get("primary", "mongodb")
        
        # Extract features safely
        features = requirements.get("features", [])
        if isinstance(features, list):
            feature_names = []
            for f in features[:3]:
                if isinstance(f, dict):
                    feature_names.append(f.get("name", str(f)))
                else:
                    feature_names.append(str(f))
            features_str = ", ".join(feature_names)
        else:
            features_str = "basic features"
        
        # Extract user requirements
        user_input = requirements.get('user_input', '')
        project_name = requirements.get('project_name', 'backend')
        project_description = requirements.get('description', '')
        
        # Check for regeneration instructions
        regeneration_instructions = requirements.get("regeneration_instructions", [])
        if regeneration_instructions:
            logger.warning(f"Regeneration requested: {len(regeneration_instructions)} instructions")
            # Add regeneration context to description
            project_description = f"{project_description}\n\n{' '.join(regeneration_instructions)}"
        
        system_prompt = f"""You are an elite {framework} backend developer like Replit Agent 3, generating complete, production-ready APIs.

CRITICAL REQUIREMENTS - MUST FOLLOW (Like Replit Agent 3):
1. Generate COMPLETE, WORKING backend code - NO placeholders, NO TODOs, NO incomplete code, NO "// TODO" comments
2. Include ALL necessary files: package.json, server files, routes, models, middleware, configs, utilities
3. Use modern best practices: proper error handling, validation, security
4. Include database integration with {database} - complete connection, models, queries
5. Include authentication/authorization if needed - complete implementation
6. Include API documentation and setup instructions
7. Make it production-ready with proper environment configuration
8. EVERY file must be COMPLETE and FUNCTIONAL - no partial implementations
9. Generate ALL source code files - DO NOT skip any files needed for the API to run
10. Think iteratively - generate files one by one, ensuring each is complete

MANDATORY FILE REQUIREMENTS (Generate ALL of these):
- backend/package.json: MUST include ALL dependencies with exact versions, scripts (start, dev, test)
- backend/src/server.js or server.ts: MUST be complete server setup with Express/FastAPI, all middleware, error handling
- backend/src/routes/ or backend/src/api/: MUST include ALL API routes with complete CRUD operations
- backend/src/models/: MUST include ALL database models for {database} with complete schemas
- backend/src/middleware/: MUST include authentication, error handling, validation, CORS, security middleware
- backend/src/config/: MUST include database connection, environment config, all settings
- backend/src/utils/: MUST include helper functions, validators, formatters
- backend/src/controllers/: MUST include controllers if using MVC pattern
- backend/.env.example: MUST include ALL environment variables needed
- backend/.gitignore: MUST include proper gitignore
- backend/README.md: MUST include complete setup instructions and API documentation

Output format (ONLY valid JSON, no markdown):
{{
  "backend/package.json": "complete package.json with ALL dependencies",
  "backend/src/server.js": "complete server setup with ALL middleware",
  "backend/src/routes/index.js": "complete routes file",
  "backend/src/routes/api.js": "complete API routes",
  "backend/src/models/...": "ALL model files",
  "backend/src/middleware/auth.js": "complete auth middleware",
  "backend/src/middleware/error.js": "complete error middleware",
  "backend/src/config/database.js": "complete database config",
  "backend/.env.example": "environment variables",
  "backend/README.md": "setup and API documentation"
}}

CRITICAL: 
- Output ONLY the JSON object. No explanations, no markdown code blocks.
- Generate MINIMUM 12-15 files for a complete backend
- Each file must be FULLY IMPLEMENTED with no placeholders
- DO NOT generate only Dockerfiles - generate ALL source code files
- Think like Replit Agent 3 - be thorough, iterative, and complete"""
        
        # Check for regeneration instructions
        regeneration_instructions = requirements.get("regeneration_instructions", [])
        regen_context = ""
        if regeneration_instructions:
            regen_context = "\n\n⚠️ REGENERATION REQUEST:\n" + "\n".join(regeneration_instructions) + "\n\nYou MUST generate MORE files this time. Previous attempt was insufficient."
        
        user_prompt = f"""Generate a COMPLETE, PRODUCTION-READY {framework} backend API based on these requirements:

PROJECT REQUIREMENTS:
{project_description if project_description else user_input}

FRAMEWORK: {framework}
DATABASE: {database}
FEATURES: {features_str}
{regen_context}

CRITICAL: You are generating a COMPLETE, WORKING backend API. Think like Replit Agent 3:
1. Generate ALL source code files needed
2. Each file must be COMPLETE and FUNCTIONAL
3. The API must RUN when user executes: npm install && npm start
4. NO placeholders, NO TODOs, NO incomplete code

MANDATORY FILES TO GENERATE (Generate ALL of these):
1. backend/package.json - Complete with ALL dependencies, exact versions, scripts (start, dev, test)
2. backend/src/server.js or server.ts - Main server file with Express/FastAPI setup, ALL middleware, error handling
3. backend/src/routes/ or backend/src/api/ - ALL API routes with complete CRUD operations
4. backend/src/models/ - ALL database models for {database} with complete schemas and methods
5. backend/src/middleware/ - ALL middleware: authentication, error handling, validation, CORS, security
6. backend/src/config/ - Database connection, environment config, all settings
7. backend/src/utils/ - ALL helper functions, validators, formatters
8. backend/src/controllers/ - Controllers if using MVC pattern
9. backend/.env.example - ALL environment variables needed
10. backend/.gitignore - Proper gitignore
11. backend/README.md - Complete setup instructions and API documentation

ADDITIONAL REQUIREMENTS:
- Include proper error handling middleware - complete implementation
- Include request validation and sanitization - complete validators
- Include CORS configuration - complete setup
- Include rate limiting and security headers - complete middleware
- Include database connection and models - complete connection logic
- Include API endpoints matching the project requirements - ALL endpoints implemented
- Include proper logging - complete logging setup
- Make it production-ready with environment-based configuration

Project name: {project_name}

REMEMBER: Generate ALL source code files. DO NOT skip any files. The API must be COMPLETE and RUNNABLE.
Output ONLY the JSON object with file paths as keys and complete file contents as values."""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
        
        # Retry logic for more reliable generation
        max_retries = 3
        for attempt in range(max_retries):
            try:
                logger.info(f"Backend generation attempt {attempt + 1}/{max_retries}")
                logger.debug(f"Prompt length: {len(user_prompt)} chars, System prompt length: {len(system_prompt)} chars")
                
                # Try to invoke LLM with better error handling
                try:
                    response = self.llm.invoke(messages)
                except Exception as api_error:
                    error_msg = str(api_error)
                    error_type = type(api_error).__name__
                    logger.error(f"LLM API call failed on attempt {attempt + 1}: {error_type}: {error_msg}")
                    
                    # Check for specific error types
                    if "429" in error_msg or "quota" in error_msg.lower() or "rate limit" in error_msg.lower():
                        logger.error("API quota exceeded. Cannot retry - need to wait or use different API key.")
                        raise  # Re-raise to be caught by outer exception handler
                    elif "401" in error_msg or "unauthorized" in error_msg.lower():
                        logger.error("API key invalid or unauthorized.")
                        raise
                    elif "timeout" in error_msg.lower():
                        logger.warning("API timeout, will retry...")
                        if attempt < max_retries - 1:
                            import time
                            time.sleep(5)  # Wait longer for timeout
                            continue
                        raise
                    
                    # For other errors, retry
                    if attempt < max_retries - 1:
                        import time
                        time.sleep(2)
                        continue
                    raise
                
                content = getattr(response, "content", None)
                if content is None:
                    content = str(response)
                content = content or "{}"
                
                # Extract and clean JSON
                content = self._extract_json(content)
                
                if not content or content == "{}":
                    if attempt < max_retries - 1:
                        logger.warning(f"Empty JSON on attempt {attempt + 1}, retrying...")
                        continue
                    logger.error("JSON extraction returned empty object after all retries")
                    return {}
                
                try:
                    code_files = json.loads(content)
                    if isinstance(code_files, dict) and code_files:
                        file_count = len(code_files)
                        logger.info(f"Gemini 1.5 Pro generated {file_count} backend files")
                        
                        # Validate minimum file count
                        if file_count < 5:
                            if attempt < max_retries - 1:
                                logger.warning(f"Only {file_count} files generated, retrying for more complete generation...")
                                # Add more explicit instruction for retry
                                retry_prompt = user_prompt + "\n\nIMPORTANT: You must generate AT LEAST 8-10 complete files. The previous attempt only generated " + str(file_count) + " files. Generate MORE files including all routes, models, middleware, and configuration files."
                                messages = [
                                    SystemMessage(content=system_prompt),
                                    HumanMessage(content=retry_prompt),
                                ]
                                continue
                            else:
                                logger.warning(f"Only {file_count} files generated after all retries, but returning what we have")
                        
                        return code_files
                    logger.warning("Backend response is not a valid dictionary")
                    if attempt < max_retries - 1:
                        continue
                    return {}
                except json.JSONDecodeError as e:
                    logger.warning(f"Failed to parse backend JSON on attempt {attempt + 1}: {e}")
                    logger.debug(f"Raw content: {content[:500]}")
                    if attempt < max_retries - 1:
                        logger.info("Retrying with clearer JSON extraction...")
                        continue
                    return {}
            
            except Exception as e:
                error_msg = str(e)
                error_type = type(e).__name__
                logger.error(f"Error generating backend code on attempt {attempt + 1}: {error_type}: {error_msg}")
                logger.error(f"Full traceback:")
                traceback.print_exc()
                
                # If it's an API error, log more details
                if "429" in error_msg or "quota" in error_msg.lower() or "rate limit" in error_msg.lower():
                    logger.error("API quota/rate limit error detected. Consider using a different API key or waiting.")
                
                if attempt < max_retries - 1:
                    logger.info(f"Retrying after error (attempt {attempt + 2}/{max_retries})...")
                    import time
                    time.sleep(2)  # Brief delay before retry
                    continue
                
                logger.error(f"All {max_retries} attempts failed for backend generation")
                return {}
        
        # If we get here, all retries failed
        logger.error("All backend generation attempts failed")
        return {}


def backend_generator_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node for backend generation using Gemini 2.5 Pro"""
    generator = BackendGenerator()
    
    try:
        # Safely get requirements and ensure it's a dict
        requirements = state.get("requirements", {})
        if not isinstance(requirements, dict):
            requirements = {}
        
        # Ensure user_input is in requirements for the generator
        if 'user_input' not in requirements:
            requirements['user_input'] = state.get('user_input', '')
        if 'description' not in requirements and state.get('user_input'):
            requirements['description'] = state.get('user_input', '')
        
        tech_stack = state.get("tech_stack", {})
        if not isinstance(tech_stack, dict):
            tech_stack = {}
        
        # Ensure backend tech stack is set
        if "backend" not in tech_stack:
            # Try to infer from requirements
            project_type = requirements.get("project_type", "")
            if "express" in str(requirements).lower() or "node" in str(requirements).lower():
                tech_stack["backend"] = {"framework": "nodejs-express"}
            elif "fastapi" in str(requirements).lower():
                tech_stack["backend"] = {"framework": "fastapi"}
            else:
                tech_stack["backend"] = {"framework": "nodejs-express"}  # Default
        
        # Ensure database is set
        if "database" not in tech_stack:
            tech_stack["database"] = {"primary": "mongodb"}  # Default
        
        architecture = state.get("architecture", {})
        if not isinstance(architecture, dict):
            architecture = {}
        
        logger.info(f"Backend generator: requirements={bool(requirements)}, tech_stack={bool(tech_stack)}")
        logger.info(f"User input: {state.get('user_input', '')[:100]}")
        
        code_files = generator.generate_code(
            requirements,
            tech_stack,
            architecture,
        )
        
        generated_code = state.get("generated_code", {})
        if code_files and isinstance(code_files, dict) and not code_files.get("error"):
            generated_code.update(code_files)
            logger.info(f"✓ Backend: Added {len(code_files)} files, total: {len(generated_code)}")
        else:
            logger.warning(f"✗ Backend: No files generated or error occurred")
        
        return {
            "generated_code": generated_code,
            "logs": [
                {
                    "phase": "backend_generation",
                    "message": f"Generated {len(code_files) if code_files else 0} backend files using Gemini 1.5 Pro",
                    "timestamp": state.get("timestamp"),
                }
            ],
        }
    except Exception as e:
        logger.error(f"Backend generation node error: {e}")
        traceback.print_exc()
        return {
            "generated_code": state.get("generated_code", {}),
            "logs": [
                {
                    "phase": "backend_generation",
                    "message": f"Backend generation failed: {str(e)}",
                    "timestamp": state.get("timestamp"),
                }
            ],
            "errors": state.get("errors", []) + [str(e)]
        }
