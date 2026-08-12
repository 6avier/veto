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
booth fallback; keep them working. **It is currently `false`** — flip it back
before the booth.

The dev server takes an assigned port when 5173 is busy. Safe because the
frontend calls `/api/v1` relative through the Vite proxy, so the browser sees
same origin and the backend's CORS pin on 5173 never applies in dev.

## Where it stands

| Surface | State |
|---|---|
| `/dispatch` | Built, **verified live**. Added yellow frontend warnings for unbalanced payloads (Smart Balance Warnings) with shifting weight calculations. |
| `/audit` | Built, **verified live** |
| `/rule-studio` | Built, **verified live** — upload, triage, extract, source plate |
| Backend | All endpoints respond. 38/38 tests passing as of 2026-08-13. Added **Smart Directives** to `engine.py` (proportional overload reduction & shifting recommendations). Added Gross Weight vs Axle integrity check. |

Frontend is feature-complete. Nothing blocking is frontend work.

## Read this before touching Rule Studio

**Live AI extraction had never once run** until 2026-08-12. `apps/rules/views.py`
called `json.loads` without importing `json`, so every extraction raised
`NameError`, was swallowed by a broad `except`, and returned the hardcoded
fallback. The `25.000 kg` tagged `gemini-extracted` on screen was never read
from any document. Fixed in `3912607`.

**The Gemini free tier allows 20 extraction calls per DAY**, per model:

```
quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier
quotaValue: 20
```

This is what made the test suite look non-deterministic. It is rate limiting,
not randomness. **At a booth this runs out in minutes.**

`gemini-flash-lite-latest` works and carries a separate daily quota. Verified.
To switch: `echo "GEMINI_MODEL=gemini-flash-lite-latest" >> backend/.env`.
`gemini-2.0-flash` and `gemini-2.5-flash` both 404 for this key.

The fallback is deliberately honest now: tagged `cadangan` /
`belum-diverifikasi`, never `gemini-extracted`, and its excerpt says extraction
was unavailable instead of posing as a quotation. Its threshold is a
placeholder. **Do not make it invent a figure again** (`CLAUDE.md` §5).

## What blocks the demo

1. ~~No CLIENT rule pack is seeded~~ **Done 2026-08-13** (Iqbal, `65bc380`,
   "feat(rules): seed Client SOP rules and finalize closing beat"). The closing
   beat — approve a rule, watch a nationally-legal load HOLD — should now be
   demonstrable. Verify it before assuming so; it hasn't been re-checked from
   the frontend side since it landed.
2. **Two enforced thresholds cite themselves as `Asumsi`** (assumption), and they
   are the two the demo triggers. The word is **ours, not the regulation's** — it
   appears zero times in `data/` and zero times in the corpus. The Lampiran of
   PP 55/2012 was never obtained; `data/regulations/MISSING_REGULATIONS.md`
   lists it as CRITICAL GAP #1. The corpus's own tandem figure is **18000**
   while the engine enforces **16000**. Human verification needed. An agent must
   not invent replacements.
3. **Gemini quota** — see above.
4. **Nothing is deployed.**

## Next task

Execute `docs/plans/2026-08-13-truck-envelope-illustrated-implementation.md` —
replaces `/dispatch`'s `TruckEnvelope` widget (currently plain rectangles,
shipped in `66124b7`) with an illustrated truck: cab, wheels, panel lines.
**Nothing in this plan is built yet**, design + plan are committed only.
Read `docs/plans/2026-08-12-truck-envelope-illustrated-design.md` first for
the why, then execute the 7-task plan in order — each task ends in a commit
and has a mandatory Playwright self-verification screenshot step. Pure P2
polish on an already-working widget; drop it first if time runs short before
2026-08-14, ahead of any P0 item below.

## Watch the seam

`contract/*.json` and the seeded rule base drifted twice in one day, both times
silently.

**`backend/api-contract.md` is a stale tracked duplicate of the root
`api-contract.md`** — 16 lines out of date, still carrying English directives,
the old `1.22` axle notation, and a different citation. The root file is
canonical per `CLAUDE.md`. Anyone reading the backend copy builds to a wrong
contract. Not deleted yet because it is the other lane's file.

**Before touching the dispatch form, run `curl localhost:8000/api/v1/rules` and
check the `applies_to.axle_config` values against `AXLE_CONFIGS`.**

## Do not break

- **`api-contract.md` and `contract/*.json`** are the frontend/backend seam.
  Backend tests and frontend mocks both consume those fixtures. Change the
  fixture and the contract together, and tell the other lane.
- **A HOLD is HTTP 403 and is a success**, never an error envelope.
- **PASS has no colour.** The signal is *Cetak Surat Jalan* unlocking.
- **Amber is VETO's only accent.** The ERP's green belongs to the host; VETO
  never uses green. On the register surface amber is a marker, never text.
- **`DIMENSION_NAMES` in `engine.py` holds payload keys**, not display text.
  Translating it makes `dims.get()` miss and disables every dimension check
  without raising. Display wording lives in `DIMENSION_SUBJECTS`.
- **SAP 72 is the ERP's face only.** The verdict panel and HOLD dialog pin back
  to Archivo with `font-sans` even though they render inside the ERP tree.
- **No monospace in the ERP chrome.**
- **Never invent a regulation citation or a statistic.** `CLAUDE.md` §5.
- **Commits are authored `6avier`.** No `Co-Authored-By`, no AI attribution.

## Three traps already paid for

- Forms carry `noValidate`. HTML5 constraint validation blocks `onSubmit` before
  React sees it, which produces a dead button and no message.
- Section titles are **not** `<legend>`. A legend renders on the fieldset's top
  border and `padding-top` cannot move it.
- `test_approve_candidate` and `test_reject_candidate` were green **because**
  extraction was broken: the fallback always returned exactly one candidate, so
  `["candidates"][0]` always worked. With extraction fixed, a mock PDF
  containing only the word `"SOP"` yields `[]` and they fail honestly. The real
  fix is injecting a fake client, which also removes the quota dependency.

## Housekeeping

`GEMINI_API_KEY` is in gitignored `backend/.env` and appears in zero commits, but
it passed through a chat transcript. **Rotate it after the event.**

The audit log was cleared on 2026-08-12 and regenerated through the live API, so
every stored directive is Indonesian. The DB is local SQLite
(`backend/db.sqlite3`); `DATABASE_URL` is unset, so that clearing affected one
machine only.

Open decisions are in [HANDOFF.md](HANDOFF.md) §16. **Decision 4 is settled:**
directives are Indonesian, with Indonesian thousands separators and no em-dash.
The rest are not. Do not silently decide them.
