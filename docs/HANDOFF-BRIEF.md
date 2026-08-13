# VETO — Brief

Short version for a cold session. Full detail: [HANDOFF.md](HANDOFF.md).

**Deadline: 2026-08-13 23:55 WIB.** Demo and booth 2026-08-14.

> **Both halves are deployed and verified.**
> Frontend **https://veto-gold.vercel.app** · backend **https://veto-api-cgek.onrender.com**.
> [DEPLOY.md](DEPLOY.md) has the configuration as deployed, the traps already
> paid for, and the operational notes for demo day.
>
> **One thing is unset and it is now the critical path: `OPENAI_API_KEY` on
> Render.** See "What blocks the demo" below.

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

**Mock mode is gone** as of `c5a03b4`. The frontend talks to the API only, and
there is no offline path. It was never a whole fallback — Rule Studio's source
plate had no mock behind it — and the sleeping backend it existed for is now
handled by an external cron holding the Render service awake. Keep that cron
running for the whole event.

The dev server takes an assigned port when 5173 is busy. Safe because the
frontend calls `/api/v1` relative through the Vite proxy, so the browser sees
same origin and the backend's CORS pin on 5173 never applies in dev.

## Where it stands

| Surface | State |
|---|---|
| `/dispatch` | Built, **verified in production**. Opens with an empty form — only the DO number, carrying today's date. Client-side balance warnings kept deliberately (see [IMPECCABLE.md](IMPECCABLE.md)). |
| `/audit` | Built, **verified in production**. Closes with an honest `Menampilkan N dari M`. |
| `/rule-studio` | Built, **verified in production** — upload, triage, extract, source plate, rule register |
| Backend | All endpoints respond in production. **31 of 38 tests pass; 7 Rule Studio tests error and did so before any of today's work.** `engine.py` carries Smart Directives and the gross-vs-axle integrity check. |

**The "38/38 passing" claim in earlier revisions of this document was wrong.**
Verified by stashing the newest migration and re-running: the seven
`apps.rules.tests.test_rule_studio` errors are pre-existing and unrelated to
anything shipped today.

Frontend is feature-complete for the demo. The next piece of frontend work is
designed but not built — see "Next task".

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

1. **The CLIENT rule pack is now deliberately ABSENT.** `65bc380` seeded it;
   migration `0008` (`e6f59b4`) removes it again, on the owner's instruction, so
   the demo has to earn it: upload the SOP in Rule Studio, approve it, and only
   then does 23.000 kg on a `1.2.2` flip from PASS to HOLD reading `[ SOP KLIEN ]`.
   Verified in production: 23.000 kg currently **passes**.

   This deleted the safety net that made the closing beat work with no setup.
   **That is why `OPENAI_API_KEY` is now blocking rather than optional** — without
   it, extraction falls back to a placeholder and the beat never lands.

   `contract/validate.response.hold.json` moved with it: its two `CLIENT`
   violations became one `CENTRAL` one, because the fixture described a database
   that no longer exists and the backend contract tests caught the drift.

2. **The `Asumsi` thresholds are correct in production and still wrong on this
   laptop.** Iqbal removed the word (`a908ef7`) and corrected the numbers
   (`d9e4a12`, tandem 16000 → 18000). Both edited `0002`, which was already
   applied, and **Django never re-runs an applied migration**. Production was
   migrated from scratch and therefore has the corrected values; this machine's
   SQLite does not.

   Observed side by side today: the same rule renders **18.000 kg** in
   production and **16.000 kg** locally. **This is the concrete reason to demo
   from the deployed URL.** No longer blocking; an `0009` data migration would
   still be needed if any existing database ever mattered.

   Whether 18000 is right under PP 55/2012 remains unverified against the
   Lampiran — human task, an agent must not pick values.

3. **`OPENAI_API_KEY` is still set nowhere, and it is now blocking.** Iqbal
   migrated extraction to OpenAI (`9ffd8b5`), so the old Gemini quota is moot.
   But with no key, extraction always falls back to a placeholder — and since
   the client SOP rules were removed (item 1), that fallback is now the only
   thing standing between the demo and its closing beat. It belongs in Render's
   dashboard and in a gitignored `backend/.env`. **Never in a `VITE_` variable.**

4. ~~Nothing is deployed~~ **Done 2026-08-13.** Both halves live and verified by
   request against production. See [DEPLOY.md](DEPLOY.md).

## Next task

**1. Set `OPENAI_API_KEY` on Render, then rehearse the full loop once on the
deployed URL** — upload the SOP, approve it, return to `/dispatch`, enter
23.000 kg, confirm it flips to HOLD. This is the only way to know extraction
actually reads 22.000 kg out of the document. Everything else is secondary.

**2. Build the dispatch flow redesign.** Designed and approved with the owner,
not yet written: gross weight becomes derived and locked, a shared `Dialog`
shell fixes the focus defects once, a `PassDialog` mirrors the HOLD dialog, and
`Cetak Surat Jalan` becomes a preview dialog. Full spec, including the
`DESIGN.md` reversal it requires:
**[docs/superpowers/specs/2026-08-13-dispatch-flow-design.md](superpowers/specs/2026-08-13-dispatch-flow-design.md)**

Then, in priority order:

3. **The seven failing Rule Studio tests.** Pre-existing, never green today.
   Backend lane.
4. **Fix `0007`'s `get_or_create`** to key on `(domain, origin, version)` rather
   than `id`. Harmless on a fresh deploy, crashes `migrate` on any database where
   a client rule was approved through the UI. Backend lane.
5. **Design findings still open** — accessibility, touch targets, and the fact
   that no surface records *who* approved a rule. See [IMPECCABLE.md](IMPECCABLE.md).
6. **Verify the two thresholds against PP 55/2012's Lampiran.** Human only.
7. **`backend/api-contract.md`** is a stale tracked duplicate of the root file.

### Shipped 2026-08-13, afternoon (`6590130`..`8698e95`)

- **Deployed.** Render Blueprint for the API and Postgres, Vercel for the
  frontend, CORS wired. [DEPLOY.md](DEPLOY.md).
- **The dispatch form opens empty** — only the DO number, carrying today's date.
  A form that opens holding a weight reads as a rigged demo.
- **The client SOP pack is unseeded** via migration `0008`, with the contract
  fixture resynced to match.
- **`Ctrl+P` no longer prints a waybill for a held load.** The printable block
  rendered under print media unconditionally, so disabling the button locked the
  click and nothing else. Found by an Impeccable critique of the deployed app,
  verified against production before and after.
- **The rule register no longer clips its thresholds on a phone**, and the audit
  trail no longer renders 50 of 56 records in silence.

Design review state, scores and what remains open: **[IMPECCABLE.md](IMPECCABLE.md)**.

### Shipped 2026-08-13, morning (`3955310`..`56a9f3f`)

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
