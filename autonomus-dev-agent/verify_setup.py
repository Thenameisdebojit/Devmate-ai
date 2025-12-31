"""
Setup Verification Script for Autonomous Deep AI Agent
Verifies all dependencies, API keys, and system connections.
"""

from dotenv import load_dotenv
load_dotenv()

import os
import sys
from rich.console import Console
from rich.table import Table

console = Console()

def main():
    console.print("\n[bold cyan]🤖 Autonomous Deep AI Agent - Setup Verification[/bold cyan]\n")
    
    # Python version check
    console.print(f"[bold]Python Version:[/bold] {sys.version}")
    console.print("=" * 80)
    
    # Package verification
    console.print("\n[bold yellow]📦 Package Verification:[/bold yellow]")
    packages = [
        ("langgraph", "import langgraph"),
        ("langchain", "import langchain"),
        ("langchain_openai", "import langchain_openai"),
        ("langchain_anthropic", "import langchain_anthropic"),
        ("docker", "import docker"),
        ("kubernetes", "import kubernetes"),
        ("pydantic", "import pydantic"),
        ("fastapi", "import fastapi"),
        ("rich", "import rich"),
    ]
    
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("Package", style="cyan")
    table.add_column("Status", justify="center")
    
    for name, import_stmt in packages:
        try:
            exec(import_stmt, {})
            table.add_row(name, "[green]✅ Installed[/green]")
        except Exception as e:
            table.add_row(name, f"[red]❌ Error: {str(e)[:30]}[/red]")
    
    console.print(table)
    
    # API Keys verification
    console.print("\n[bold yellow]🔑 API Keys Verification:[/bold yellow]")
    api_table = Table(show_header=True, header_style="bold magenta")
    api_table.add_column("API Key", style="cyan")
    api_table.add_column("Status", justify="center")
    
    api_keys = ["OPENAI_API_KEY", "GOOGLE_API_KEY"]
    for key in api_keys:
        value = os.getenv(key)
        if value and value != f"your_{key.lower()}_here":
            masked = f"{value[:8]}...{value[-4:]}" if len(value) > 12 else "***"
            api_table.add_row(key, f"[green]✅ Set ({masked})[/green]")
        else:
            api_table.add_row(key, "[red]❌ Missing or not configured[/red]")
    
    console.print(api_table)
    
    # Docker connection
    console.print("\n[bold yellow]🐳 Docker Connection:[/bold yellow]")
    try:
        import docker
        client = docker.from_env()
        version = client.version()
        console.print(f"  [green]✅ Docker connected - Version: {version['Version']}[/green]")
        
        # Test containers
        containers = client.containers.list()
        console.print(f"  [cyan]ℹ️  Running containers: {len(containers)}[/cyan]")
    except Exception as e:
        console.print(f"  [red]❌ Docker error: {e}[/red]")
        console.print("  [yellow]⚠️  Make sure Docker Desktop is running[/yellow]")
    
    # Kubernetes connection
    console.print("\n[bold yellow]☸️  Kubernetes Connection:[/bold yellow]")
    try:
        from kubernetes import client, config
        config.load_kube_config()
        v1 = client.CoreV1Api()
        namespaces = v1.list_namespace()
        console.print(f"  [green]✅ Kubernetes connected - {len(namespaces.items)} namespaces found[/green]")
    except Exception as e:
        console.print(f"  [yellow]⚠️  Kubernetes: {e}[/yellow]")
        console.print("  [cyan]ℹ️  This is optional for local development[/cyan]")
    
    # Directory structure check
    console.print("\n[bold yellow]📁 Directory Structure:[/bold yellow]")
    required_dirs = ["agents", "config", "memory", "tools", "validators", "deployers", "tests", "artifacts", "logs"]
    
    for dir_name in required_dirs:
        if os.path.exists(dir_name):
            console.print(f"  [green]✅ {dir_name}/[/green]")
        else:
            console.print(f"  [red]❌ {dir_name}/ missing[/red]")
    
    console.print("\n[bold green]✨ Setup verification complete![/bold green]\n")
    
    # Configuration summary
    console.print("[bold yellow]📋 Configuration Summary:[/bold yellow]")
    config_table = Table(show_header=True, header_style="bold magenta")
    config_table.add_column("Setting", style="cyan")
    config_table.add_column("Value", style="green")
    
    config_settings = [
        ("MAX_TOKENS_PER_REQUEST", os.getenv("MAX_TOKENS_PER_REQUEST", "8000")),
        ("MAX_ITERATIONS", os.getenv("MAX_ITERATIONS", "10")),
        ("ENABLE_VALIDATION", os.getenv("ENABLE_VALIDATION", "true")),
        ("K8S_NAMESPACE", os.getenv("K8S_NAMESPACE", "dev-agent-apps")),
        ("LOG_LEVEL", os.getenv("LOG_LEVEL", "INFO")),
    ]
    
    for setting, value in config_settings:
        config_table.add_row(setting, value)
    
    console.print(config_table)
    console.print()

if __name__ == "__main__":
    main()
