# Test plan — Question Maker (EduQuery)

This document maps product features to automated tests, defines layers and priorities, and points maintainers to the right files. It pairs with [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md).

## 1. Goals

| Goal | Success criteria |
|------|------------------|
| Regression safety | Changes to auth, questions, assessments, Canvas, EduAI, and the assessment variant workflow are covered by tests that run in CI. |
| Handover | New owners can see *which* feature maps to *which* tests and where to add cases. |
| Test pyramid | Prefer **unit** tests on pure logic, **integration** tests on HTTP + DB for critical paths; **E2E** only if Playwright/Cypress is added later. |

## 2. Tooling

| Area | Command | Config |
|------|---------|--------|
| Backend | `cd app/backend && npm test` | Jest, ESM (`--experimental-vm-modules`) — [jest.config.js](../app/backend/jest.config.js) |
| Backend coverage | `npm run test:coverage` | Same |
| Frontend | `cd app/frontend && npm test` | Vitest |
| Test env | `app/backend/test/setup.js` | Loads root `.env` (optional); if `TEST_DATABASE_URL` is set, it becomes `DATABASE_URL`. If still unset (e.g. GitHub Actions with no file), a **local stub** `postgres://jest@127.0.0.1:5432/jest_unit_stub` is set so imports succeed — unit tests do not need a real server. You can also set `DATABASE_URL` in the workflow env. `JWT_SECRET` / `ENCRYPTION_KEY` get defaults if missing. |
| DB integration | `cd app/backend && npm run test:integration` | [jest.integration.config.js](../app/backend/jest.integration.config.js) — only `*.integration.test.js`, `maxWorkers: 1` to avoid clobbering a shared test DB. |
| Full backend | `npm run test:all` | Unit suite then integration suite. |

**PostgreSQL is required** for `test:integration`. In project root `.env` add, for example:

`TEST_DATABASE_URL=postgresql://USER:PASS@localhost:5432/eduquery_test`

Create the empty database once (`CREATE DATABASE eduquery_test;`). The app will `sync` the schema on connect. **Never** point `TEST_DATABASE_URL` at production data — each run uses `TRUNCATE users ... CASCADE` between cases.

## 3. Current baseline (inventory)

- **Implemented:** [extraction.test.js](../app/backend/test/extraction.test.js) — `extractionUtils` (question blocks, chunking, dedupe).
- **Implemented:** [health.test.js](../app/backend/test/health.test.js) — public HTTP surface (`/`, `/healthz`, 404).
- **Implemented:** [encryption.test.js](../app/backend/test/encryption.test.js) — Canvas API key encrypt/decrypt round-trip.
- **Implemented:** [authService.test.js](../app/backend/test/authService.test.js) — JWT verify helpers (no DB).
- **Implemented:** [assessmentVariantMetadataScoring.test.js](../app/backend/test/assessmentVariantMetadataScoring.test.js) — `scoreMetadataMatch` pure scoring (`assessmentVariantMetadataScoring.js`).
- **Implemented:** [assessmentVariantHttp.integration.test.js](../app/backend/test/assessmentVariantHttp.integration.test.js) — `400` on `/api/assessment-variant` for missing/invalid body (requires `TEST_DATABASE_URL`).
- **Extended:** [questionAssessments.integration.test.js](../app/backend/test/questionAssessments.integration.test.js) — question validation, `POST /api/course`, create/list variants, empty variant text `400`.
- **Implemented:** [assessmentVariantAuth.test.js](../app/backend/test/assessmentVariantAuth.test.js) — all `/api/assessment-variant` routes return `401` without a bearer token.
- **Implemented:** [eduaiAuth.test.js](../app/backend/test/eduaiAuth.test.js) — EduAI proxy routes return `401` without a bearer token.
- **Implemented:** [canvasExport.test.js](../app/backend/test/canvasExport.test.js) — `convertVariantToCanvasQuestion` / `parseMCQOptions` (exported from `canvasService.js` for tests only).
- **Express split:** [app.js](../app/backend/src/app.js) exports the app for supertest; [index.js](../app/backend/src/index.js) only starts the server and DB.
- **DB integration (optional env):** [auth.integration.test.js](../app/backend/test/auth.integration.test.js) — register, login, `/me`, validation, duplicate email. [questionAssessments.integration.test.js](../app/backend/test/questionAssessments.integration.test.js) — create question, create/fetch assessment. [testDb.js](../app/backend/test/helpers/testDb.js) — connect + `TRUNCATE` helper.
- If `TEST_DATABASE_URL` is unset, integration suites are **skipped** (Jest still exits 0).
- **Placeholder** frontend dummy test can be removed once real component tests exist.

## 4. Test layers

1. **Unit (no DB):** `extractionUtils`, `encryption`, `assessmentVariantMetadataScoring` (`scoreMetadataMatch`), validation mappers, Canvas MCQ parsing helpers.
2. **Service + DB:** `questionService`, `assessmentService`, `assessmentAuthService` — use a test DB or transactional rollback.
3. **HTTP (supertest):** Authenticated routes with a test user or generated JWT; mock external HTTP (EduAI, Canvas) where the client is injectable.
4. **Frontend (Vitest + Testing Library):** `api.ts` interceptors, critical hooks, pure export builders.

**Do not** call real EduAI or Canvas in CI; use fixtures and mocks.

## 5. Feature → tests (backlog and IDs)

### A. Authentication (`/api/auth`, `authService`, `middleware/auth`)

| ID | Type | Cases |
|----|------|--------|
| A1 | Unit | `verifyToken` valid / invalid / wrong secret (partially covered in authService tests). |
| A2 | HTTP + DB | `POST /register` — success, duplicate email, validation. |
| A3 | HTTP + DB | `POST /login` — success, wrong password, unknown user. |
| A4 | HTTP + DB | `GET /me` — 200 with valid token, 401 without. |

### B. Courses and topics (`/api/course`)

| ID | Type | Cases |
|----|------|--------|
| B1 | HTTP + DB | CRUD scoped to `userId`; 403/404 for other user’s data. |

### C. Questions and variants (`questionService`, `routes/questions`, `routes/variants`)

| ID | Type | Cases |
|----|------|--------|
| C1 | Service + DB | Create/read/update/delete with valid `courseId` / topic rules. |
| C2 | HTTP | Authenticated variant and question order endpoints. |

### D. Extraction and AI (`extractionUtils`, `aiService`, `saveExtractedQuestions`)

| ID | Type | Cases |
|----|------|--------|
| D1 | Unit | Extraction helpers — extend [extraction.test.js](../app/backend/test/extraction.test.js) for edge cases. |
| D2 | Unit + mock | `extractQuestionsFromText` — mock upstream, assert request/response handling. |
| D3 | Service + DB | `saveExtractedQuestions` — metadata + variants + optional assessment/section. |

### E. EduAI (`/api/eduai`, `eduaiService`)

| ID | Type | Cases |
|----|------|--------|
| E1 | HTTP | `401` without token — [eduaiAuth.test.js](../app/backend/test/eduaiAuth.test.js). (Mock upstream / 4xx validation: backlog.) |

### F. Assessments (`assessmentService`, `assessmentSectionService`, `routes/assessments`)

| ID | Type | Cases |
|----|------|--------|
| F1 | Service + DB | Blueprint, sections, variant links, reorder. |
| F2 | HTTP | Happy path: create assessment → section → attach variant. |

### G. Canvas (`canvasService`, `encryption`, export)

| ID | Type | Cases |
|----|------|--------|
| G1 | Unit | Encrypt/decrypt (see encryption tests). |
| G2 | Unit | `convertVariantToCanvasQuestion` / `parseMCQOptions` — [canvasExport.test.js](../app/backend/test/canvasExport.test.js). |
| G3 | Unit + mock | Full export sequence against mocked Canvas API (backlog). |

### H. Assessment variant workflow (`/api/assessment-variant`, `assessmentVariantService.js`)

| ID | Type | Cases |
|----|------|--------|
| H1 | Unit | `scoreMetadataMatch` (see [assessmentVariantMetadataScoring.test.js](../app/backend/test/assessmentVariantMetadataScoring.test.js)). |
| H2 | HTTP | Validation: `400` for missing `studyRole`, `courseId`, etc. (see integration tests). |
| H3 | Service + DB | One fixture: reference assessment → `assembleEquivalentExamVariants` structure (or clear failure). |

### I. Infrastructure

| ID | Type | Cases |
|----|------|--------|
| I1 | HTTP | `/healthz`, `/` — [health.test.js](../app/backend/test/health.test.js). |
| I2 | HTTP | Unknown route → 404 JSON. |

### J. Frontend (Vitest)

| ID | Type | Cases |
|----|------|--------|
| J1 | Unit | `api.ts` — Authorization header, 401 behavior. |
| J2 | Component | `LoginPage` — submit with mocked service. |

## 6. Suggested implementation order

1. Auth + health (A, I) — foundation for authenticated HTTP tests.  
2. Questions / variants (C).  
3. Assessments (F).  
4. Extraction + EduAI mocks (D, E).  
5. Canvas (G).  
6. Assessment variant API (H) — validation routes first, then one DB-backed assembly case.  
7. Frontend (J).

## 7. Handover checklist

- [ ] CI runs `npm test` in `app/backend` and `app/frontend` on every PR.  
- [ ] CI (or a manual pre-release step) sets `TEST_DATABASE_URL` and runs `npm run test:integration` in `app/backend` when a Postgres test instance is available.  
- [ ] No production API keys in test code; use `.env` (local) or CI secrets, not committed credentials.

---

*Last updated: aligns with repository layout and [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md).*
