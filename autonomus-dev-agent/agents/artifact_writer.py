"""
Artifact Writer
Writes generated code and configs to disk in organized structure.
"""

from typing import Dict, Any
from pathlib import Path
import logging
import json

logger = logging.getLogger(__name__)


class ArtifactWriter:
    """Writes all generated artifacts to disk"""
    
    def __init__(self, output_dir: str = "artifacts"):
        """Initialize writer with output directory"""
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Artifact writer initialized: {self.output_dir}")
    
    def write_artifacts(
        self,
        project_id: str,
        generated_code: Dict[str, str],
        docker_config: Dict[str, str],
        k8s_manifests: Dict[str, str],
        validation_report: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Write all artifacts to disk
        
        Returns:
            Dictionary with paths and statistics
        """
        project_dir = self.output_dir / project_id
        project_dir.mkdir(parents=True, exist_ok=True)
        
        stats = {
            "project_dir": str(project_dir),
            "files_written": 0,
            "total_lines": 0,
            "total_bytes": 0
        }
        
        # Write generated code
        for filepath, content in generated_code.items():
            full_path = project_dir / filepath
            full_path.parent.mkdir(parents=True, exist_ok=True)
            
            try:
                # Ensure content is string
                if isinstance(content, dict):
                    content = json.dumps(content, indent=2)
                elif not isinstance(content, str):
                    content = str(content)
                
                full_path.write_text(content, encoding="utf-8")
                stats["files_written"] += 1
                stats["total_lines"] += content.count("\n")
                stats["total_bytes"] += len(content.encode("utf-8"))
                logger.debug(f"Wrote: {filepath}")
            except Exception as e:
                logger.error(f"Failed to write {filepath}: {e}")
        
        # Write Docker configs - FIXED: Handle naming collisions
        for filename, content in docker_config.items():
            # Fix naming collision - if filename is just a service name, add Dockerfile
            if filename in ["frontend", "backend", "mobile"]:
                filepath_to_write = f"{filename}/Dockerfile"
            elif "/" not in filename and not filename.startswith("Dockerfile"):
                # If no path separator and doesn't start with Dockerfile, assume it's a Dockerfile in root
                filepath_to_write = filename if filename.endswith(".yml") or filename.endswith(".yaml") else f"Dockerfile.{filename}"
            else:
                filepath_to_write = filename
            
            full_path = project_dir / filepath_to_write
            full_path.parent.mkdir(parents=True, exist_ok=True)
            
            try:
                # Convert dict to JSON string if needed
                if isinstance(content, dict):
                    content = json.dumps(content, indent=2)
                elif not isinstance(content, str):
                    content = str(content)
                
                full_path.write_text(content, encoding="utf-8")
                stats["files_written"] += 1
                logger.debug(f"Wrote Docker config: {filepath_to_write}")
            except Exception as e:
                logger.error(f"Failed to write Docker config {filepath_to_write}: {e}")
        
        # Write K8s manifests - FIXED: Handle string or dict types
        if k8s_manifests:
            # Handle case where k8s_manifests might be a string instead of dict
            if isinstance(k8s_manifests, str):
                try:
                    k8s_manifests = json.loads(k8s_manifests)
                    logger.debug("Parsed k8s_manifests from JSON string")
                except json.JSONDecodeError:
                    logger.warning(f"K8s manifests is a string but not valid JSON, skipping")
                    k8s_manifests = {}
            
            # Only proceed if we have a valid dict
            if isinstance(k8s_manifests, dict) and k8s_manifests:
                k8s_dir = project_dir / "k8s"
                k8s_dir.mkdir(parents=True, exist_ok=True)
                
                for filename, content in k8s_manifests.items():
                    try:
                        # Convert dict to JSON/YAML string if needed
                        if isinstance(content, dict):
                            content = json.dumps(content, indent=2)
                        elif not isinstance(content, str):
                            content = str(content)
                        
                        (k8s_dir / filename).write_text(content, encoding="utf-8")
                        stats["files_written"] += 1
                        logger.debug(f"Wrote K8s manifest: {filename}")
                    except Exception as e:
                        logger.error(f"Failed to write K8s manifest {filename}: {e}")
            elif k8s_manifests:
                logger.warning(f"K8s manifests has unexpected type: {type(k8s_manifests)}")
        
        # Write validation report
        try:
            report_path = project_dir / "VALIDATION_REPORT.json"
            report_path.write_text(json.dumps(validation_report, indent=2), encoding="utf-8")
            stats["files_written"] += 1
            logger.debug("Wrote validation report")
        except Exception as e:
            logger.error(f"Failed to write validation report: {e}")
        
        # Write README with instructions
        try:
            readme_content = self._generate_readme(validation_report)
            (project_dir / "README.md").write_text(readme_content, encoding="utf-8")
            stats["files_written"] += 1
            logger.debug("Wrote README.md")
        except Exception as e:
            logger.error(f"Failed to write README: {e}")
        
        logger.info(f"Wrote {stats['files_written']} files to {project_dir}")
        return stats
    
    def _generate_readme(self, validation_report: Dict[str, Any]) -> str:
        """Generate README with setup instructions and validation details"""
        score = validation_report.get("overall_score", 0)
        status = validation_report.get("status", "unknown")
        model_used = validation_report.get("model_used", "unknown")
        
        # Create validation badge based on score
        if score >= 80:
            quality_badge = "Excellent"
        elif score >= 60:
            quality_badge = "Good"
        elif score >= 40:
            quality_badge = "Fair"
        else:
            quality_badge = "Needs Improvement"
        
        return f"""# Generated Project

## Validation Status: {status.upper()}
**Quality Score**: {score}/100 ({quality_badge})  
**Validated by**: `{model_used}`

---

## Setup Instructions

### Frontend
cd frontend
npm install
npm run dev

The frontend will be available at `http://localhost:3000`

### Backend
cd backend
npm install
npm start

The backend API will be available at `http://localhost:5000`

### Docker
docker-compose up --build

This will start all services in containerized environments.

### Kubernetes
kubectl apply -f k8s/

Deploy to your Kubernetes cluster.

---

## Validation Report
See `VALIDATION_REPORT.json` for detailed code review, including:
- Security analysis
- Performance recommendations
- Code quality metrics
- Best practice compliance

---

## Project Structure
├── frontend/ # Frontend application
├── backend/ # Backend API
├── k8s/ # Kubernetes manifests
├── Dockerfile # Container configurations
└── docker-compose.yml # Docker Compose setup


---

**Generated by Autonomous Deep AI Agent**  
*Powered by Google Gemini AI*
"""


def artifact_writer_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node for writing artifacts to disk"""
    writer = ArtifactWriter()
    
    try:
        project_id = state.get("project_id", "unknown")
        generated_code = state.get("generated_code", {})
        docker_config = state.get("docker_config", {})
        k8s_manifests = state.get("k8s_manifests", {})
        validation_report = state.get("validation_report", {})
        
        stats = writer.write_artifacts(
            project_id,
            generated_code,
            docker_config,
            k8s_manifests,
            validation_report
        )
        
        return {
            "deployment_status": "artifacts_written",
            "metrics": stats,
            "logs": [{
                "phase": "artifact_writing",
                "message": f"Wrote {stats['files_written']} files to {stats['project_dir']}",
                "timestamp": state.get("timestamp")
            }]
        }
    
    except Exception as e:
        logger.error(f"Artifact writer error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "deployment_status": "write_failed",
            "logs": [{
                "phase": "artifact_writing",
                "message": f"Failed to write artifacts: {str(e)}",
                "timestamp": state.get("timestamp")
            }],
            "errors": state.get("errors", []) + [str(e)]
        }
