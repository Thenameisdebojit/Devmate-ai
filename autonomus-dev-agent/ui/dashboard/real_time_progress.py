"""
Real-time Progress Tracker
Displays live agent execution status with visual progress indicators.
"""

from rich.live import Live
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
from rich.layout import Layout
from rich.console import Group
from typing import Dict, Any, List
import time
from datetime import datetime

class RealTimeProgressTracker:
    """Real-time visual progress tracker for agent execution"""
    
    def __init__(self):
        """Initialize progress tracker"""
        self.phases = [
            "requirement_analysis",
            "strategic_planning",
            "code_generation",
            "validation",
            "testing",
            "optimization",
            "deployment"
        ]
        self.phase_status = {phase: "pending" for phase in self.phases}
        self.current_phase = None
        self.start_time = time.time()
        self.phase_times = {}
    
    def create_layout(self) -> Layout:
        """Create dashboard layout"""
        layout = Layout()
        
        layout.split_column(
            Layout(name="header", size=3),
            Layout(name="body"),
            Layout(name="footer", size=3)
        )
        
        return layout
    
    def generate_status_table(self) -> Table:
        """Generate status table"""
        table = Table(title="🤖 Agent Execution Status", show_header=True)
        
        table.add_column("Phase", style="cyan")
        table.add_column("Status", justify="center")
        table.add_column("Duration", justify="right")
        
        for phase in self.phases:
            status = self.phase_status.get(phase, "pending")
            
            if status == "completed":
                status_icon = "✓"
                status_style = "green"
            elif status == "running":
                status_icon = "▶"
                status_style = "yellow"
            elif status == "failed":
                status_icon = "✗"
                status_style = "red"
            else:
                status_icon = "○"
                status_style = "dim"
            
            duration = self.phase_times.get(phase, "-")
            if isinstance(duration, float):
                duration = f"{duration:.1f}s"
            
            table.add_row(
                phase.replace("_", " ").title(),
                f"[{status_style}]{status_icon}[/{status_style}]",
                str(duration)
            )
        
        return table
    
    def update_phase(self, phase: str, status: str):
        """Update phase status"""
        if phase in self.phase_status:
            old_status = self.phase_status[phase]
            self.phase_status[phase] = status
            
            if status == "running" and old_status != "running":
                self.phase_times[phase] = time.time()
            elif status == "completed" and phase in self.phase_times:
                elapsed = time.time() - self.phase_times[phase]
                self.phase_times[phase] = elapsed
            
            self.current_phase = phase if status == "running" else self.current_phase
    
    def get_total_elapsed(self) -> str:
        """Get total elapsed time"""
        elapsed = time.time() - self.start_time
        minutes = int(elapsed // 60)
        seconds = int(elapsed % 60)
        return f"{minutes}m {seconds}s"
