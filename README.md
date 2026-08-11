# VETO

Compliance gate engine for Indonesian freight logistics. Dispatch data goes in, `PASS` or `HOLD` plus an actionable directive comes out.

Product spec: [PRODUCT.md](PRODUCT.md) · Engineering context: [CLAUDE.md](CLAUDE.md) · **API contract: [api-contract.md](api-contract.md)**

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| [uv](https://docs.astral.sh/uv/) | any recent | Manages Python. You do **not** need Python installed separately. |
| Node | 20+ | |

## Quick start

Two terminals.

```bash
cp backend/.env.example backend/.env && uv run --directory backend python manage.py migrate && uv run --directory backend python manage.py runserver 8000
```

```bash
cp frontend/.env.example frontend/.env.local && npm --prefix frontend install && npm --prefix frontend run dev
```

Frontend on http://localhost:5173, API on http://127.0.0.1:8000. The Vite dev server proxies `/api` to Django, so there is no CORS setup in development.

Run the backend tests:

```bash
uv run --directory backend python manage.py test apps
```

---

## Lanes

Each lane owns its directories outright. Nobody edits another lane's tree, so merges into `main` stay clean.

| Lane | Owns | Blocked by |
|---|---|---|
| **Backend** | `backend/apps/validation`, `backend/apps/audit`, `backend/config` | nothing |
| **Frontend** | `frontend/src/routes/Dispatch.jsx`, `AuditLog.jsx`, `frontend/src/components`, styling | nothing — mocks cover it |
| **Rule Studio** | `frontend/src/routes/RuleStudio.jsx` **and** `backend/apps/rules` — full stack, one owner | the contract only |

Rule Studio spans both trees deliberately. Its upload → triage → extract → approve flow has too much shared state to split across two people.

Shared files that need a heads-up before changing: `api-contract.md`, `contract/*.json`, `frontend/src/api/*`, `backend/config/*`.

## The contract is the seam

[api-contract.md](api-contract.md) is binding. `contract/*.json` holds the canonical request and response fixtures, and **both sides consume them**:

- the frontend's mocks import them directly (`@contract/...`)
- the backend's tests assert its live responses against them

So if one side changes a shape, the other side's build or tests break the same day. That is the whole point. **Change the fixture and `api-contract.md` first, tell the other lane, then change code.**

## Working without the backend

`frontend/.env.local` ships with `VITE_USE_MOCKS=true`. Every endpoint in the contract returns its fixture, with a simulated delay so loading states look real. A `MOCKS ON` badge shows in the nav.

Set it to `false` and restart Vite to hit the live API. Flip per-endpoint by deleting the `USE_MOCKS` branch in that function in `frontend/src/api/`.

### One gotcha, already handled

A `HOLD` is HTTP 403, and **axios throws on 403**. It is not an error — it is the most important success path in the product. `validateDispatch()` in `frontend/src/api/validation.js` absorbs this and returns the decision for both `PASS` and `HOLD`; it only throws on genuine failures. Use that function rather than calling `http.post('/validate')` directly.

Chrome logs `403 (Forbidden)` in the console on every HOLD. That is the browser's network log, not an application error. Ignore it.

## Integration checkpoint

**End of day 2.** `POST /validate` wired end to end, `PASS` and `HOLD` both rendering from the real backend. Budget two hours. Do not let the first real request happen on the final day.

---

## Current state

Scaffold only. What works today:

- `POST /api/v1/validate` returns contract-exact `PASS`/`HOLD` — but from **hardcoded thresholds** in `backend/apps/validation/views.py`, with no rule pack and no persisted decision. Marked `STUB`. Replacing it is the backend lane's first task.
- `/dispatch` is a **scaffold**, not the design. It exists to prove the seam. The frontend lane replaces it wholesale — read CLAUDE.md §7 first.
- `/rule-studio` and `/audit` are placeholders. Their API helpers are written and mocked.

Every threshold currently in the code is marked `TODO: verify`. Per CLAUDE.md §5, none of them ship as seed data until they are checked against the regulation text.

## Notes

- `backend/.env` and `frontend/.env.local` are gitignored. Never commit real keys.
- Python is pinned to 3.12 in `backend/.python-version` (PyMuPDF wheels lag on newer versions).
- Local dev uses SQLite so the backend lane is not blocked on Supabase. Set `DATABASE_URL` to the Supabase pooler URL to switch.
- Port 5173 must be free. Stop any other Vite dev server first.
