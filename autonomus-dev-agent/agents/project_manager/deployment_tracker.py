"""
Deployment Tracker
Tracks deployment status and provides deployment to Vercel/Netlify/AWS.
"""

from typing import Dict, Any, List, Optional
from pathlib import Path
import logging
import subprocess
import json
from datetime import datetime

logger = logging.getLogger(__name__)


class DeploymentTracker:
    """Manages deployment tracking and automation"""
    
    def __init__(self):
        """Initialize deployment tracker"""
        self.deployments_file = Path("memory/deployments.json")
        self.deployments_file.parent.mkdir(parents=True, exist_ok=True)
        self.deployments = self._load_deployments()
        logger.info(f"Deployment Tracker initialized: {len(self.deployments)} tracked deployments")
    
    def _load_deployments(self) -> List[Dict[str, Any]]:
        """Load deployment history"""
        if self.deployments_file.exists():
            try:
                with open(self.deployments_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Could not load deployments: {e}")
                return []
        return []
    
    def _save_deployments(self):
        """Save deployment history"""
        try:
            with open(self.deployments_file, 'w', encoding='utf-8') as f:
                json.dump(self.deployments, f, indent=2)
            logger.info(f"Saved {len(self.deployments)} deployment records")
        except Exception as e:
            logger.error(f"Could not save deployments: {e}")
    
    def track_deployment(
        self,
        project_id: str,
        platform: str,
        status: str,
        url: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Track a deployment"""
        
        deployment = {
            "deployment_id": f"deploy-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
            "project_id": project_id,
            "platform": platform,
            "status": status,
            "url": url,
            "deployed_at": datetime.now().isoformat(),
            "metadata": metadata or {}
        }
        
        self.deployments.append(deployment)
        self._save_deployments()
        
        logger.info(f"Tracked deployment: {platform} - {status}")
        
        return deployment
    
    def deploy_to_vercel(
        self,
        project_path: Path,
        project_name: str,
        vercel_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """Deploy to Vercel"""
        
        # Check if Vercel CLI is available
        try:
            subprocess.run(
                ["vercel", "--version"],
                capture_output=True,
                timeout=5
            )
        except Exception:
            return {
                "success": False,
                "error": "Vercel CLI is not installed. Install: npm i -g vercel"
            }
        
        # Deploy
        try:
            cmd = ["vercel", "--yes", "--prod"]
            env = {}
            
            if vercel_token:
                env["VERCEL_TOKEN"] = vercel_token
            
            result = subprocess.run(
                cmd,
                cwd=project_path,
                capture_output=True,
                text=True,
                timeout=300,
                env=env if env else None
            )
            
            if result.returncode == 0:
                # Extract URL from output
                output = result.stdout.strip()
                url = None
                for line in output.split('\n'):
                    if 'https://' in line:
                        url = line.strip()
                        break
                
                logger.info(f"Deployed to Vercel: {url}")
                
                return {
                    "success": True,
                    "platform": "vercel",
                    "url": url,
                    "output": output
                }
            else:
                logger.error(f"Vercel deployment failed: {result.stderr}")
                return {
                    "success": False,
                    "error": result.stderr.strip()
                }
        
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": "Vercel deployment timed out"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def deploy_to_netlify(
        self,
        project_path: Path,
        project_name: str,
        netlify_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """Deploy to Netlify"""
        
        # Check if Netlify CLI is available
        try:
            subprocess.run(
                ["netlify", "--version"],
                capture_output=True,
                timeout=5
            )
        except Exception:
            return {
                "success": False,
                "error": "Netlify CLI is not installed. Install: npm i -g netlify-cli"
            }
        
        # Deploy
        try:
            cmd = ["netlify", "deploy", "--prod", "--dir", "build"]
            env = {}
            
            if netlify_token:
                env["NETLIFY_AUTH_TOKEN"] = netlify_token
            
            result = subprocess.run(
                cmd,
                cwd=project_path,
                capture_output=True,
                text=True,
                timeout=300,
                env=env if env else None
            )
            
            if result.returncode == 0:
                # Extract URL from output
                output = result.stdout.strip()
                url = None
                for line in output.split('\n'):
                    if 'https://' in line and 'netlify.app' in line:
                        url = line.strip()
                        break
                
                logger.info(f"Deployed to Netlify: {url}")
                
                return {
                    "success": True,
                    "platform": "netlify",
                    "url": url,
                    "output": output
                }
            else:
                logger.error(f"Netlify deployment failed: {result.stderr}")
                return {
                    "success": False,
                    "error": result.stderr.strip()
                }
        
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": "Netlify deployment timed out"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def generate_deployment_instructions(
        self,
        tech_stack: Dict[str, Any],
        project_name: str
    ) -> str:
        """Generate deployment instructions"""
        
        frontend = tech_stack.get("frontend", {}).get("framework", "react")
        backend = tech_stack.get("backend", {}).get("framework", "nodejs-express")
        
        instructions = f"""# Deployment Instructions for {project_name}

## Frontend Deployment ({frontend})

### Vercel (Recommended)
Install Vercel CLI
npm i -g vercel

Deploy
cd frontend
vercel --prod

### Netlify
Install Netlify CLI
npm i -g netlify-cli

Build
npm run build

Deploy
netlify deploy --prod --dir=build

## Backend Deployment ({backend})

### Railway
Install Railway CLI
npm i -g @railway/cli

Deploy
cd backend
railway up

### Heroku
Install Heroku CLI
https://devcenter.heroku.com/articles/heroku-cli
Deploy
cd backend
heroku create {project_name}-api
git push heroku main

### AWS (Docker)
Build Docker image
docker build -t {project_name}-backend ./backend

Push to ECR and deploy to ECS/Fargate
aws ecr create-repository --repository-name {project_name}
docker tag {project_name}-backend:latest <ecr-url>
docker push <ecr-url>

## Environment Variables

Create `.env` files in both frontend and backend:

**Frontend (.env):**
REACT_APP_API_URL=https://your-backend-url.com


**Backend (.env):**
PORT=5000
DATABASE_URL=mongodb+srv://...
JWT_SECRET=your-secret-key


## Database Setup

Set up your production database and update the connection string in `.env`.

## Post-Deployment

1. Test all endpoints
2. Set up monitoring (Sentry, LogRocket)
3. Configure custom domain
4. Enable HTTPS
5. Set up CI/CD (GitHub Actions)
"""
        
        return instructions
    
    def get_deployment_status(self, project_id: str) -> List[Dict[str, Any]]:
        """Get deployment status for a project"""
        
        return [
            d for d in self.deployments
            if d.get("project_id") == project_id
        ]


def deployment_tracker_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node for deployment tracking"""
    
    config = state.get("config", {})
    if not config.get("enable_deployment", False):
        return {
            "deployment_status": "disabled",
            "logs": [{
                "phase": "deployment",
                "message": "Deployment tracking disabled",
                "timestamp": state.get("timestamp")
            }]
        }
    
    tracker = DeploymentTracker()
    
    try:
        project_id = state.get("project_id", "unknown")
        project_name = state.get("requirements", {}).get("project_name", "app")
        tech_stack = state.get("tech_stack", {})
        project_path = Path("artifacts") / project_id
        
        # Generate deployment instructions
        instructions = tracker.generate_deployment_instructions(tech_stack, project_name)
        
        # Save instructions
        instructions_path = project_path / "DEPLOYMENT.md"
        instructions_path.write_text(instructions, encoding='utf-8')
        
        # Optional: Auto-deploy
        auto_deploy = config.get("auto_deploy", False)
        deployment_result = None
        
        if auto_deploy:
            platform = config.get("deployment_platform", "vercel")
            
            if platform == "vercel":
                deployment_result = tracker.deploy_to_vercel(
                    project_path / "frontend",
                    project_name,
                    vercel_token=config.get("vercel_token")
                )
            elif platform == "netlify":
                deployment_result = tracker.deploy_to_netlify(
                    project_path / "frontend",
                    project_name,
                    netlify_token=config.get("netlify_token")
                )
            
            if deployment_result and deployment_result.get("success"):
                tracker.track_deployment(
                    project_id,
                    platform,
                    "deployed",
                    url=deployment_result.get("url")
                )
        
        return {
            "deployment_status": "deployed" if (deployment_result and deployment_result.get("success")) else "instructions_generated",
            "deployment_url": deployment_result.get("url") if deployment_result else None,
            "deployment_instructions": instructions,
            "logs": [{
                "phase": "deployment",
                "message": f"Deployment {'completed' if deployment_result else 'instructions generated'}",
                "timestamp": state.get("timestamp")
            }]
        }
    
    except Exception as e:
        logger.error(f"Deployment tracker node error: {e}")
        return {
            "deployment_status": "failed",
            "logs": [{
                "phase": "deployment",
                "message": f"Deployment tracking failed: {str(e)}",
                "timestamp": state.get("timestamp")
            }],
            "errors": state.get("errors", []) + [str(e)]
        }
