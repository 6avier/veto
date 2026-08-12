# VETO — Brief

Short version for a cold session. Full detail: [HANDOFF.md](HANDOFF.md).

**Deadline: 2026-08-13 23:55 WIB.** Demo and booth 2026-08-14.

---

## What VETO is

Compliance middleware for Indonesian freight. A warehouse officer enters truck
and cargo figures in their ERP; VETO returns `PASS` (200) or `HOLD` (403) with a
specific correction, before the delivery order is printed. Every decision is
written to an append-only trail with its legal citation.

Two locked rules: **zero LLM on the dispatch path**, and **HOLD plus a logged
override**, never a hard block.

## Run it

```bash
cp backend/.env.example backend/.env      # then add GEMINI_API_KEY
uv run --directory backend python manage.py migrate
uv run --directory backend python manage.py runserver 8000

cp frontend/.env.example frontend/.env.local
npm --prefix frontend install && npm --prefix frontend run dev
```

Verify with `manage.py test apps`, `npm --prefix frontend run lint`, and
`npm --prefix frontend run build`. **There is no typecheck** — the frontend is
plain JavaScript.

`VITE_USE_MOCKS=true` runs the whole frontend with no backend. Mocks are the
booth fallback; keep them working.

## Where it stands

| Surface | State |
|---|---|
| `/dispatch` | Built, **verified live** |
| `/audit` | Built, **verified live** |
| `/rule-studio` | Built, **mocks only, never run live** |
| Backend | All 12 endpoints respond. 32 of 34 tests pass. |

Frontend is feature-complete. Nothing blocking is frontend work.

## What blocks the demo

All backend or ops:

1. **Two enforced thresholds cite themselves as `Asumsi`** (assumption), and they
   are the two the demo triggers. Human verification needed. An agent must not
   invent replacements.
2. **No CLIENT rule pack is seeded**, so the closing beat — approve a rule, watch
   a nationally-legal load HOLD — has never been demonstrated.
3. **Backend tests call Gemini live** and return different results on identical
   input (2 / 2 / 1 errors across three runs). Inject a fake client.
4. **Nothing is deployed.**

## Next task

Wire `/rule-studio` live and prove the closing beat, in this order:

1. Seed or create a CLIENT rule pack. Nothing else matters without one.
2. `VITE_USE_MOCKS=false`, run upload → triage → extract → approve for real.
3. On `/dispatch`, enter a load under 25000 kg but over the approved client
   limit. It must HOLD and read `[ SOP KLIEN ]`.
4. Set `VITE_USE_MOCKS=true` again and confirm the mocked path still works.

## Do not break

- **`api-contract.md` and `contract/*.json`** are the frontend/backend seam.
  Backend tests and frontend mocks both consume those fixtures. Change the
  fixture and the contract together, and tell the other lane.
- **A HOLD is HTTP 403 and is a success**, never an error envelope.
- **PASS has no colour.** The signal is *Cetak Surat Jalan* unlocking.
- **Amber is VETO's only accent.** The ERP's green belongs to the host; VETO
  never uses green.
- **SAP 72 is the ERP's face only.** The verdict panel and HOLD dialog pin back
  to Archivo with `font-sans` even though they render inside the ERP tree.
- **No monospace in the ERP chrome.**
- **Never invent a regulation citation or a statistic.** `CLAUDE.md` §5.
- **Commits are authored `6avier`.** No `Co-Authored-By`, no AI attribution.

## Two traps already paid for

- Forms carry `noValidate`. HTML5 constraint validation blocks `onSubmit` before
  React sees it, which produces a dead button and no message.
- Section titles are **not** `<legend>`. A legend renders on the fieldset's top
  border and `padding-top` cannot move it.

## Housekeeping

`GEMINI_API_KEY` is in gitignored `backend/.env` and appears in zero commits, but
it passed through a chat transcript. **Rotate it after the event.**

`GEMINI_MODEL` defaults to `gemini-flash-latest`. Do not set `gemini-2.5-flash`;
it 404s for newer keys even though `models.list()` still advertises it.

Six open decisions are in [HANDOFF.md](HANDOFF.md) §16, including an input
treatment that was built and shown but never chosen. Do not silently decide them.
