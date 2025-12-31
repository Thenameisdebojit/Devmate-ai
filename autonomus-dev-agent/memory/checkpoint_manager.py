"""
Checkpoint Manager
Saves and restores workflow state at each step for recovery.
"""

from typing import Dict, Any, Optional
from pathlib import Path
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class CheckpointManager:
    """Manages workflow checkpoints for state recovery"""
    
    def __init__(self, checkpoint_dir: str = "memory/checkpoints"):
        """Initialize checkpoint manager"""
        self.checkpoint_dir = Path(checkpoint_dir)
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Checkpoint Manager initialized: {self.checkpoint_dir}")
    
    def save_checkpoint(
        self,
        project_id: str,
        step_name: str,
        state: Dict[str, Any]
    ) -> bool:
        """
        Save a checkpoint for a specific step
        
        Args:
            project_id: Unique project identifier
            step_name: Name of the workflow step
            state: Current state to save
            
        Returns:
            True if successful, False otherwise
        """
        try:
            project_dir = self.checkpoint_dir / project_id
            project_dir.mkdir(parents=True, exist_ok=True)
            
            checkpoint_file = project_dir / f"{step_name}.json"
            
            # Create checkpoint data
            checkpoint_data = {
                "project_id": project_id,
                "step_name": step_name,
                "timestamp": datetime.now().isoformat(),
                "state": state
            }
            
            # Save to file
            with open(checkpoint_file, 'w', encoding='utf-8') as f:
                json.dump(checkpoint_data, f, indent=2, default=str)
            
            logger.info(f"Saved checkpoint: {project_id}/{step_name}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to save checkpoint {project_id}/{step_name}: {e}")
            return False
    
    def load_checkpoint(
        self,
        project_id: str,
        step_name: str
    ) -> Optional[Dict[str, Any]]:
        """
        Load a checkpoint for a specific step
        
        Args:
            project_id: Unique project identifier
            step_name: Name of the workflow step
            
        Returns:
            Checkpoint data if found, None otherwise
        """
        try:
            checkpoint_file = self.checkpoint_dir / project_id / f"{step_name}.json"
            
            if not checkpoint_file.exists():
                logger.warning(f"Checkpoint not found: {project_id}/{step_name}")
                return None
            
            with open(checkpoint_file, 'r', encoding='utf-8') as f:
                checkpoint_data = json.load(f)
            
            logger.info(f"Loaded checkpoint: {project_id}/{step_name}")
            return checkpoint_data
        
        except Exception as e:
            logger.error(f"Failed to load checkpoint {project_id}/{step_name}: {e}")
            return None
    
    def list_checkpoints(self, project_id: str) -> list:
        """
        List all checkpoints for a project
        
        Args:
            project_id: Unique project identifier
            
        Returns:
            List of checkpoint step names
        """
        project_dir = self.checkpoint_dir / project_id
        
        if not project_dir.exists():
            return []
        
        checkpoints = []
        for checkpoint_file in project_dir.glob("*.json"):
            checkpoints.append(checkpoint_file.stem)
        
        return sorted(checkpoints)
    
    def get_latest_checkpoint(self, project_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the most recent checkpoint for a project
        
        Args:
            project_id: Unique project identifier
            
        Returns:
            Latest checkpoint data if found, None otherwise
        """
        checkpoints = self.list_checkpoints(project_id)
        
        if not checkpoints:
            return None
        
        # Load the last checkpoint
        return self.load_checkpoint(project_id, checkpoints[-1])
    
    def delete_checkpoints(self, project_id: str) -> bool:
        """
        Delete all checkpoints for a project
        
        Args:
            project_id: Unique project identifier
            
        Returns:
            True if successful, False otherwise
        """
        try:
            project_dir = self.checkpoint_dir / project_id
            
            if not project_dir.exists():
                return True
            
            import shutil
            shutil.rmtree(project_dir)
            
            logger.info(f"Deleted checkpoints for project: {project_id}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to delete checkpoints for {project_id}: {e}")
            return False
