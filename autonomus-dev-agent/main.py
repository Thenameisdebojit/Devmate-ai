"""
Main entry point for the Autonomous Deep AI Agent - Complete Phase 4
"""

from agents.orchestrator import orchestrator
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
from rich.table import Table
from rich import box
from rich.layout import Layout
import sys
from datetime import datetime

console = Console()


def display_banner():
    """Display startup banner"""
    banner = """
╭──────────────────────────────────────────────────────────────╮
│ 🤖 Autonomous Deep AI Agent v2.0                             │
│ Generate complete applications from natural language          │
│                                                               │
│ [Phase 4 Complete: Production-Grade Intelligence]            │
│ ✓ Testing & QA  ✓ Optimization  ✓ Human Oversight           │
│ ✓ Git Integration  ✓ Auto-Deploy  ✓ Templates               │
╰──────────────────────────────────────────────────────────────╯
"""
    console.print(banner, style="bold cyan")


def display_final_metrics(metrics: dict):
    """Display comprehensive final project metrics"""
    
    layout = Layout()
    layout.split_column(
        Layout(name="header", size=3),
        Layout(name="main"),
        Layout(name="footer", size=3)
    )
    
    # Header
    layout["header"].update(
        Panel(
            f"[bold cyan]Project: {metrics.get('project_id', 'unknown')}[/bold cyan]",
            style="cyan"
        )
    )
    
    # Main metrics table
    table = Table(title="📊 Complete Project Metrics", box=box.DOUBLE, show_header=True)
    table.add_column("Category", style="cyan", no_wrap=True)
    table.add_column("Metric", style="yellow")
    table.add_column("Value", style="green", justify="right")
    
    # Code Generation
    table.add_row(
        "📝 Code Generation",
        "Files Generated",
        str(metrics.get("files_generated", 0))
    )
    
    # Testing
    table.add_row(
        "🧪 Testing",
        "Unit Tests",
        str(metrics.get("tests_generated", 0))
    )
    
    integration_stats = metrics.get("integration_test_stats", {})
    if integration_stats.get("total", 0) > 0:
        table.add_row(
            "",
            "Integration Tests",
            str(integration_stats.get("total", 0))
        )
        table.add_row(
            "",
            "  ├─ API Tests",
            str(integration_stats.get("api_tests", 0))
        )
        table.add_row(
            "",
            "  ├─ Component Tests",
            str(integration_stats.get("component_tests", 0))
        )
        table.add_row(
            "",
            "  └─ E2E Tests",
            str(integration_stats.get("e2e_tests", 0))
        )
    
    if metrics.get("performance_tests_generated", 0) > 0:
        table.add_row(
            "",
            "Performance Tests",
            str(metrics.get("performance_tests_generated", 0))
        )
    
    # Quality Scores
    validation_score = metrics.get("validation_score", 0)
    security_risk = metrics.get("security_risk", 0)
    performance_score = metrics.get("performance_score", 0)
    quality_score = metrics.get("quality_score", 0)
    completeness_score = metrics.get("completeness_score", 0)
    
    table.add_row(
        "⭐ Quality",
        "Validation Score",
        f"{validation_score}/100"
    )
    table.add_row(
        "",
        "Security Risk",
        f"{security_risk}/100"
    )
    if performance_score > 0:
        table.add_row(
            "",
            "Performance Score",
            f"{performance_score}/100"
        )
    table.add_row(
        "",
        "Overall Quality",
        f"{quality_score}"
    )
    table.add_row(
        "",
        "Completeness",
        f"{completeness_score}"
    )
    
    # Issues
    issues_found = metrics.get("issues_found", 0)
    critical_issues = metrics.get("critical_issues", 0)
    vulnerabilities = metrics.get("vulnerabilities_found", 0)
    critical_vulns = metrics.get("critical_vulnerabilities", 0)
    
    table.add_row(
        "🔍 Issues",
        "Code Issues",
        f"{issues_found} ({critical_issues} critical)"
    )
    table.add_row(
        "",
        "Vulnerabilities",
        f"{vulnerabilities} ({critical_vulns} critical)"
    )
    
    # Optimization
    if metrics.get("refactored", False):
        table.add_row(
            "⚡ Optimization",
            "Auto-Refactored",
            f"Yes ({metrics.get('refactor_changes', 0)} fixes)"
        )
    else:
        table.add_row(
            "⚡ Optimization",
            "Auto-Refactored",
            "No"
        )
    
    if metrics.get("performance_optimized", False):
        table.add_row(
            "",
            "Performance Optimized",
            "Yes"
        )
    
    deps_optimized = metrics.get("dependencies_optimized", 0)
    if deps_optimized > 0:
        table.add_row(
            "",
            "Dependencies Removed",
            str(deps_optimized)
        )
    
    # Project Management
    table.add_row(
        "📦 Project Mgmt",
        "Git Initialized",
        "Yes" if metrics.get("git_initialized") else "No"
    )
    
    if metrics.get("github_pushed", False):
        table.add_row(
            "",
            "Pushed to GitHub",
            "Yes"
        )
    
    if metrics.get("template_saved", False):
        table.add_row(
            "",
            "Saved as Template",
            "Yes"
        )
    
    if metrics.get("deployed", False):
        table.add_row(
            "",
            "Deployed",
            "Yes"
        )
        if metrics.get("deployment_url"):
            table.add_row(
                "",
                "URL",
                metrics.get("deployment_url")
            )
    
    # Human Interaction
    if metrics.get("approvals_requested", 0) > 0:
        table.add_row(
            "👤 Human Input",
            "Approvals",
            str(metrics.get("approvals_requested", 0))
        )
    
    if metrics.get("feedback_collected", False):
        table.add_row(
            "",
            "Feedback Collected",
            "Yes"
        )
    
    console.print(table)
    
    # Status message with emoji
    console.print()
    status = metrics.get("status", "unknown")
    
    status_messages = {
        "completed_successfully": ("✅", "Project generated successfully!", "green", "Production ready!"),
        "completed_with_minor_issues": ("✓", "Project generated with minor issues", "green", "Review before deployment"),
        "completed_with_warnings": ("⚠️", "Project generated with warnings", "yellow", "Review validation report"),
        "completed_with_critical_security_issues": ("🔒", "CRITICAL: Security vulnerabilities detected!", "red", "Fix before deployment!"),
        "completed_with_critical_issues": ("❌", "Project has critical code issues", "red", "Code review required"),
        "completed_with_errors": ("⚡", "Project completed with errors", "yellow", "Review errors before use"),
    }
    
    emoji, message, color, subtitle = status_messages.get(
        status,
        ("🤖", f"Status: {status}", "cyan", "")
    )
    
    console.print(f"[bold {color}]{emoji} {message}[/bold {color}]")
    if subtitle:
        console.print(f"[{color}]{subtitle}[/{color}]")
    
    console.print("\n[dim]Generated files are available in the artifacts/ directory.[/dim]")
    console.print(f"[dim]Project ID: {metrics.get('project_id', 'unknown')}[/dim]\n")


def main():
    """Main execution function"""
    display_banner()
    
    # Get user input
    console.print("📝 [bold]Describe your project:[/bold]")
    user_input = console.input("[cyan]>[/cyan] ")
    
    if not user_input.strip():
        console.print("[bold red]❌ Please provide a project description[/bold red]")
        sys.exit(1)
    
    console.print("\n[bold green]✓ Starting generation with complete Phase 4 pipeline...[/bold green]\n")
    
    # Phase descriptions (24 nodes)
    phase_descriptions = {
        "requirement_analysis": "🔍 Analyzing requirements",
        "human_approval": "👤 Requesting approval",
        "strategic_planning": "📋 Creating execution plan",
        "intervention_check": "⚠️  Checking for interventions",
        "frontend_generation": "⚛️  Generating frontend code",
        "backend_generation": "🔧 Generating backend code",
        "mobile_generation": "📱 Generating mobile code",
        "code_validation": "✓ Validating code quality",
        "deployment_config": "🐳 Creating deployment configs",
        "test_generation": "🧪 Generating unit tests",
        "integration_test_generation": "🔗 Generating integration tests",
        "performance_profiling": "📊 Creating performance tests",
        "security_scan": "🔒 Scanning for vulnerabilities",
        "error_analysis": "🔍 Analyzing errors",
        "code_refactor": "⚡ Auto-fixing issues",
        "performance_optimization": "🚀 Optimizing performance",
        "dependency_optimization": "📦 Optimizing dependencies",
        "template_library": "📚 Managing templates",
        "version_control": "🔧 Initializing Git",
        "deployment_tracking": "🚀 Preparing deployment",
        "feedback_collection": "💬 Collecting feedback",
        "finalization": "✨ Finalizing project",
    }
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console
    ) as progress:
        task = progress.add_task("Initializing...", total=None)
        
        try:
            for event in orchestrator.generate_project(user_input, debug_mode=False):
                node = event.get("node", "")
                status = event.get("status", "")
                
                if node == "error":
                    progress.stop()
                    console.print(f"\n[bold red]❌ Error: {event.get('error')}[/bold red]")
                    sys.exit(1)
                
                if node == "cancellation":
                    progress.stop()
                    console.print(f"\n[bold yellow]⚠️  {event.get('message')}[/bold yellow]")
                    sys.exit(0)
                
                if node in phase_descriptions:
                    description = phase_descriptions[node]
                    
                    # Get relevant metrics from event
                    data = event.get("data", {})
                    logs = data.get("logs", [])
                    if logs:
                        last_log = logs[-1]
                        message = last_log.get("message", "")
                        if message:
                            description = f"{description}: {message[:60]}"
                    
                    progress.update(task, description=description)
                
                if node == "finalization" and status == "completed":
                    progress.stop()
                    console.print("\n[bold green]✓ Generation completed![/bold green]\n")
                    
                    metrics = event.get("metrics", {})
                    display_final_metrics(metrics)
        
        except KeyboardInterrupt:
            progress.stop()
            console.print("\n\n[bold yellow]⚠️  Generation interrupted by user[/bold yellow]")
            sys.exit(0)
        except Exception as e:
            progress.stop()
            console.print(f"\n[bold red]❌ Unexpected error: {e}[/bold red]")
            import traceback
            traceback.print_exc()
            sys.exit(1)


if __name__ == "__main__":
    main()
