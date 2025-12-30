# Deployment Instructions for app

## Frontend Deployment (react)

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

## Backend Deployment (nodejs-express)

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
heroku create app-api
git push heroku main

### AWS (Docker)
Build Docker image
docker build -t app-backend ./backend

Push to ECR and deploy to ECS/Fargate
aws ecr create-repository --repository-name app
docker tag app-backend:latest <ecr-url>
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
