"""
Performance Profiler
Generates load testing configurations and performance benchmarks.
"""

from typing import Dict, Any, List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from config import CONFIG, FRAMEWORK_CONFIG
import logging
import json

logger = logging.getLogger(__name__)


class PerformanceProfiler:
    """Agent that generates performance testing configurations"""
    
    def __init__(self):
        """Initialize performance profiler"""
        model_config = FRAMEWORK_CONFIG.model_configs["testing"]
        self.llm = ChatGoogleGenerativeAI(
            model=model_config["model"],
            temperature=0.3,
            max_tokens=model_config["max_tokens"],
            google_api_key=CONFIG.google_api_key,
        )
        logger.info("Performance Profiler initialized")
    
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
    
    def generate_load_tests(
        self,
        generated_code: Dict[str, str],
        tech_stack: Dict[str, Any],
    ) -> Dict[str, str]:
        """Generate load testing configurations"""
        
        backend_framework = tech_stack.get("backend", {}).get("framework", "nodejs-express")
        
        # Identify API endpoints
        api_files = {}
        for filepath, content in generated_code.items():
            if any(pattern in filepath.lower() for pattern in ["route", "api", "controller"]):
                api_files[filepath] = content[:500]
        
        if not api_files:
            logger.info("No API endpoints found for load testing")
            return {}
        
        system_prompt = f"""You are a performance testing expert specializing in {backend_framework}.

Generate load testing configurations as a JSON object where:
- Keys are test file paths (e.g., "tests/performance/load-test.yml")
- Values are complete test file contents

Generate configurations for:
1. **Artillery** (Node.js load testing)
2. **Locust** (Python load testing)
3. **K6** (JavaScript load testing)
4. **JMeter** (if applicable)

Include tests for:
- Baseline performance (10 concurrent users)
- Stress testing (100-500 concurrent users)
- Spike testing (sudden traffic increase)
- Endurance testing (sustained load over time)

For each API endpoint, test:
- Response time (should be < 200ms for most requests)
- Throughput (requests per second)
- Error rate (should be < 1%)
- Resource usage (CPU, memory)

Output ONLY valid JSON."""
        
        endpoints_summary = "\n".join([
            f"FILE: {fp}\n{content[:200]}..."
            for fp, content in list(api_files.items())[:5]
        ])
        
        user_prompt = f"""Generate load testing configurations for this {backend_framework} API:

{endpoints_summary}

Create performance test suites with:
1. artillery.yml - Artillery load testing config
2. locustfile.py - Locust load testing script
3. k6-script.js - K6 performance test
4. performance-benchmarks.md - Expected benchmarks

Output as JSON with file paths as keys."""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
        
        try:
            response = self.llm.invoke(messages)
            content = getattr(response, "content", str(response))
            
            content = self._extract_json(content)
            
            try:
                test_files = json.loads(content)
                if isinstance(test_files, dict) and test_files:
                    logger.info(f"Generated {len(test_files)} performance test files")
                    return test_files
                return {}
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse performance test JSON: {e}")
                return {}
        
        except Exception as e:
            logger.error(f"Error generating performance tests: {e}")
            return {}
    
    def generate_benchmark_report(
        self,
        tech_stack: Dict[str, Any],
    ) -> str:
        """Generate expected performance benchmarks"""
        
        frontend_framework = tech_stack.get("frontend", {}).get("framework", "react")
        backend_framework = tech_stack.get("backend", {}).get("framework", "nodejs-express")
        database = tech_stack.get("database", {}).get("primary", "mongodb")
        
        benchmarks = f"""# Performance Benchmarks

## Expected Performance Targets

### Frontend ({frontend_framework})
- **First Contentful Paint (FCP)**: < 1.5s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Time to Interactive (TTI)**: < 3.5s
- **Cumulative Layout Shift (CLS)**: < 0.1
- **First Input Delay (FID)**: < 100ms
- **Bundle Size**: < 300KB (initial load)

### Backend ({backend_framework})
- **Average Response Time**: < 200ms
- **95th Percentile**: < 500ms
- **99th Percentile**: < 1000ms
- **Throughput**: > 1000 req/sec
- **Error Rate**: < 1%

### Database ({database})
- **Query Response Time**: < 50ms (simple queries)
- **Connection Pool**: 10-50 connections
- **Concurrent Queries**: > 100/sec

## Load Testing Scenarios

### Scenario 1: Normal Load
- Users: 50 concurrent
- Duration: 5 minutes
- Expected: 0 errors, < 200ms response time

### Scenario 2: Peak Load
- Users: 200 concurrent
- Duration: 10 minutes
- Expected: < 1% error rate, < 500ms response time

### Scenario 3: Stress Test
- Users: 500 concurrent
- Duration: 5 minutes
- Expected: System remains stable, < 5% error rate

## Monitoring

Use these tools to monitor performance:
- **Frontend**: Lighthouse, WebPageTest
- **Backend**: New Relic, Datadog, Prometheus
- **Database**: MongoDB Atlas, PostgreSQL pgAdmin

## Running Tests
Artillery
artillery run tests/performance/artillery.yml

Locust
locust -f tests/performance/locustfile.py

K6
k6 run tests/performance/k6-script.js
"""
        
        return benchmarks


def performance_profiler_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node for performance profiling"""
    profiler = PerformanceProfiler()
    
    try:
        generated_code = state.get("generated_code", {})
        tech_stack = state.get("tech_stack", {})
        
        if not generated_code:
            return {
                "performance_tests": {},
                "logs": [{
                    "phase": "performance_profiling",
                    "message": "Skipped performance profiling - no code generated",
                    "timestamp": state.get("timestamp")
                }]
            }
        
        # Generate load tests
        load_tests = profiler.generate_load_tests(generated_code, tech_stack)
        
        # Generate benchmark report
        benchmark_report = profiler.generate_benchmark_report(tech_stack)
        load_tests["tests/performance/BENCHMARKS.md"] = benchmark_report
        
        # Add to generated code
        updated_code = generated_code.copy()
        updated_code.update(load_tests)
        
        return {
            "generated_code": updated_code,
            "performance_tests": load_tests,
            "logs": [{
                "phase": "performance_profiling",
                "message": f"Generated {len(load_tests)} performance test files",
                "timestamp": state.get("timestamp")
            }]
        }
    
    except Exception as e:
        logger.error(f"Performance profiling node error: {e}")
        return {
            "performance_tests": {},
            "logs": [{
                "phase": "performance_profiling",
                "message": f"Performance profiling failed: {str(e)}",
                "timestamp": state.get("timestamp")
            }],
            "errors": state.get("errors", []) + [str(e)]
        }

