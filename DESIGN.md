# DESIGN.md — VETO

The visual system. Written before the UI so it is a decision, not a description of whatever got built.

Read with `docs/ENGINEERING.md` §7 (design direction, banned patterns) and `PRODUCT.md` (what each surface is for).

---

## 0. Design read

Product UI — a dispatch console, a document review surface, and an audit trail — for Indonesian warehouse operators and compliance staff, judged in a 7-minute demo and touched by strangers at a booth.

**Dials:** `DESIGN_VARIANCE 4` · `MOTION_INTENSITY 4` · `VISUAL_DENSITY 7`

Variance is low because this is a tool, not a landing page: an operator must find the same control in the same place every time. Density is high because the numbers *are* the product. Motion is low and reserved.

No off-the-shelf design system. Tailwind v4 tokens, defined here.

> Landing-page composition rules are out of scope here — this is dense product UI. What carries over from that discipline is the part that applies to any surface: the AI-tell list, the colour and shape locks, and the contrast checks. Everything visual is reviewed against the rendered app, not the code.

---

## 1. Two systems in one window

VETO is middleware. The design has to make that legible, so the app is two products sharing a shell.

```
┌────────────────────────────────────────────────┐
│  [ Client ERP ] [ VETO ]                       │  ← shell: switching only
├────────────────────────────────────────────────┤
│                                                │
│   Client ERP              VETO                 │
│   /dispatch               /rule-studio         │
│                           /audit               │
└────────────────────────────────────────────────┘
```

**Client ERP is deliberately unremarkable.** Ordinary warehouse software: light, plain, slightly dated, no personality. This is not laziness. `PRODUCT.md` F2 is explicit that the officer should not have to learn a new interface, and the only way to *show* that is to make the host system look like software they already suffer through.

**VETO is the instrument.** When VETO speaks inside the ERP — the verdict panel — it does not adopt the ERP's styling. It arrives as a different material, clearly not part of the host. That contrast is the product demo.

The verdict surface is **white, not graphite**. Graphite was tried and rejected: a dark block dropped into a light enterprise page read as a foreign widget rather than an intervention, and it fought the page instead of interrupting it. VETO is now distinguished from the host by being *cleaner* than it — the ERP is grey, boxy and crowded; VETO's panel is white, quiet, hairline-ruled, and carries mono citations and a single amber marker. Same argument, calmer execution.

**Switcher:** a segmented control in the shell, top left. Instant swap, no transition. It is visible at all times so a judge never has to be told there are two systems.

The shell carries **nothing else**. Who is signed in belongs to the system they are signed into, so the operator's name sits in the NUSANTARA WMS chrome, not in the bar that switches between products.

The old green-sidebar / navy-sidebar coding from the proposal is retired. The two systems are distinguished by **density and material**, not by hue.

**The ERP's chrome is a left rail, not a top bar.** It was a green product strip
with a white text tab row beneath it; both are now one 64px green rail carrying
the brand mark, five nav icons, and the operator. That is the shape warehouse
and logistics consoles actually take, and it buys back two horizontal bars of
vertical space on the surface where the dispatch form and the load envelope both
live. This is not a return to the retired coding above: that rule is about never
distinguishing *VETO from the host* by hue, and this is the host's own green
relocated within its own surface. VETO's side of the app gains no rail, and no
green beyond the verdict marker permitted in §4 — the host's green is a
*surface*, VETO's is a 12px square. If they ever start reading as the same
thing, the square is what moves.

The rail's items are **inert**. There is no Beranda or Laporan to route to, so
they are `span`s with the default cursor, never links to dead ends. They lift on
hover and reveal a label flyout anyway, because the host has to feel like live
software rather than a screenshot, and because an icon-only rail has no other
way to tell a booth visitor what its icons mean.

---

## 2. Typography

**Archivo** for VETO's language and quantity. **JetBrains Mono** for machine references. **SAP 72** for the client ERP surface only.

```bash
npm --prefix frontend install @fontsource-variable/archivo @fontsource-variable/jetbrains-mono
```

Self-host both. Never `<link>` to Google Fonts.

### Why Archivo, measured rather than asserted

Candidates compared on the metrics that actually matter for a dense, numeric, 1.5-metre-legible interface. `x-height/em` drives small-size legibility, `width(n)` drives how much fits in a row, `tnum` decides whether numbers can hold a column at all.

| Face | x-height/em | x/cap | width `n` | `tnum` |
|---|---|---|---|---|
| Poppins | 0.548 | 0.785 | 0.640 | **no** |
| Inter | 0.546 | 0.750 | 0.591 | yes |
| **Archivo** | 0.526 | 0.767 | 0.584 | **yes** |
| Public Sans | 0.517 | 0.715 | 0.561 | yes |
| IBM Plex Sans | 0.516 | 0.739 | 0.568 | **no** |
| Lato | 0.506 | 0.707 | 0.558 | yes |

Archivo wins on the combination: near-top x-height, a high x/cap ratio so lowercase holds up beside capitals, a narrow set width for dense rows, real tabular figures, and a **variable width axis** so header hierarchy can come from width instead of only size. It is a working grotesque, not a branding face.

Rejected, with reasons on the record:

- **Poppins** — widest of the set by 10%, and no tabular figures. A geometric display face doing a data job.
- **Lato** — has `tnum`, but the lowest x-height *and* lowest x/cap here, which is exactly the small-size weakness this interface cannot afford. Also one of the most-used web fonts since the Bootstrap era, so it carries template baggage.
- **IBM Plex Sans** — the institutional fit was appealing and the Plex superfamily would have covered both roles, but it ships no tabular figures. Disqualifying.
- **Inter** — metrically fine, and discouraged as a default by `docs/ENGINEERING.md` §7 for good reason. It is the house style of every AI-generated interface.

Changing this is one CSS variable. If Archivo reads wrong at real sizes, Public Sans is the next pick.

### Why JetBrains Mono

The mono only has to survive identifiers and citations at 11–13px, so x-height decides it. Both candidates mark the zero, so `0` and `O` are safe either way.

| Mono | x-height/em | x/cap | advance |
|---|---|---|---|
| **JetBrains Mono** | **0.550** | **0.753** | 0.600 |
| IBM Plex Mono | 0.516 | 0.739 | 0.600 |

Same advance width, so no density cost, and 7% more x-height where it matters most. IBM Plex Mono was the earlier pick only because the Plex superfamily would have covered both roles at once. Plex Sans ships no tabular figures, that plan collapsed, and the mono lost the one argument that was holding it up.

### SAP 72, for the host ERP only

The client ERP runs **SAP 72**, the actual SAP Fiori typeface, obtained from
[`SAP/theming-base-content`](https://github.com/SAP/theming-base-content) under
Apache-2.0. Regular, Semibold and Bold are vendored in
`frontend/src/assets/fonts/` with the licence and a notice.

It is there because the host is supposed to read as ordinary enterprise
software the officer already uses, and nothing signals that faster than the
typography of an actual ERP. Segoe UI and SF Pro were both considered and both
ruled out on licence: Segoe cannot be self-hosted, and Apple's licence permits
SF Pro on Apple platforms only, never the web.

It drops in cleanly because it is metrically almost identical to Archivo:

| | x-height | x/cap | width `n` | `tnum` |
|---|---|---|---|---|
| SAP 72 Semibold | 0.528 | 0.767 | 0.588 | yes |
| Archivo | 0.526 | 0.767 | 0.584 | yes |

**Weight, and the register trap.** The SAP reference people reach for is
sap.com's marketing hero: 72 at Bold or Black on a 56px headline. SAP Fiori's
actual product screens look nothing like it, and copying the marketing register
into a product bar makes the host read as a landing page rather than as
software. The ERP brand and the page heading sit at **Bold 700** with tightened
tracking, which is as far as product UI should go. 72 Black exists in the SAP
repository and is deliberately not vendored, because nothing here should be
set at display weight.

**Scope is strict.** 72 covers the NUSANTARA WMS chrome and the dispatch form.
VETO never uses it: the verdict panel and the HOLD dialog pin themselves back to
Archivo even though they render inside the ERP's tree. One face per system is
the cleanest expression of the two-systems idea.

**No monospace in the ERP chrome.** Mono set uppercase with wide tracking is a
terminal signature. No shipping ERP uses it, and it was the single thing making
the host read as robotic rather than corporate.

A VETO-side replacement for Archivo is still open.

### Verified on screen, not only in the metrics

The tables above come from the font binaries. The choice was then confirmed by rendering all three sans candidates at real sizes, on `--ink-900`, with real content: `TAHAN` at 32px, an Indonesian directive at 15px, a three-row tabular column at 14px, and a citation at 11px.

What the render added that the numbers did not: **Lato is visibly the most delicate of the three on a dark ground.** Light text on dark optically thins, so Lato would need a weight step up everywhere just to hold parity — a permanent tax. Archivo held its stems at every size and stayed the most compact at display weight.

### The two roles

**Archivo with `tabular-nums`** carries language *and* quantity: headings, labels, body, buttons, form values, table columns of weights and dimensions.

**JetBrains Mono** carries only what is machine-generated and needs character-level alignment: decision IDs, dispatch refs, legal citations, timestamps, rule pack versions, latency.

```
Archivo   Berat Kotor · 24.500 kg · Kurangi muatan sumbu belakang · Cetak Surat Jalan
JBMono    PM 60/2019 Pasal 3 · DO-2026-08-11-0042 · v3 · 41 ms · 14:32:10
```

A second type family has to earn its place with a role no other family can perform. JetBrains Mono earns it: `DO-2026-08-11-0042` and a column of pasal references only stay scannable when every character occupies the same width. Numbers alone do not need it, because Archivo's `tnum` already holds the column.

Always set `font-variant-numeric: tabular-nums` on any numeric. A weight that shifts column position as it changes reads as unstable, and this product's whole claim is that it is not.

### Scale

| Token | Face | Size / line | Tracking | Use |
|---|---|---|---|---|
| `display` | Archivo 600 | 32 / 36 | -0.02em | Verdict word only |
| `h1` | Archivo 600 | 24 / 30 | -0.015em | Surface title |
| `h2` | Archivo 500 | 18 / 24 | -0.01em | Section |
| `body` | Archivo 400 | 15 / 23 | 0 | Prose, directives |
| `label` | Archivo 500 | 13 / 16 | 0.01em | Field labels |
| `data-lg` | Archivo 500 | 22 / 26 | -0.01em | Primary readouts, `tnum` |
| `data` | Archivo 400 | 14 / 20 | 0 | Table quantities, `tnum` |
| `mono` | JBMono 400 | 13 / 18 | 0 | Identifiers, citations |
| `mono-xs` | JBMono 400 | 11 / 16 | 0.03em | Meta, timestamps |

Body copy caps at `65ch`. Directives are prose and obey it.

### Dark-surface compensation

Light text on the graphite ground optically thins. On instrumentation surfaces, compensate on all three axes rather than one: `+1` step of line height, `+0.005em` tracking, and one weight step up where the face needs it (`400 → 500` for body). Do not compensate by raising size — the scale is already tight and the grid depends on it.

---

## 3. Two densities, one family

Both surfaces use the same two typefaces, the same 4px spacing rhythm, and the same 2px radius. They differ in ground, air, and rule weight.

### Instrumentation — `/dispatch` verdict, `/audit`

Dark graphite ground. Rows tight. Values large and mono. Hairline separators, no cards. Reads like equipment: a weighbridge terminal, a dispatch console.

Vertical rhythm `8px`, section gap `24px`. Data rows `32px` tall. No container has a shadow.

### Register — `/rule-studio`

Light ground. Generous measure. Hairline rules. Citations set as legal references. The source document page is treated as a plate: bordered, captioned, given room.

Vertical rhythm `12px`, section gap `40px`. Body at `65ch`.

### Client ERP — the host

Light, plain, functional. System-default feel, standard form density, nothing distinctive. It should look like it was built in 2016 by someone in a hurry, because that is the honest picture of the software VETO integrates with.

---

## 4. Colour

One accent. Graphite everywhere else. Locked across every surface.

### Graphite ramp

```css
--ink-950: #0E1013;  --ink-900: #14171A;  --ink-800: #1B1F23;
--ink-700: #262B31;  --ink-600: #363C44;  --ink-500: #4C545E;
--ink-400: #6C757F;  --ink-300: #98A0A9;  --ink-200: #C4CAD0;
--ink-100: #E3E7EA;  --ink-50:  #F4F6F7;  --paper:   #F7F8F8;
```

### The accent

```css
--hold:     #F2A93B;  /* amber. HOLD only. Dark surfaces. */
--hold-ink: #8A5200;  /* amber, darkened for light surfaces */
```

Measured contrast:

| Pair | Ratio | Verdict |
|---|---|---|
| `--hold` on `--ink-900` | **9.0:1** | AAA |
| `--ink-100` on `--ink-900` | **14.5:1** | AAA |
| `--ink-300` on `--ink-900` | **6.8:1** | AA body, AAA large |
| `--ink-900` on `--paper` | **16.9:1** | AAA |
| `--hold-ink` on `--paper` | **6.0:1** | AA |

`--hold` on a light ground is **1.9:1**. It fails. On the register surface, amber is `--hold-ink` or it is not text.

### PASS is a marker, not a celebration

**Revised 2026-08-13 by the product owner.** This section previously read "PASS
has no colour" and refused green in three places. It was overruled deliberately,
not overlooked, and the original reasoning is kept below because it is still the
reason the new rule is drawn as narrowly as it is.

**The rule now:** PASS carries `--color-pass` `#2f8f4e` as a **marker only** —
the 12px square beside `LOLOS` in `VerdictPanel`, and the same square in
`PassDialog`. It behaves exactly as `--hold` does: 4.07:1 on white, which clears
the 3:1 a graphical object needs and misses the 4.5:1 text needs, so the verdict
word itself stays `--ink-900`. No green tick, no green panel, no green text, no
badge. The green is the one the `TruckEnvelope` already uses for "fits within
the legal envelope," so one hue carries one meaning across the whole surface.

**What was given up, recorded once.** Green in this product belongs to the host
ERP — its 64px rail and its `#2d613b` submit button. A contrast audit of the
deployed app measured VETO and the host at 0.07 of border contrast apart; they are
already hard to read as two systems. A green VETO verdict has VETO speaking the
host's colour at the moment it should read most clearly as a separate
instrument. The owner weighed that and chose the legibility of the verdict.

**The original argument, preserved:** amber means HOLD and nothing else; PASS is
not celebrated, it resolves; real safety systems do not congratulate you for
normal operation, they scream when something is wrong, and amber stays
meaningful because it is rare.

**PASS is still signalled by the gate opening.** `Cetak Surat Jalan` is disabled
until the engine says yes. That functional change remains the primary signal —
but it sits about 1,180px from where the operator is looking after a submit, so
since 2026-08-13 the verdict also announces itself in `PassDialog`, mirroring
how a HOLD announces itself in `ViolationDialog`.

Decided on 2026-08-13, in the dispatch-flow redesign.

### TruckEnvelope

`frontend/src/components/dispatch/TruckEnvelope.jsx`'s truck-outline widget uses
`#2f8f4e` (green) for "fits within the legal envelope," alongside `#a02a1f` for
"exceeds it." This was the first green in the product and, until the revision
above, the only one. It is now the source of `--color-pass` rather than an
exception to a rule forbidding it.

### The logo is the brand artwork, and it keeps its blue

`frontend/src/components/VetoMark.jsx` renders the real brand file, cropped to
the mark's own bounds from `frontend/src/assets/brand/`. **Do not redraw it.**

An earlier pass rebuilt the mark as hand-written SVG geometry in `currentColor`,
reasoning that the one-accent lock could not afford a second hue beside the
amber HOLD marker. The owner overruled it: the logo is the logo, and an
approximation of it — however close, and that one was close — is not the brand.
The gradient went missing in the redraw, which is the tell.

**This is a deliberate, owner-made exception to the one-accent lock, and it is
narrow.** Brand blue is permitted *only* as the logo artwork, at logo sizes, in
the three placements below. It does not become available as a UI colour: no blue
text, no blue borders, no blue states, no second accent anywhere. Amber still
means HOLD and nothing else.

The exception is affordable because of what the mark is and where it sits. It is
artwork at 12–14px carrying identity, not a status signal, and nothing else on
those surfaces competes for the same reading. The amber marker is a filled
square against a verdict word; the logo is a gradient wordless mark at the panel
head. They are not confusable.

Because it is artwork rather than a glyph, it does not take the ink of its
surface. **Do not pass text-colour classes to `VetoMark`** — they do nothing.

Three placements:

- head of the verdict panel, where the handover from the host ERP to VETO happens
- head of `VetoLayout`'s sub-nav, so Rule Studio and Jejak Audit both carry it
  without either page drawing its own
- `frontend/public/favicon.png`, padded square so a browser tab does not crop it

Both in-product placements set the word *VETO* in type beside the mark, so the
mark-only crop is the correct asset there. `veto-logo.png` is the full lockup
including the wordmark, for anywhere with room to give it — it is currently
unused in the product.

### Rule origin

`CENTRAL` and `CLIENT` must be distinguishable, and the one-accent lock means not with a second hue. Distinguish by form:

- `CENTRAL` — plain mono citation: `PM 60/2019 Pasal 3`
- `CLIENT` — bracketed and letterspaced: `[ SOP KLIEN ] Gudang Cikarang v2 §3.1`

The citation text already says which is which. The bracket makes it scannable in a column.

### Theme

The page theme is locked per surface and does not flip mid-scroll. Instrumentation is dark, register is light, and that is a property of the surface, not a user toggle. No dark-mode switch in the MVP — adding one doubles the QA surface for zero demo value.

---

## 5. Shape and space

**Radius: `2px`. Everywhere.** Inputs, buttons, panels, the segmented control. No pills, no `rounded-xl`, no mixed system. Instruments have square corners.

**Spacing: 4px base.** `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`. Nothing off-scale.

**No cards.** Group with `border-t`, `divide-y`, and negative space. A card inside a card is banned outright. Elevation is reserved for the one thing that genuinely floats: the override dialog.

**No shadows on the dark surface.** Separation comes from ground steps (`--ink-900` beside `--ink-800`) and hairlines in `--ink-700`.

**Grid:** 12 columns, `max-w-[1400px]`, gutter `24px`. Below `768px` everything collapses to one column at `px-16`.

---

## 6. Motion

Three things animate. Everything else is instant.

| Moment | Change | Duration | Easing |
|---|---|---|---|
| Verdict dialog opens | backdrop blur in, panel `opacity 0→1` `scale 0.98→1` | 180ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Dialog settles to the side | dialog fades, side panel slides in from the right | 240ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| HOLD → PASS on resubmit | ground settles, gate unlocks | 240ms | same |
| Rule Studio stage reveal | each stage resolves in turn | 400ms per stage | same |

Each earns its place: the verdict animates because something arrived, the transition animates because a state genuinely changed, the reveal animates because it is showing work happening. Nothing animates to look impressive.

Only `transform` and `opacity`. No `window.addEventListener('scroll')`.

`prefers-reduced-motion: reduce` collapses all three to opacity-only at 0ms. The Rule Studio reveal becomes a plain progress list.

---

## 7. Copy

**Indonesian for the interface. English for domain terms and API payloads.** `Berat Kotor`, `Muatan Sumbu`, `Cetak Surat Jalan` — but `ODOL`, `JBI`, `axle_config`, `PASS`, `HOLD`.

**Directives render verbatim from the server.** Never compose directive text on the frontend. `api-contract.md` §1.

**Never claim what VETO cannot do.** It validates *declared* figures, not weighed ones. Say so somewhere quiet and honest on the dispatch surface. Nothing may imply guaranteed compliance, eliminated error, or reduced incidents.

**Banned numbers.** These appear in the proposal deck and must not appear in the product: 94% faster verification, 22% higher compliance, 83% fewer errors, 80% fewer overloaded dispatches, 65% fewer incidents, 93% faster audit prep. The mentor asked where they came from and there is no answer. The only figures permitted are the two sanctioned sets in `docs/ENGINEERING.md` §5, labelled as what they are.

**No fabricated citations.** Every article reference on screen comes from a verified seeded rule.

**Zero em-dashes in anything a user sees.** Labels, headings, body, buttons, directives, error text, alt text. Use a period, a comma, or a regular hyphen. The rule covers the shipped interface, not the repo's own prose, so this file and the plans are exempt.

---

## 8. Banned

From `docs/ENGINEERING.md` §7, plus what this system specifically rejects:

- Green tick / green success state / green panel / green verdict text. PASS is
  quiet. The one permitted green is `--color-pass` as a marker square beside the
  verdict word — see §4, "PASS is a marker, not a celebration."
- A third accent colour, anywhere.
- Purple or blue gradients.
- Cards inside cards. Generic dashboard card grids.
- Glassmorphism.
- Pills and heavily rounded containers.
- Inter as the UI face.
- Decorative status dots.
- Section-number eyebrows (`01 / DISPATCH`).
- Modal dialogs that **dismiss** a compliance result. A HOLD may *announce* itself in a dialog over a blurred backdrop, because dismissing that dialog clears nothing: the violations stay inline under the offending fields, the verdict stays in the side panel, and *Cetak Surat Jalan* stays locked until a fresh evaluation returns PASS. What is banned is a dialog whose close button is the end of the story.
- Spinners. Async states show discrete stages or skeletons that match the final shape.
- Fake precision. Every number on screen traces to a real response field.

---

## 9. Open

- Archivo at `label` size (13px) needs checking on a real screen at 1.5 m. If it is soft, the fix is weight `500`, not size — the scale is already tight and the grid depends on it.
- The metrics above come from the font binaries, not from documentation. They predict legibility; they do not prove it. Nothing here substitutes for looking at the rendered thing, which is why every frontend task ends in browser verification rather than a passing build.
- Archivo's width axis is available but unused so far. Narrow widths for dense table headers are the obvious first application. Do not reach for it until a real screen shows the need.
- `--hold` amber has not been checked against amber-blind vision. HOLD never relies on colour alone (it carries a directive, a locked button, and a changed panel state), so this is a robustness question rather than a correctness one.
