# EduQuery.ai - Question Maker

Full-stack platform for building course question banks and assessments with AI-assisted workflows.

## Features

- Secure auth with per-user data scoping.
- Course and topic onboarding from EduAI.
- Question and variant authoring (manual + AI-assisted).
- OCR upload flow (PDF/image) to extract and review questions before save.
- Assessment builder with section-level variant matching.
- Canvas LMS integration:
  - Export local assessments to Canvas.
  - Import Canvas quizzes into local assessments.
- Assessment variant workflow:
  - Mark baseline exam.
  - Generate missing variants.
  - Assemble parallel exams (A/B/C).
  - Run AI rubric review between baseline and variant exams.
- Export assessments to TXT and Word (`.docx`).
- Guided tour across core pages.
- Built-in bug reporting with admin triage dashboard.

## Architecture

### Backend (`app/backend`)

- Node.js + Express (ESM JavaScript).
- PostgreSQL + Sequelize.
- JWT auth + bcrypt password hashing.
- Security middleware: Helmet, CORS, compression, production rate limiting.
- Service modules for auth, questions, assessments, EduAI, Canvas, assessment variants, and bug reports.

### Frontend (`app/frontend`)

- React + TypeScript + Vite.
- React Router v7.
- Tailwind + Radix/shadcn-style UI primitives.
- Context-driven app state for auth, guided tour, and bug reporting.
- Axios API client with token injection and 401 handling.

## Project Structure

```text
question-maker/
├── app/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   ├── middleware/
│   │   │   ├── routes/
│   │   │   ├── schema/
│   │   │   ├── services/
│   │   │   └── utils/
│   │   └── test/
│   └── frontend/
│       ├── src/components/
│       ├── src/contexts/
│       ├── src/hooks/
│       ├── src/pages/
│       ├── src/services/
│       ├── src/types/
│       └── src/utils/
├── docs/
├── docker-compose.yml
├── docker-compose.dev.yml
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- PostgreSQL (for local non-Docker runs)
- Docker + Docker Compose (optional but recommended)

### Option 1: Docker Compose

1. Clone and enter the repo.
2. Copy `.env.example` to `.env` and fill required secrets.
3. Start:

```bash
npm run dev:up
```

Useful commands:

```bash
npm run dev:down
npm run dev:logs
npm run dev:build
```

### Option 2: Local Development

1. Create `.env` from `.env.example`.
2. Start backend:

```bash
cd app/backend
npm install
npm run dev
```

3. Start frontend in another terminal:

```bash
cd app/frontend
npm install
npm run dev
```

Default local endpoints:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`

## Environment Variables

Use a single root `.env` file. See `.env.example` for full defaults.

Important variables for current features:

- Core:
  - `NODE_ENV`
  - `PORT`
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `JWT_EXPIRES_IN`
  - `CORS_ORIGINS`
- AI / EduAI:
  - `EDUAI_API_URL`
  - `EDUAI_API_KEY`
  - `EDUAI_IGNORED_COURSE_CODES` (optional list)
- Security / encryption:
  - `ENCRYPTION_KEY` (required in production)
- Bug reports:
  - Default admin dashboard user: `admin@mail.com` (see developer guide).
  - `BUG_REPORT_ADMIN_EMAILS` (optional comma-separated **additional** admin emails)
- Frontend build vars:
  - `VITE_API_URL`
  - `VITE_APP_NAME`
  - `VITE_APP_VERSION`

## API Surface (high level)

- Auth: `/api/auth`
- Courses/topics: `/api/course`
- Questions/variants: `/api/questions`
- Assessments/sections: `/api/assessments`
- EduAI proxy: `/api/eduai`
- Canvas integration: `/api/canvas`
- Assessment variant workflow: `/api/assessment-variant`
- Bug reports: `/api/bug-reports`

## Frontend Routes (high level)

- `/login`
- `/courses`
- `/home`
- `/assessments/:id/builder`
- `/assessment-variant`
- `/help`
- `/admin/bug-reports` (admin users only)

## Development Commands

### Backend

```bash
cd app/backend
npm run dev
npm test
npm run test:integration
npm run lint
```

### Frontend

```bash
cd app/frontend
npm run dev
npm run build
npm test
npm run lint
```

### Seed / Populate Helpers

```bash
npm run populate:backend
cd app/backend && npm run seed:production
```

## Documentation

| Topic | Where |
|--------|--------|
| **Testing** (integration DB, commands) | [docs/TEST_PLAN.md](docs/TEST_PLAN.md) |
| **Architecture and workflows** | [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) |
| **Troubleshooting** | [docs/troubleshooting/](docs/troubleshooting/) — [MONITORING_SETUP.md](docs/troubleshooting/MONITORING_SETUP.md), [PRODUCTION.md](docs/troubleshooting/PRODUCTION.md) |
| **Deployment and CI/CD** | [docs/deployment/README.md](docs/deployment/README.md) |
| **Cron / scheduled pull on the server** | [docs/deployment/cron.md](docs/deployment/cron.md) |

**Note:** The **cron**-based job that auto-pulls and deploys on the server may be disabled, broken, or misconfigured. If you do not see new releases, troubleshoot using [docs/deployment/cron.md](docs/deployment/cron.md) and [docs/troubleshooting/PRODUCTION.md](docs/troubleshooting/PRODUCTION.md), or **deploy manually** (see [docs/deployment/README.md](docs/deployment/README.md), e.g. SSH, `git pull`, Docker).

In-app user guide: open **`/help`** after signing in.

### GitHub Personal Access Token (new developers)

GitHub no longer accepts account passwords for Git over HTTPS. To run CI/CD and to **pull updates on the production server**, configure a **Personal Access Token** in all three places:

1. **Local root `.env`** — add `GITHUB_PERSONAL_ACCESS_TOKEN=<your-token>` (deploy scripts such as [`scripts/daily-deploy.sh`](scripts/daily-deploy.sh) also accept `PERSONAL_ACCESS_TOKEN` or `GITHUB_TOKEN` in that file).
2. **GitHub repository secrets** — in the repo on GitHub: **Settings → Secrets and variables → Actions**, create a secret with the token. Use the **name expected by your workflows** (the deployment guide lists `PERSONAL_ACCESS_TOKEN`; align the secret name with what `.github/workflows/*.yml` references).
3. **Production `.env` on the server** — add the same token (e.g. `GITHUB_PERSONAL_ACCESS_TOKEN` or `PERSONAL_ACCESS_TOKEN`) next to the app’s other secrets so automated or manual `git pull` against private or protected remotes succeeds.

More context: [docs/deployment/README.md](docs/deployment/README.md) (CI/CD and secrets), [docs/deployment/cron.md](docs/deployment/cron.md) (env variable names), [docs/features/CI-CD.md](docs/features/CI-CD.md).

## License

MIT
