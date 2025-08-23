# Lithium Monitoring Monorepo

This repository contains a MERN-stack application for monitoring lithium prices, estimating Albemarle (ALB) EPS, and tracking inventory metrics.

## Structure
```
app/
  backend/   # Express + TypeScript API
  frontend/  # React + Vite client
  infra/     # Environment templates and API collections
```

## Development
### Backend
```bash
cd app/backend
npm install
npm test   # builds and runs unit tests
npm run dev
```

### Frontend
```bash
cd app/frontend
npm install
npm run dev
```

## CI/CD
GitHub Actions pipelines are provided:
- `ci.yml` – builds and tests backend and frontend on every push and PR.
- `deploy.yml` – on pushes to `main`, triggers Render (backend) and Vercel (frontend) deployments. Secrets required:
  - `RENDER_DEPLOY_HOOK`
  - `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- `ingest-prices.yml` – scheduled job (every 30 min) calling `/api/ingest/prices` with `BASE_URL_BACKEND` and `ADMIN_KEY` secrets.

## Environment Variables
Example `.env` files are located alongside each service (`app/backend/.env.example`, `app/frontend/.env.example`). Copy them to `.env` and fill in values before running locally or deploying.

## Deployment
- **Backend**: Create a Render web service pointing to `app/backend`, set env variables, and obtain a deploy hook URL to store in `RENDER_DEPLOY_HOOK` secret.
- **Frontend**: Create a Vercel project pointing to `app/frontend` and populate the Vercel secrets listed above.

