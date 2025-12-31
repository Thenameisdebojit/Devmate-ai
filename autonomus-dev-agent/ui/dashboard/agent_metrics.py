"""
Agent Metrics Collector
Tracks token usage, latency, and performance metrics for each agent.
"""

from typing import Dict, Any, List, Optional  # ← ADD Optional HERE
from datetime import datetime
import time
import logging

logger = logging.getLogger(__name__)


class AgentMetricsCollector:
    """Collects and aggregates agent performance metrics"""
    
    def __init__(self):
        """Initialize metrics collector"""
        self.metrics = {
            "agents": {},
            "total_tokens": 0,
            "total_latency": 0.0,
            "total_calls": 0,
            "start_time": time.time()
        }
        logger.info("Agent Metrics Collector initialized")
    
    def track_agent_call(
        self,
        agent_name: str,
        tokens_used: int,
        latency_ms: float,
        success: bool,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Track a single agent call"""
        
        if agent_name not in self.metrics["agents"]:
            self.metrics["agents"][agent_name] = {
                "calls": 0,
                "tokens": 0,
                "total_latency": 0.0,
                "successes": 0,
                "failures": 0,
                "avg_latency": 0.0
            }
        
        agent_metrics = self.metrics["agents"][agent_name]
        agent_metrics["calls"] += 1
        agent_metrics["tokens"] += tokens_used
        agent_metrics["total_latency"] += latency_ms
        
        if success:
            agent_metrics["successes"] += 1
        else:
            agent_metrics["failures"] += 1
        
        agent_metrics["avg_latency"] = agent_metrics["total_latency"] / agent_metrics["calls"]
        
        # Update totals
        self.metrics["total_tokens"] += tokens_used
        self.metrics["total_latency"] += latency_ms
        self.metrics["total_calls"] += 1
    
    def get_summary(self) -> Dict[str, Any]:
        """Get metrics summary"""
        
        elapsed = time.time() - self.metrics["start_time"]
        
        return {
            "total_agents": len(self.metrics["agents"]),
            "total_calls": self.metrics["total_calls"],
            "total_tokens": self.metrics["total_tokens"],
            "avg_latency": self.metrics["total_latency"] / self.metrics["total_calls"] if self.metrics["total_calls"] > 0 else 0,
            "elapsed_time": elapsed,
            "agents": self.metrics["agents"]
        }
