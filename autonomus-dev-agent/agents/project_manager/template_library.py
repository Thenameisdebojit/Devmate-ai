"""
Template Library
Manages reusable project templates and boilerplates.
"""

from typing import Dict, Any, List, Optional
from pathlib import Path
import logging
import json
import shutil
from datetime import datetime

logger = logging.getLogger(__name__)


class TemplateLibrary:
    """Manages project templates for quick reuse"""
    
    def __init__(self, templates_dir: str = "memory/templates"):
        """Initialize template library"""
        self.templates_dir = Path(templates_dir)
        self.templates_dir.mkdir(parents=True, exist_ok=True)
        self.templates_index_file = self.templates_dir / "index.json"
        self.templates_index = self._load_index()
        logger.info(f"Template Library initialized: {len(self.templates_index)} templates")
    
    def _load_index(self) -> Dict[str, Any]:
        """Load templates index"""
        if self.templates_index_file.exists():
            try:
                with open(self.templates_index_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Could not load templates index: {e}")
                return {}
        return {}
    
    def _save_index(self):
        """Save templates index"""
        try:
            with open(self.templates_index_file, 'w', encoding='utf-8') as f:
                json.dump(self.templates_index, f, indent=2)
            logger.info(f"Saved templates index: {len(self.templates_index)} templates")
        except Exception as e:
            logger.error(f"Could not save templates index: {e}")
    
    def save_as_template(
        self,
        project_id: str,
        generated_code: Dict[str, str],
        requirements: Dict[str, Any],
        tech_stack: Dict[str, Any],
        template_name: str,
        description: str = ""
    ) -> Dict[str, Any]:
        """Save current project as reusable template"""
        
        template_id = f"template-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        template_path = self.templates_dir / template_id
        template_path.mkdir(parents=True, exist_ok=True)
        
        # Save generated files
        files_saved = 0
        for filepath, content in generated_code.items():
            file_path = template_path / filepath
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            try:
                file_path.write_text(content, encoding='utf-8')
                files_saved += 1
            except Exception as e:
                logger.warning(f"Could not save template file {filepath}: {e}")
        
        # Save metadata
        metadata = {
            "template_id": template_id,
            "template_name": template_name,
            "description": description,
            "created_at": datetime.now().isoformat(),
            "source_project": project_id,
            "tech_stack": tech_stack,
            "requirements": requirements,
            "files_count": files_saved,
            "usage_count": 0
        }
        
        metadata_file = template_path / "template.json"
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)
        
        # Update index
        self.templates_index[template_id] = {
            "name": template_name,
            "description": description,
            "tech_stack": tech_stack,
            "created_at": metadata["created_at"],
            "files_count": files_saved
        }
        self._save_index()
        
        logger.info(f"Saved template '{template_name}' with {files_saved} files")
        
        return {
            "success": True,
            "template_id": template_id,
            "files_saved": files_saved,
            "template_path": str(template_path)
        }
    
    def load_template(self, template_id: str) -> Optional[Dict[str, Any]]:
        """Load a template by ID"""
        
        template_path = self.templates_dir / template_id
        
        if not template_path.exists():
            logger.warning(f"Template {template_id} not found")
            return None
        
        metadata_file = template_path / "template.json"
        if not metadata_file.exists():
            logger.warning(f"Template metadata not found for {template_id}")
            return None
        
        try:
            with open(metadata_file, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
            
            # Load all template files
            template_files = {}
            for file_path in template_path.rglob('*'):
                if file_path.is_file() and file_path.name != 'template.json':
                    relative_path = file_path.relative_to(template_path)
                    try:
                        content = file_path.read_text(encoding='utf-8')
                        template_files[str(relative_path)] = content
                    except Exception as e:
                        logger.warning(f"Could not read template file {relative_path}: {e}")
            
            # Update usage count
            metadata["usage_count"] = metadata.get("usage_count", 0) + 1
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2)
            
            logger.info(f"Loaded template '{metadata['template_name']}' with {len(template_files)} files")
            
            return {
                "metadata": metadata,
                "files": template_files
            }
        
        except Exception as e:
            logger.error(f"Error loading template {template_id}: {e}")
            return None
    
    def list_templates(self) -> List[Dict[str, Any]]:
        """List all available templates"""
        
        templates = []
        for template_id, info in self.templates_index.items():
            templates.append({
                "template_id": template_id,
                **info
            })
        
        # Sort by creation date (newest first)
        templates.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return templates
    
    def delete_template(self, template_id: str) -> bool:
        """Delete a template"""
        
        template_path = self.templates_dir / template_id
        
        if not template_path.exists():
            logger.warning(f"Template {template_id} not found")
            return False
        
        try:
            shutil.rmtree(template_path)
            
            if template_id in self.templates_index:
                del self.templates_index[template_id]
                self._save_index()
            
            logger.info(f"Deleted template {template_id}")
            return True
        
        except Exception as e:
            logger.error(f"Error deleting template {template_id}: {e}")
            return False
    
    def get_template_by_tech_stack(
        self,
        frontend: Optional[str] = None,
        backend: Optional[str] = None,
        database: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Find templates matching tech stack"""
        
        matching_templates = []
        
        for template_id, info in self.templates_index.items():
            tech_stack = info.get("tech_stack", {})
            
            match = True
            
            if frontend:
                template_frontend = tech_stack.get("frontend", {}).get("framework", "")
                if frontend.lower() not in template_frontend.lower():
                    match = False
            
            if backend:
                template_backend = tech_stack.get("backend", {}).get("framework", "")
                if backend.lower() not in template_backend.lower():
                    match = False
            
            if database:
                template_database = tech_stack.get("database", {}).get("primary", "")
                if database.lower() not in template_database.lower():
                    match = False
            
            if match:
                matching_templates.append({
                    "template_id": template_id,
                    **info
                })
        
        return matching_templates


def template_library_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node for template library operations"""
    
    config = state.get("config", {})
    if not config.get("enable_templates", False):
        return {
            "template_saved": False,
            "logs": [{
                "phase": "template_library",
                "message": "Template library disabled",
                "timestamp": state.get("timestamp")
            }]
        }
    
    library = TemplateLibrary()
    
    try:
        # Check if we should save this project as a template
        should_save_template = config.get("save_as_template", False)
        
        if should_save_template:
            project_id = state.get("project_id", "unknown")
            generated_code = state.get("generated_code", {})
            requirements = state.get("requirements", {})
            tech_stack = state.get("tech_stack", {})
            
            template_name = config.get("template_name", requirements.get("project_name", "unnamed"))
            description = config.get("template_description", "Auto-generated template")
            
            result = library.save_as_template(
                project_id,
                generated_code,
                requirements,
                tech_stack,
                template_name,
                description
            )
            
            return {
                "template_saved": result["success"],
                "template_id": result.get("template_id"),
                "logs": [{
                    "phase": "template_library",
                    "message": f"Saved as template '{template_name}' with {result['files_saved']} files",
                    "timestamp": state.get("timestamp")
                }]
            }
        
        return {
            "template_saved": False,
            "logs": [{
                "phase": "template_library",
                "message": "Template save not requested",
                "timestamp": state.get("timestamp")
            }]
        }
    
    except Exception as e:
        logger.error(f"Template library node error: {e}")
        return {
            "template_saved": False,
            "logs": [{
                "phase": "template_library",
                "message": f"Template library operation failed: {str(e)}",
                "timestamp": state.get("timestamp")
            }],
            "errors": state.get("errors", []) + [str(e)]
        }
