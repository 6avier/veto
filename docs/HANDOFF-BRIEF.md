# VETO — Brief

Short version for a cold session. Full detail: [HANDOFF.md](HANDOFF.md).

**Deadline: 2026-08-13 23:55 WIB.** Demo and booth 2026-08-14.

> **If you are picking this up to deploy, go straight to [DEPLOY.md](DEPLOY.md).**
> Every config file is written, committed and verified locally. Nothing has been
> deployed yet. That document has the current state, the decisions already made,
> the remaining steps in order, and the traps.

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
cp backend/.env.example backend/.env      # then add OPENAI_API_KEY
uv run --directory backend python manage.py migrate
uv run --directory backend python manage.py runserver 8000

cp frontend/.env.example frontend/.env.local
npm --prefix frontend install && npm --prefix frontend run dev
```

Verify with `manage.py test apps`, `npm --prefix frontend run lint`, and
`npm --prefix frontend run build`. **There is no typecheck** — the frontend is
plain JavaScript.

`VITE_USE_MOCKS=true` runs the whole frontend with no backend, and **works
again** as of `e15ea75`. Verified: MOCKS badge appears, the rule register still
renders its 15 rules from `contract/rules.list.json`, no request leaves the
page. Mocks are the booth fallback; keep them working. `frontend/.env.local` is
currently `false`.

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

**Extraction now runs on OpenAI**, not Gemini (Iqbal, `9ffd8b5`). That removed
the old 20-calls-per-day Gemini quota, which was what made the test suite look
non-deterministic — it was rate limiting, not randomness.

**But `OPENAI_API_KEY` is set nowhere**, so extraction always falls back today.
With no key configured, `views.py` used to return zero candidates with
`used_fallback: false`, which made the UI say *"no payload clauses in this
document"* about a document nothing had read — at a booth, that would have been
the answer to every upload. An unset key now routes through the honest fallback
path instead. Set the key on Render to get real extraction.

The fallback is deliberately honest now: tagged `cadangan` /
`belum-diverifikasi`, never `gemini-extracted`, and its excerpt says extraction
was unavailable instead of posing as a quotation. Its threshold is a
placeholder. **Do not make it invent a figure again** (`CLAUDE.md` §5).

## What blocks the demo

0. ~~The mocks fallback does not exist~~ **Fixed 2026-08-13** (Iqbal, `e15ea75`,
   "restore VITE_USE_MOCKS env variable toggle"). Verified working: with the
   flag on, the MOCKS badge shows and no request reaches the API.

1. ~~No CLIENT rule pack is seeded~~ **Done 2026-08-13** (Iqbal, `65bc380`).
   **Verified end to end** on this machine: 23.000 kg on a `1.2.2` is legal
   nationally (24.000) but HOLDs against the client SOP (22.000) and reads
   `[ SOP KLIEN ]`. The closing beat works.

2. **The `Asumsi` thresholds are corrected in the migrations but NOT in this
   machine's database.** Iqbal removed the word (`a908ef7`) and corrected the
   numbers (`d9e4a12`, tandem 16000 → 18000, gross 25000 → 24000). Both edited
   `0002`, which was already applied, and **Django never re-runs an applied
   migration**, so the local DB still shows 16000 and still renders `Asumsi` on
   screen. A fresh database gets the corrected values. Needs an `0008` data
   migration for existing databases. Whether 18000 is right under PP 55/2012 is
   still unverified against the Lampiran — human task, an agent must not pick
   values.

3. ~~Gemini quota~~ **Moot.** Iqbal migrated to OpenAI (`9ffd8b5`). But
   **`OPENAI_API_KEY` is not set anywhere**, so extraction currently always
   falls back. See "Read this before touching Rule Studio".

4. **Nothing is deployed** — but all the config now exists and is verified.
   **See [DEPLOY.md](DEPLOY.md) for exactly where that stands and what is left.**

## Next task

**Deploy. That is the whole list.** No frontend work is outstanding, and
[DEPLOY.md](DEPLOY.md) has the step-by-step.

After that, in priority order:

1. **`0008` data migration** so existing databases get the corrected thresholds
   (item 2 above). Backend lane.
2. **Fix `0007`'s `get_or_create`** to key on `(domain, origin, version)` rather
   than `id`. Harmless on a fresh deploy, crashes `migrate` on any database
   where a client rule was approved through the UI. Backend lane.
3. **Verify the two thresholds against PP 55/2012's Lampiran.** Human only.
4. **`backend/api-contract.md`** is a stale tracked duplicate of the root file.

### Shipped 2026-08-13 (`3955310`..`56a9f3f`)

- **Illustrated truck envelope** on `/dispatch`: cab, wheels, panel lines, door seam, a cargo deck, whole-vehicle green/red. Both cabs live in the box's own millimetre space; the top-view wheels are static at the legal envelope's rear.
- **ERP chrome is a left icon rail** — the green strip and the white tab row are gone. Inert icons that lift on hover with a label flyout.
- **Rule Studio reviews every extracted candidate**, not just the first, with the source plate following the active candidate's page.
- **Logo mark** in the verdict panel, the VETO sub-nav, and the favicon.

Every visual change was verified in a real browser, and it mattered: two SVGs
letterboxing apart, a spring driving `height` negative (~150 console errors per
keystroke), and wheels reversing into the cab were all invisible from source and
all shipped-green on `npm run build`.

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

`GEMINI_API_KEY` passed through a chat transcript. It is no longer used
(migrated to OpenAI in `9ffd8b5`) but **revoke it after the event** rather than
leaving a live unused key around.

`OPENAI_API_KEY` is currently set nowhere. It belongs in Render's dashboard and
in a local gitignored `backend/.env` — **never in a `VITE_` variable**, since
those are baked into the public client bundle.

The audit log was cleared on 2026-08-12 and regenerated through the live API, so
every stored directive is Indonesian. The DB is local SQLite
(`backend/db.sqlite3`); `DATABASE_URL` is unset, so that clearing affected one
machine only.

Open decisions are in [HANDOFF.md](HANDOFF.md) §16. **Decision 4 is settled:**
directives are Indonesian, with Indonesian thousands separators and no em-dash.
The rest are not. Do not silently decide them.
