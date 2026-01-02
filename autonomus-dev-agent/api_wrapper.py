"""
API Wrapper for Autonomous Dev Agent
Called from Next.js API routes to generate projects

WORKSPACE-AWARE AGENT ARCHITECTURE:
- This wrapper integrates with the workspace-aware agent foundation
- Supports tool calls and checkpoint integration
- Provides Python agent backend for the Agent Orchestrator abstraction

TECH STACK ASSUMPTIONS:
- Backend: Python agent with LangGraph workflow
- Runtime: Container-per-project model (interface only, implementation deferred)
- Integration: Works with Next.js Agent Orchestrator abstraction layer
"""

import sys
import json
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from agents.orchestrator import orchestrator


def generate_project_api(prompt: str, project_id: str = None, checkpoint_id: str = None):
    """
    Generate project and return structured data for API
    
    WORKSPACE-AWARE INTEGRATION:
    - This function integrates with the Next.js Agent Orchestrator abstraction
    - Project ID and checkpoint ID can be provided from the workspace context
    - Generated files are traceable through the workspace context manager
    
    Args:
        prompt: User request for project generation
        project_id: Optional workspace project ID (from WorkspaceContextManager)
        checkpoint_id: Optional checkpoint ID (from AgentOrchestrator)
    
    Returns:
        dict with project files and metadata, including workspace metadata
    """
    import sys
    import time
    
    project_files = {}
    project_id = None
    framework = "Unknown"
    description = prompt[:100] + "..." if len(prompt) > 100 else prompt
    final_state = None
    
    # Track generation steps
    steps = []
    current_step = 0
    start_time = time.time()
    max_duration = 600  # 10 minutes max (increased for complex tasks and industrial-grade performance)
    
    try:
        # Track project_id from metrics in finalization event
        last_project_dir = None
        event_count = 0
        
        # Print progress to stderr so it doesn't interfere with JSON output
        print("Starting project generation...", file=sys.stderr)
        
        for event in orchestrator.generate_project(prompt, debug_mode=False):
            # Check timeout
            elapsed = time.time() - start_time
            if elapsed > max_duration:
                print(f"ERROR: Generation timeout after {max_duration} seconds. Last node: {last_node if 'last_node' in locals() else 'unknown'}", file=sys.stderr)
                sys.stderr.flush()
                raise Exception(f"Generation timeout after {max_duration} seconds. Last node: {last_node if 'last_node' in locals() else 'unknown'}")
            
            event_count += 1
            node = event.get("node", "")
            status = event.get("status", "")
            last_node = node
            
            # Print progress to stderr
            if event_count % 5 == 0:  # Print every 5 events to avoid spam
                elapsed = time.time() - start_time
                print(f"Progress: {node} - {status} ({event_count} events, {elapsed:.1f}s)", file=sys.stderr)
                sys.stderr.flush()
            
            # Check for errors
            if node == "error":
                error_msg = event.get("error", "Unknown error")
                print(f"ERROR: {error_msg}", file=sys.stderr)
                sys.stderr.flush()
                raise Exception(f"Generation error: {error_msg}")
            
            # Track progress
            if node and node != "error" and node != "cancellation":
                current_step += 1
                steps.append({
                    "step": current_step,
                    "node": node,
                    "status": status
                })
            
            # Extract project_id from finalization metrics
            if node == "finalization" and status == "completed":
                metrics = event.get("metrics", {})
                if metrics and "project_id" in metrics:
                    project_id = metrics["project_id"]
                    final_state = event.get("data", {})
            
            # Also check artifact_writer node for project directory info
            if node == "artifact_writer" and status == "completed":
                data = event.get("data", {})
                if isinstance(data, dict):
                    metrics_data = data.get("metrics", {})
                    if metrics_data and "project_dir" in metrics_data:
                        last_project_dir = metrics_data["project_dir"]
            
            # Handle errors
            if node == "error":
                error_msg = event.get("error", "Unknown error")
                raise Exception(f"Generation error: {error_msg}")
        
        print(f"Generation completed: {event_count} events processed", file=sys.stderr)
        
        # Get files from artifacts directory (most reliable way)
        script_dir = Path(__file__).parent
        artifacts_dir = script_dir / "artifacts"
        
        # Read files from artifacts directory
        if artifacts_dir.exists():
            project_dir = None
            
            # Try to use the project_dir from artifact_writer first
            if last_project_dir:
                project_dir = Path(last_project_dir)
                if not project_dir.exists():
                    project_dir = None
            
            # If not found, try using project_id
            if not project_dir and project_id:
                project_dir = artifacts_dir / project_id
                if not project_dir.exists():
                    project_dir = None
            
            # Fallback: use most recently modified project directory
            if not project_dir:
                project_dirs = [d for d in artifacts_dir.iterdir() if d.is_dir()]
                if project_dirs:
                    project_dirs.sort(key=lambda x: x.stat().st_mtime, reverse=True)
                    project_dir = project_dirs[0]
                    project_id = project_dir.name
            
            if project_dir and project_dir.exists():
                # Read all files from the project directory
                for file_path in project_dir.rglob("*"):
                    if file_path.is_file():
                        relative_path = file_path.relative_to(project_dir)
                        # Skip certain files that shouldn't be included
                        skip_patterns = ['__pycache__', '.pyc', '.git', 'node_modules', '.next', '.env']
                        if any(pattern in str(relative_path) for pattern in skip_patterns):
                            continue
                        try:
                            content = file_path.read_text(encoding="utf-8")
                            project_files[str(relative_path)] = content
                        except (UnicodeDecodeError, Exception) as e:
                            # Skip binary files or files that can't be read as text
                            pass
        
        # Extract framework from prompt or files
        if "next" in prompt.lower() or "nextjs" in prompt.lower() or any("next" in f.lower() for f in project_files.keys()):
            framework = "Next.js"
        elif "react" in prompt.lower() or any("react" in f.lower() for f in project_files.keys()):
            framework = "React"
        elif "vue" in prompt.lower():
            framework = "Vue.js"
        elif "angular" in prompt.lower():
            framework = "Angular"
        elif "express" in prompt.lower() or "node" in prompt.lower():
            framework = "Express.js"
        elif "flask" in prompt.lower() or "python" in prompt.lower():
            framework = "Flask"
        elif "fastapi" in prompt.lower():
            framework = "FastAPI"
        
        # Check if we have any files
        if not project_files:
            print("WARNING: No files found in artifacts directory", file=sys.stderr)
            print(f"Artifacts dir: {artifacts_dir}", file=sys.stderr)
            if artifacts_dir.exists():
                print(f"Artifacts dir contents: {list(artifacts_dir.iterdir())}", file=sys.stderr)
            return {
                "success": False,
                "error": "No files were generated. The project may have failed during generation. Check the logs for more details.",
                "steps": steps,
                "debug_info": {
                    "artifacts_dir": str(artifacts_dir),
                    "artifacts_exists": artifacts_dir.exists(),
                    "project_id": project_id,
                    "last_project_dir": str(last_project_dir) if last_project_dir else None
                }
            }
        
        # Generate setup instructions
        setup_instructions = generate_setup_instructions(framework, project_files)
        
        # Ensure project name is valid
        project_name = project_id or "generated-project"
        # Clean project name (remove invalid characters)
        project_name = "".join(c for c in project_name if c.isalnum() or c in ('-', '_')).strip()
        if not project_name:
            project_name = "generated-project"
        
        return {
            "success": True,
            "projectName": project_name,
            "framework": framework,
            "description": description,
            "files": [{"path": path, "content": content} for path, content in project_files.items()],
            "setupInstructions": setup_instructions,
            "steps": steps
        }
    
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        return {
            "success": False,
            "error": f"{str(e)}\n\nTraceback:\n{error_trace}",
            "steps": steps
        }


def generate_setup_instructions(framework: str, files: dict) -> str:
    """Generate setup instructions based on framework"""
    
    if framework == "Next.js":
        return """# Setup Instructions

1. Install dependencies:
   npm install

2. Run development server:
   npm run dev

3. Build for production:
   npm run build

4. Start production server:
   npm start
"""
    elif framework in ["React", "React + Vite"]:
        return """# Setup Instructions

1. Install dependencies:
   npm install

2. Run development server:
   npm run dev

3. Build for production:
   npm run build
"""
    elif framework == "Express.js":
        return """# Setup Instructions

1. Install dependencies:
   npm install

2. Set up environment variables (create .env file):
   PORT=5000
   NODE_ENV=development

3. Run development server:
   npm run dev

4. Start production server:
   npm start
"""
    elif framework == "Flask":
        return """# Setup Instructions

1. Create virtual environment:
   python -m venv venv

2. Activate virtual environment:
   # On Windows:
   venv\\Scripts\\activate
   # On macOS/Linux:
   source venv/bin/activate

3. Install dependencies:
   pip install -r requirements.txt

4. Run development server:
   python app.py
"""
    elif framework == "FastAPI":
        return """# Setup Instructions

1. Create virtual environment:
   python -m venv venv

2. Activate virtual environment:
   # On Windows:
   venv\\Scripts\\activate
   # On macOS/Linux:
   source venv/bin/activate

3. Install dependencies:
   pip install -r requirements.txt

4. Run development server:
   uvicorn main:app --reload
"""
    else:
        return """# Setup Instructions

Please check the README.md file in the project for specific setup instructions.
"""


if __name__ == "__main__":
    # Read prompt from stdin or first argument
    if len(sys.argv) > 1:
        prompt = sys.argv[1]
    else:
        prompt = sys.stdin.read()
    
    result = generate_project_api(prompt)
    print(json.dumps(result, indent=2))

