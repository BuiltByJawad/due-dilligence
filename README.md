# Due Diligence Questionnaire Agent

Index documents, parse a questionnaire, generate answers with citations, and drive human review.

## Repository layout

- `backend/`
  - Node.js + Express API
  - Postgres (Neon) + `pgvector`
  - Async request tracking (`PENDING` / `RUNNING` / `SUCCESS` / `FAILED`)
- `frontend/`
  - Vite + React + TypeScript
  - Tailwind CSS
  - Server-side answer pagination + client cache

## Prerequisites

- Node.js (LTS recommended)
- Postgres (or Neon) with `pgvector`

## Environment variables

### Backend (`backend/.env`)

Required:

- `DATABASE_URL` (Postgres connection string)

Notes:

- Do not commit `backend/.env`.
- Ensure your Postgres instance has the `vector` extension available.

## Run locally

### 1) Backend

From `backend/`:

```bash
npm install
npm run dev
```

The API listens on:

- `http://localhost:8000`

### 2) Frontend

From `frontend/`:

```bash
npm install
npm run dev
```

The UI will start on the Vite dev server URL printed in your terminal.

## Core workflow (smoke test)

1. Start backend + frontend.
2. Upload and index reference documents (PDF/DOCX/XLSX/PPTX).
3. Create a project:
   - pick the questionnaire document
   - choose scope (`ALL_DOCS` or `SELECTED_DOCS`)
4. Generate answers (async). Track the job in **Request Status**.
5. Review answers:
   - Confirm / Reject
   - Save manual edits
6. Evaluate:
   - produces a similarity score and notes for manual vs AI answers

## Dataset

Sample PDFs live in `data/`.

Recommended quick run:

- Use `data/ILPA_Due_Diligence_Questionnaire_v1.2.pdf` as the questionnaire input.
- Use other PDFs in `data/` as reference documents.

## Security and safety notes

- The UI renders answer text as plain text (React-escaped). Avoid rendering answer content via raw HTML.
- Manual edits are trimmed and validated; whitespace-only submissions are rejected.

## Troubleshooting

- If the UI looks stuck after refresh:
  - confirm the backend is running on `http://localhost:8000`
  - check the browser Network tab for failed/timeout requests

## Git hygiene

Do not commit:

- `backend/.env`
- `**/node_modules/`
- `**/dist/`
