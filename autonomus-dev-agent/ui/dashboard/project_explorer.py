"""
Project Explorer
Interactive file browser for generated projects.
"""

from pathlib import Path
from typing import List, Dict, Any
from rich.tree import Tree
from rich.console import Console
import logging

logger = logging.getLogger(__name__)
console = Console()


class ProjectExplorer:
    """Interactive project file explorer"""
    
    def __init__(self, project_path: Path):
        """Initialize project explorer"""
        self.project_path = project_path
        logger.info(f"Project Explorer initialized: {project_path}")
    
    def generate_tree(self, max_depth: int = 4) -> Tree:
        """Generate file tree visualization"""
        
        tree = Tree(f"📁 {self.project_path.name}", guide_style="dim")
        
        self._add_to_tree(tree, self.project_path, max_depth, 0)
        
        return tree
    
    def _add_to_tree(self, tree: Tree, path: Path, max_depth: int, current_depth: int):
        """Recursively add files to tree"""
        
        if current_depth >= max_depth:
            return
        
        try:
            items = sorted(path.iterdir(), key=lambda x: (x.is_file(), x.name))
            
            for item in items:
                # Skip hidden files and common excludes
                if item.name.startswith('.') or item.name in ['node_modules', '__pycache__', 'venv']:
                    continue
                
                if item.is_file():
                    icon = self._get_file_icon(item.suffix)
                    branch = tree.add(f"{icon} {item.name}")
                else:
                    branch = tree.add(f"📁 {item.name}")
                    self._add_to_tree(branch, item, max_depth, current_depth + 1)
        
        except PermissionError:
            pass
    
    def _get_file_icon(self, extension: str) -> str:
        """Get icon for file type"""
        
        icons = {
            '.py': '🐍',
            '.js': '📜',
            '.ts': '📘',
            '.tsx': '⚛️',
            '.jsx': '⚛️',
            '.json': '📋',
            '.md': '📝',
            '.yml': '⚙️',
            '.yaml': '⚙️',
            '.html': '🌐',
            '.css': '🎨',
            '.env': '🔐',
        }
        
        return icons.get(extension.lower(), '📄')
    
    def display_tree(self):
        """Display the project tree"""
        tree = self.generate_tree()
        console.print(tree)
