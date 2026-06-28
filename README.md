# PeopleQuest Talent AI

AI talent-scouting prototype. Upload a CV → AI parses it → scores against a role → surfaces strengths, gaps, interview questions, and candidate comparisons.

## Stack

- **Frontend:** React (Vite) + Tailwind CSS, React Router, axios, lucide-react
- **Backend:** Node.js + Express
- **AI:** OpenAI API (`gpt-4o`, configurable) for CV parsing, scoring language, interview questions, comparisons
- **Storage:** JSON files (`backend/data/`) — no database
- **Uploads:** multer (PDF / DOCX)

## Project structure

```
talent-ai/
  backend/
    server.js              Express app + route mounting
    .env / .env.example    ANTHROPIC_API_KEY, PORT
    data/                  jobs.json, candidates.json, scores.json
    routes/                jobs.js, candidates.js
    services/              aiClient.js (shared OpenAI client); Session 2/3: cvParser,
                           fileExtractor, scorer, languageGenerator
    uploads/               temp CV files (deleted after parse)
  frontend/
    src/
      App.jsx              routing
      components/Layout.jsx
      screens/             JobSelector, CVUpload, Dashboard, CandidateDetail,
                           InterviewQuestions, CompareView
  package.json             root — runs both servers via concurrently
```

## Setup

From the `talent-ai/` directory:

```bash
npm run install:all     # installs root, backend, and frontend deps
```

Add your API key (needed from Session 2 onward) — edit `backend/.env`:

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
PORT=3001
```

## Run

```bash
npm run dev             # starts backend (:3001) and frontend (:5173) together
```

- Frontend: http://localhost:5173
- Backend health check: http://localhost:3001/api/health

The Vite dev server proxies `/api/*` to the backend.

## Build status

- **Session 1 — Scaffold + data layer:** ✅ complete (structure, routing, layout, stubbed routes, job data)
- **Session 2 — AI parsing engine:** ✅ complete (fileExtractor, cvParser, POST /api/upload-cv)
- **Session 3 — Scoring engine + interview questions:** ✅ complete (scorer w/ 7 dimensions incl. **age band**, languageGenerator, auto-scoring on upload, interview questions, compare, GET endpoints)
- **Session 4 — Frontend screens:** ✅ complete (all 6 screens + LaneBadge/ScoreBar/CandidateCard; live score-breakdown panel on candidate detail)
- **Session 5 — Demo data + polish:** ✅ complete (demo-candidates + Load demo button/banner, demo-aware lookups, 150ms route fade, loading/error states, exact lane & bar colors)
- **Session 6 — Dynamic Criteria Engine:** ✅ complete (criteria[] per job w/ cv/interview/ocean sources, AI criteria generator, partial CV-only scoring, Job Builder screen, industry templates, age kept as editable CV criterion)
- **OCEAN questionnaire:** ✅ complete (BFI-10 after upload → scores ocean criteria → recomputes combined score/coverage; trait profile shown on candidate detail). Flow: Upload CV → OCEAN → Dashboard.

## Deployment (Vercel + Render)

Frontend → Vercel, backend → Render (the backend needs a real Node process for its JSON-file storage).

**Backend (Render):** root dir `backend`, build `npm install`, start `npm start`. Env: `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-4o`. A `render.yaml` blueprint is included at the repo root. Note: free tier filesystem is ephemeral — uploaded candidates reset when the instance sleeps/redeploys (demo data + fresh uploads still work per session).

**Frontend (Vercel):** root dir `frontend`, Vite preset. Env: `VITE_API_BASE = https://<your-render-backend>.onrender.com`. SPA routing handled by `frontend/vercel.json`.

Local dev is unaffected: with `VITE_API_BASE` unset, the Vite proxy sends `/api` to `localhost:3001`.

## API endpoints (target)

| Method | Endpoint | Status |
|--------|----------|--------|
| GET  | `/api/health` | live |
| GET  | `/api/jobs` | stub (Session 3) |
| GET  | `/api/candidates/:jobId` | stub (Session 3) |
| POST | `/api/upload-cv` | stub (Session 2) |
| POST | `/api/score-candidate` | stub (Session 3) |
| POST | `/api/interview-questions` | stub (Session 3) |
