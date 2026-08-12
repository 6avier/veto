# Truck Envelope Illustrated Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `TruckEnvelope.jsx`'s plain-rectangle rendering with an illustrated truck (cab, wheels, panel lines) in both the top-down and side views, keeping the existing geometry engine, data flow, and placement untouched.

**Architecture:** Each view (`PlanView`, `SideView`) becomes a **two-SVG layout**: a small, fixed-viewBox SVG for the cab (decorative, never animates, own local coordinate system — no scaling math against the mm-based canvas needed) sitting beside the existing box SVG (unchanged coordinate system: still `lengthGeo.canvas` / `widthGeo.canvas` / `heightGeo.canvas` in real millimetres). This sidesteps compositing two different coordinate systems into one `viewBox` — a plain CSS flex row keeps them visually adjacent, and because both share the same row height, their vertically-centered (or bottom-anchored) content lines up without a transform.

**Tech Stack:** React 19, Tailwind v4, Motion (`motion/react`, already a dependency).

Design reference: [`docs/plans/2026-08-12-truck-envelope-illustrated-design.md`](2026-08-12-truck-envelope-illustrated-design.md).

## Global Constraints

- **Frontend-only.** No `backend/` file changes.
- **`axisGeometry()`'s contract for `PlanView`'s two axes (length, width) does not change** — it stays centered (a load sitting centered left-right on the bed is correct). Only `SideView`'s height axis changes from centered to bottom-anchored (Task 2) — that change is computed locally in `SideView`, `axisGeometry` itself is untouched so `PlanView` is unaffected.

  > **AMENDED during execution (Task 4), with 6avier's agreement.** Length is
  > **left-anchored**, not centered. Once `PlanCab` is drawn at the front, a
  > centered box renders the cargo body floating behind the cab whenever the
  > load is under the legal max, with the gap opening and closing as the
  > operator types — the same failure Task 2 fixes for height. `PlanView` now
  > draws the inner box at `x = lengthGeo.outerOffset` and its `viewBox`
  > starts at `outerOffset` rather than 0 (the canvas's leading padding only
  > needs to exist at the back, where overflow renders). **Width is still
  > centered** — a body does sit centred on its chassis. `axisGeometry` is
  > still untouched; this is computed locally in `PlanView`.
  >
  > **Task 7 depends on this:** its `boxRight` must be
  > `lengthGeo.outerOffset + lengthGeo.innerSize`, not
  > `lengthGeo.innerOffset + lengthGeo.innerSize`.
- **No new npm dependency.** Motion is already installed.
- **Colour:** `#2f8f4e` (green) when every dimension fits, `#a02a1f` (existing convention, unchanged) the moment any dimension is over. This is a confirmed, deliberate override of `DESIGN.md` §4's "VETO never uses green" — Task 1 patches `DESIGN.md` §4 with a short recorded exception, scoped to this file only.
- **Only the box outline and the rear wheel-hint pair (top-down) get Motion spring animation** (`SPRING = { type: 'spring', stiffness: 90, damping: 12 }`, already defined, unchanged). Panel lines and every other detail recompute from plain (non-animated) geometry each render and snap — this is a deliberate scope cut recorded in the design doc §6, not a shortcut to relitigate.
- **`vectorEffect="non-scaling-stroke"` on every stroked shape** inside the mm-scale box SVGs (unchanged existing convention — without it, strokes render sub-pixel/invisible at real render scale). The cab SVGs use small, human-scale local viewBoxes (roughly 0–100 units), so this is optional there but keep it for consistency — cheap and harmless either way.
- **No frontend test runner** (`CLAUDE.md` §4, deliberate). Verification is browser-only, and **every visual task in this plan includes a mandatory self-verification screenshot pass** (Playwright + headless Chromium, installed to a scratch dir — no project dependency added) — not deferred to a human pass at the end. The design doc §7 is explicit about why: hand-computed SVG coordinates produced several real bugs during brainstorming (floating disconnected elements, misaligned centering, inconsistent per-state offsets) that were invisible reading the source and only caught by actually looking at a rendered screenshot.
- **Component style:** default export first, local non-exported helpers below it (existing file convention, `docs/HANDOFF.md` §18).
- **Coordinates in this plan are a validated starting point, not gospel.** Every visual task ends with an explicit self-verification checklist. If something looks wrong once actually rendered, adjust the constants — the design doc's own hard-won lesson is that rendered pixels are the authority, not hand arithmetic.

---

## File structure

| File | Responsibility |
|---|---|
| `frontend/src/components/dispatch/TruckEnvelope.jsx` | *(modified, every task)* — the whole widget |
| `DESIGN.md` | *(modified, Task 1)* — records the green colour exception |

No new files. The component file grows substantially (roughly 180 → ~420 lines by the end) but stays under the size of comparable existing files in this codebase and the added content is one component's worth of decoration — see the design doc's own reasoning in §2 for why a split isn't warranted (nothing here has a second consumer).

---

### Task 1: Green for "fits", recorded as a DESIGN.md exception

**Files:**
- Modify: `frontend/src/components/dispatch/TruckEnvelope.jsx:28` (the `NEUTRAL_COLOUR` constant)
- Modify: `DESIGN.md` (§4, after the "PASS has no colour" subsection)

**Interfaces:**
- Produces: `NEUTRAL_COLOUR` now `'#2f8f4e'` (was `'#1f2933'`). Every later task that reads `NEUTRAL_COLOUR`/`OVER_COLOUR` gets the new value automatically — no other task needs to know this changed.

- [ ] **Step 1: Change the constant**

In `frontend/src/components/dispatch/TruckEnvelope.jsx`, change:

```jsx
const NEUTRAL_COLOUR = '#1f2933'
```

to:

```jsx
const NEUTRAL_COLOUR = '#2f8f4e'
```

- [ ] **Step 2: Record the exception in `DESIGN.md`**

In `DESIGN.md`, immediately after the "PASS has no colour" subsection (after the paragraph ending "...the thing the operator wants is suddenly available." and before "### Rule origin"), add:

```markdown
### Exception: TruckEnvelope

`frontend/src/components/dispatch/TruckEnvelope.jsx`'s truck-outline widget uses
`#2f8f4e` (green) for "fits within the legal envelope," alongside the existing
`#a02a1f` for "exceeds it." This is a deliberate, scoped override of the two rules
above, confirmed by the product owner after the conflict was raised explicitly.
It does not license green anywhere else — `PASS has no colour` and `VETO never
uses green` still govern every other surface, including `VerdictPanel` a few
lines away in the same page.
```

- [ ] **Step 3: Verify**

```bash
npm --prefix frontend run build
npm --prefix frontend run lint
```
Expected: both succeed, no errors. (The colour change alone won't be visually distinguishable from a plain rectangle yet — that's expected, this task is just the constant + doc.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dispatch/TruckEnvelope.jsx DESIGN.md
git commit -m "feat(dispatch): use green for the envelope's within-limit state

Deliberate, scoped override of DESIGN.md's no-green rule, recorded
there rather than left as a silent deviation."
```

---

### Task 2: Bottom-anchor the side view's height

**Why this is necessary, not optional:** the shipped `SideView` centers height growth (`(canvas - size) / 2`) rather than anchoring it to the ground. Once a cab and wheels sit at a fixed ground line (Tasks 3 and 6), any input under the legal max would show the box floating above the wheels instead of sitting on the bed — this was flagged as a deferred minor when the plain-rectangle version shipped, and is now a real prerequisite, not polish.

**Files:**
- Modify: `frontend/src/components/dispatch/TruckEnvelope.jsx` (`SideView`, currently lines 110–152)

**Interfaces:**
- Consumes: `heightGeo` from `axisGeometry(Number(height), limits.height?.threshold)` — unchanged shape (`{ canvas, legalSize, outerOffset, innerSize, innerOffset, over }`).
- Produces: `SideView` no longer reads `heightGeo.outerOffset` / `heightGeo.innerOffset` (both still exist on the object for `PlanView`'s sake, just unused here). Instead computes `outerY = heightGeo.canvas - heightGeo.legalSize` and `innerY = heightGeo.canvas - heightGeo.innerSize` locally. **`axisGeometry` itself is not modified** — `PlanView` keeps using `outerOffset`/`innerOffset` exactly as before.

- [ ] **Step 1: Change `SideView`'s two `y` reads**

In `frontend/src/components/dispatch/TruckEnvelope.jsx`, inside `SideView`, replace:

```jsx
        <rect
          x={0}
          y={heightGeo.outerOffset}
          width={SIDE_VIEW_NOMINAL_WIDTH_MM}
          height={heightGeo.legalSize}
```

with:

```jsx
        <rect
          x={0}
          y={heightGeo.canvas - heightGeo.legalSize}
          width={SIDE_VIEW_NOMINAL_WIDTH_MM}
          height={heightGeo.legalSize}
```

and replace:

```jsx
        <motion.rect
          x={0}
          width={SIDE_VIEW_NOMINAL_WIDTH_MM}
          initial={{ y: heightGeo.innerOffset, height: heightGeo.innerSize }}
          animate={{ y: heightGeo.innerOffset, height: heightGeo.innerSize }}
```

with:

```jsx
        <motion.rect
          x={0}
          width={SIDE_VIEW_NOMINAL_WIDTH_MM}
          initial={{ y: heightGeo.canvas - heightGeo.innerSize, height: heightGeo.innerSize }}
          animate={{ y: heightGeo.canvas - heightGeo.innerSize, height: heightGeo.innerSize }}
```

- [ ] **Step 2: Verify with a numeric check**

Run: `node -e "const canvas=4200*1.2; const legal=4200; const under=3000; const over=4600; console.log('outer y', canvas-legal); console.log('under-input y', canvas-under, 'bottom edge', (canvas-under)+under); console.log('over-input y', canvas-over, 'bottom edge', (canvas-over)+over); console.log('canvas (viewBox bottom)', canvas)"`

Expected output: the "bottom edge" values for both the under- and over-input cases equal `canvas` exactly (5040) — confirming every state's box bottom sits at the same ground line regardless of height, which is the whole point of this task.

- [ ] **Step 3: Build check**

```bash
npm --prefix frontend run build
npm --prefix frontend run lint
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dispatch/TruckEnvelope.jsx
git commit -m "fix(dispatch): bottom-anchor the side view's height

Was centred, so any load under the legal max floated above the
ground line instead of sitting on the bed. A deferred minor from the
original PR, now a real prerequisite for the cab/wheels illustration
landing in the next few tasks."
```

---

### Task 3: Side-view cab illustration

**Files:**
- Modify: `frontend/src/components/dispatch/TruckEnvelope.jsx` (`SideView`, and add a new local `Cab` component below it)

**Interfaces:**
- Produces: a new non-exported `SideCab()` component (no props — it's entirely static/decorative), rendered as a sibling `<svg>` before the existing box `<svg>` inside `SideView`'s `EnvelopeFrame`.
- Consumes nothing new from other tasks.

- [ ] **Step 1: Wrap `SideView`'s existing `<svg>` in a flex row and add the cab**

In `frontend/src/components/dispatch/TruckEnvelope.jsx`, inside `SideView`'s `return`, change:

```jsx
  return (
    <EnvelopeFrame label="Tampak Samping">
      <svg
        viewBox={`0 0 ${SIDE_VIEW_NOMINAL_WIDTH_MM} ${heightGeo.canvas}`}
        className="min-h-0 w-full flex-1"
      >
```

to:

```jsx
  return (
    <EnvelopeFrame label="Tampak Samping">
      <div className="flex min-h-0 w-full flex-1 items-stretch gap-0">
        <SideCab />
        <svg
          viewBox={`0 0 ${SIDE_VIEW_NOMINAL_WIDTH_MM} ${heightGeo.canvas}`}
          className="min-h-0 w-full flex-1"
        >
```

Then, further down, the existing closing `</svg>` (right before `<EnvelopeReadout`) needs a matching `</div>`:

```jsx
        />
      </svg>
      <EnvelopeReadout
```

becomes:

```jsx
        />
        </svg>
      </div>
      <EnvelopeReadout
```

- [ ] **Step 2: Add the `SideCab` component**

Below `SideView` (before `EnvelopeFrame`), add:

```jsx
/**
 * Fixed, decorative — never reads form values, never animates. Its own
 * small local viewBox rather than the mm-scale canvas the box uses, so it
 * needs no scaling/transform math to sit next to it: a plain flex row
 * keeps them visually adjacent, and both bottom-align within the same row
 * height. viewBox height (112) is cropped exactly to the chassis line, so
 * "the ground" is the literal bottom edge of this SVG, matching how
 * SideView's box is bottom-anchored (Task 2) — no vertical offset needed
 * to line the two up.
 */
function SideCab() {
  return (
    <svg viewBox="0 0 100 112" className="h-full w-24 shrink-0">
      <line x1="0" y1="112" x2="100" y2="112" stroke="#1f2933" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <path
        d="M39,112 L39,92 L46,70 L58,46 L92,46 L92,112 Z"
        fill="#fff"
        stroke="#1f2933"
        strokeWidth="2.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M52,63 L61,50 L88,50 L88,58 Z"
        fill="#c4cad0"
        stroke="#1f2933"
        strokeWidth="1"
      />
      <line x1="76" y1="60" x2="76" y2="108" stroke="#98a0a9" strokeWidth="1.25" />
      <rect x="79" y="82" width="5" height="2.5" rx="1" fill="#1f2933" />
      <line x1="40" y1="88" x2="26" y2="78" stroke="#1f2933" strokeWidth="1.75" strokeLinecap="round" />
      <rect x="20" y="72" width="8" height="11" rx="2" fill="#fff" stroke="#1f2933" strokeWidth="1.5" />
    </svg>
  )
}
```

- [ ] **Step 3: Self-verify with a Playwright screenshot**

```bash
mkdir -p /tmp/te-shots && cd /tmp/te-shots
npm install playwright
npx playwright install chromium
```

Start both dev servers (backend must be running for `GET /rules` to populate `limits`, or the cab renders next to `EnvelopePlaceholder` instead of the box — either is fine to check, but check with real limits loaded):

```bash
uv run --directory backend python manage.py runserver 8020 &
VITE_PROXY_TARGET=http://127.0.0.1:8020 npm --prefix frontend run dev &
sleep 5
```

Note the port Vite printed (5173 or the next free one), then write and run:

```javascript
// /tmp/te-shots/shot.mjs
import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto('http://127.0.0.1:PORT/dispatch', { waitUntil: 'networkidle' })
await page.waitForSelector('text=Tampak Samping')
await page.locator('text=Tampak Samping').locator('..').screenshot({ path: '/tmp/te-shots/side.png' })
console.log('errors:', JSON.stringify(errors))
await browser.close()
```

(replace `PORT` with the actual Vite port). Run `node shot.mjs`, then actually look at `/tmp/te-shots/side.png` (Read it as an image) and confirm:

1. The cab sits immediately left of the box with no visible gap or seam.
2. The cab's ground line and the box's bottom edge/dashed outline visually continue each other at the same height — not offset up or down.
3. Windshield glass sits fully inside the cab's frame with visible margin on every side (not touching or crossing the hood/roof edges).
4. Mirror is a small shape with real clearance from the windshield corner — not overlapping it.
5. `errors` printed `[]` — no console errors.

Kill both dev servers afterward (`kill %1 %2` or find the ports and kill them).

- [ ] **Step 4: Lint/build**

```bash
npm --prefix frontend run lint
npm --prefix frontend run build
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/dispatch/TruckEnvelope.jsx
git commit -m "feat(dispatch): add the side-view cab illustration

Own small SVG next to the existing mm-scale box SVG rather than one
shared coordinate system — sidesteps needing transform math to
composite a human-scale illustration into a viewBox sized in real
millimetres. Fixed and decorative; never reads form values."
```

---

### Task 4: Top-view cab illustration

**Files:**
- Modify: `frontend/src/components/dispatch/TruckEnvelope.jsx` (`PlanView`, and add `PlanCab` below it)

**Interfaces:**
- Produces: a new non-exported `PlanCab()` component, same pattern as `SideCab`.

- [ ] **Step 1: Wrap `PlanView`'s existing `<svg>` in a flex row and add the cab**

Change:

```jsx
  return (
    <EnvelopeFrame label="Tampak Atas">
      <svg viewBox={`0 0 ${lengthGeo.canvas} ${widthGeo.canvas}`} className="min-h-0 w-full flex-1">
```

to:

```jsx
  return (
    <EnvelopeFrame label="Tampak Atas">
      <div className="flex min-h-0 w-full flex-1 items-stretch gap-0">
        <PlanCab />
        <svg viewBox={`0 0 ${lengthGeo.canvas} ${widthGeo.canvas}`} className="min-h-0 w-full flex-1">
```

And close the added `<div>` after the existing `</svg>` (right before `<EnvelopeReadout`), same pattern as Task 3 Step 1.

- [ ] **Step 2: Add the `PlanCab` component**

Below `PlanView`, add:

```jsx
/**
 * Fixed, decorative, own small local viewBox — see SideCab's comment for
 * why this doesn't need transform math against the mm-scale box SVG.
 * Vertically centred at y=50 (viewBox height 100, centre 50) to match the
 * box's own outer envelope, which axisGeometry always centres at
 * canvas/2 regardless of state — both sit in a row of equal height, so
 * they align without any extra offset calculation.
 */
function PlanCab() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-24 shrink-0">
      <path
        d="M92,28 L52,28 L34,40 Q30,50 34,60 L52,72 L92,72 Z"
        fill="#fff"
        stroke="#1f2933"
        strokeWidth="2.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <rect x="54" y="37" width="26" height="26" rx="2" fill="#c4cad0" stroke="#1f2933" strokeWidth="1" />
      <rect x="44" y="23" width="10" height="7" rx="1.5" fill="#fff" stroke="#1f2933" strokeWidth="1.5" />
      <rect x="44" y="70" width="10" height="7" rx="1.5" fill="#fff" stroke="#1f2933" strokeWidth="1.5" />
      <rect x="68" y="26" width="14" height="6" fill="#fff" stroke="#1f2933" strokeWidth="1.5" />
      <rect x="68" y="68" width="14" height="6" fill="#fff" stroke="#1f2933" strokeWidth="1.5" />
    </svg>
  )
}
```

- [ ] **Step 3: Self-verify with a Playwright screenshot**

Same setup as Task 3 Step 3 (reuse `/tmp/te-shots` — the `npm install`/`playwright install` only needs to happen once across this whole plan, skip it if already done). Screenshot the "Tampak Atas" panel this time (`page.locator('text=Tampak Atas').locator('..').screenshot(...)`), and confirm:

1. Cab sits immediately left of the box, no gap/seam.
2. Cab's vertical centre visually lines up with the box's own centreline (the dashed outer envelope should look vertically centred against the cab, not shifted up or down).
3. Mirrors read as attached tabs on the cab body — not floating disconnected rectangles (this was a real bug earlier in the design process, caught only by screenshot).
4. `errors` is `[]`.

- [ ] **Step 4: Lint/build, then commit**

```bash
npm --prefix frontend run lint
npm --prefix frontend run build
git add frontend/src/components/dispatch/TruckEnvelope.jsx
git commit -m "feat(dispatch): add the top-view cab illustration

Tapered-nose polygon with one rounded curve at the very tip, otherwise
straight facets. Mirrors overlap the cab body directly rather than
connecting via a thin stalk line — an earlier hand-built mockup found
stalk lines nearly invisible at real render scale, reading as floating
debris."
```

---

### Task 5: Panel lines and rear door seam

**Files:**
- Modify: `frontend/src/components/dispatch/TruckEnvelope.jsx` (`PlanView`, `SideView`)

**Interfaces:**
- Produces: a new non-exported helper `panelLines(start, size, count)` → `number[]` (the x or y coordinates for each line, evenly spaced inside `[start, start + size]`, excluding the very first and last position so lines sit strictly inside the box, not on top of its border).
- Consumes: `lengthGeo`/`widthGeo`/`heightGeo` exactly as already available in each view — no new geometry needed. Uses the same **plain, non-animated** values already used for the `<motion.rect>`'s target (`lengthGeo.innerOffset`, `lengthGeo.innerSize`, etc.) — deliberately not wired through Motion (see Global Constraints: panel lines snap, only the outline + rear wheels animate).

- [ ] **Step 1: Add the `panelLines` helper**

Near `axisGeometry` (same section of constants/helpers), add:

```jsx
const PANEL_LINE_COUNT = 8

/** Evenly spaced positions strictly inside [start, start+size], excluding the edges. */
function panelLines(start, size, count = PANEL_LINE_COUNT) {
  const lines = []
  for (let i = 1; i <= count; i++) {
    lines.push(start + (size * i) / (count + 1))
  }
  return lines
}
```

- [ ] **Step 2: Add panel lines + rear door seam to `PlanView`'s inner box**

In `PlanView`, immediately after the existing `<motion.rect>` (the inner/animated box) and still inside the same `<svg>`, add:

```jsx
        {panelLines(lengthGeo.innerOffset, lengthGeo.innerSize).map((x) => (
          <line
            key={x}
            x1={x}
            y1={widthGeo.innerOffset}
            x2={x}
            y2={widthGeo.innerOffset + widthGeo.innerSize}
            stroke="#c4cad0"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <line
          x1={lengthGeo.innerOffset + lengthGeo.innerSize}
          y1={widthGeo.innerOffset}
          x2={lengthGeo.innerOffset + lengthGeo.innerSize}
          y2={widthGeo.innerOffset + widthGeo.innerSize}
          stroke={over ? OVER_COLOUR : NEUTRAL_COLOUR}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
```

- [ ] **Step 3: Same treatment for `SideView`'s inner box**

In `SideView`, after its `<motion.rect>`:

```jsx
        {panelLines(0, SIDE_VIEW_NOMINAL_WIDTH_MM).map((x) => (
          <line
            key={x}
            x1={x}
            y1={heightGeo.canvas - heightGeo.innerSize}
            x2={x}
            y2={heightGeo.canvas}
            stroke="#c4cad0"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <line
          x1={SIDE_VIEW_NOMINAL_WIDTH_MM}
          y1={heightGeo.canvas - heightGeo.innerSize}
          x2={SIDE_VIEW_NOMINAL_WIDTH_MM}
          y2={heightGeo.canvas}
          stroke={heightGeo.over ? OVER_COLOUR : NEUTRAL_COLOUR}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
```

Note: `SideView`'s panel lines use `panelLines(0, SIDE_VIEW_NOMINAL_WIDTH_MM)` — fixed positions, since the box's horizontal extent in the side view is decorative/constant (unchanged existing convention, length isn't re-shown here). Only the lines' vertical span (`heightGeo.canvas - heightGeo.innerSize` to `heightGeo.canvas`) changes with input.

- [ ] **Step 4: Self-verify**

Same Playwright setup as Task 3. Screenshot both panels at three form states — the default `DEFAULTS` values, a HOLD-shaped length (`19000`), and a HOLD-shaped height (`4500`) — and confirm in each:

1. Panel lines sit strictly inside the coloured outline, never crossing or touching it.
2. The rear door seam line matches the outline's current colour (green when fitting, red when over) in every state.
3. Lines don't overlap the cab or extend past it into the gap between cab and box.
4. No console errors.

- [ ] **Step 5: Lint/build, then commit**

```bash
npm --prefix frontend run lint
npm --prefix frontend run build
git add frontend/src/components/dispatch/TruckEnvelope.jsx
git commit -m "feat(dispatch): add panel lines and a rear door seam to the box

Recomputed from plain geometry every render rather than wired through
Motion — deliberate scope cut (design doc §6): the outline and the
rear wheel pair (next task) get the spring, decorative cosmetic detail
snaps to its new position instead."
```

---

### Task 6: Side-view wheels

**Files:**
- Modify: `frontend/src/components/dispatch/TruckEnvelope.jsx` (`SideView`)

**Interfaces:**
- Produces: new constants `WHEEL_RADIUS_MM = 450`, `WHEEL_HUB_RADIUS_MM = 180`, `REAR_WHEEL_OFFSETS_MM = [400, 120]` (distances from the box's right edge, i.e. `SIDE_VIEW_NOMINAL_WIDTH_MM`, to each wheel's centre).

  > **AMENDED during execution (Task 6).** `SIDE_VIEW_NOMINAL_WIDTH_MM` is now
  > **9000**, was 3000. At 3000 the viewBox is taller than wide, so `meet`
  > scaling fit it by height and rendered the entire truck ~100px into ~320px
  > of frame, leaving half the panel empty — obvious once a cab and wheels
  > made it read as an object rather than a rectangle. 9000 is a realistic
  > cargo-body length and fills the row. The constant is decorative by design
  > (§5: length is not re-shown in the side view), so nothing data-driven
  > moves. `REAR_WHEEL_OFFSETS_MM` rescales to **`[1350, 500]`** to stay in
  > the back ~15% as this task's checklist intends.

- [ ] **Step 1: Add the wheel constants**

Near `SIDE_VIEW_NOMINAL_WIDTH_MM`, add:

```jsx
const WHEEL_RADIUS_MM = 450
const WHEEL_HUB_RADIUS_MM = 180
const REAR_WHEEL_OFFSETS_MM = [400, 120]
```

- [ ] **Step 2: Draw the rear wheels in `SideView`'s box SVG**

After the panel-lines block added in Task 5 (still inside the same `<svg>`), add:

```jsx
        {REAR_WHEEL_OFFSETS_MM.map((offset) => {
          const cx = SIDE_VIEW_NOMINAL_WIDTH_MM - offset
          const cy = heightGeo.canvas - WHEEL_RADIUS_MM
          return (
            <g key={offset}>
              <circle cx={cx} cy={cy} r={WHEEL_RADIUS_MM} fill="#fff" stroke="#1f2933" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
              <circle cx={cx} cy={cy} r={WHEEL_HUB_RADIUS_MM} fill="none" stroke="#1f2933" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
            </g>
          )
        })}
```

- [ ] **Step 3: Fix the front wheel's vertical position in `SideCab` (Task 3's cab, corrected here)**

Task 3's `SideCab` doesn't yet have a front wheel. Add one now, in `SideCab` (same file, the component added in Task 3):

```jsx
      <circle cx="55" cy="99" r="13" fill="#fff" stroke="#1f2933" strokeWidth="2.5" />
      <circle cx="55" cy="99" r="5" fill="none" stroke="#1f2933" strokeWidth="1.25" />
```

placed right before the closing `</svg>` of `SideCab`. Note `cy="99"`, not `112` — the wheel's **bottom edge** must touch the chassis line (`y=112`), not its center; centering a radius-13 circle at `cy=112` would clip half the wheel outside the viewBox. `99 = 112 - 13`.

- [ ] **Step 4: Self-verify**

Same Playwright setup. Screenshot "Tampak Samping" and confirm:

1. Front wheel (in the cab SVG) and rear wheels (in the box SVG) all sit with their bottom edge on the same visual ground line — none clipped, none floating above it.
2. Rear wheels sit near the back of the box, not the middle (offsets are `400`/`120` out of a `3000`-wide box, i.e. within the back 15%).
3. Wheels don't move between different height inputs (fits vs. overflow) — they're fixed, unlike the outline.
4. No console errors.

- [ ] **Step 5: Lint/build, then commit**

```bash
npm --prefix frontend run lint
npm --prefix frontend run build
git add frontend/src/components/dispatch/TruckEnvelope.jsx
git commit -m "feat(dispatch): add wheels to the side view

Fixed, non-animated — the side view's horizontal extent was already
decorative/constant (length isn't re-shown there), so there's no
input value for these wheels to track. Bottom edge, not centre,
touches the ground line, or a wheel radius clips outside the SVG."
```

---

### Task 7: Top-view wheels — front fixed, rear animated to the input box

**This is the task most likely to need iteration** — it's the one place two independently-animated `motion.rect` elements (the box outline and the rear wheel pair) need to visibly move in lockstep, and the one place a coordinate mistake in an earlier round produced a real, screenshot-only-visible bug (inconsistent offsets between states). Budget real self-verification time here, across multiple input values, not just one.

**Files:**
- Modify: `frontend/src/components/dispatch/TruckEnvelope.jsx` (`PlanView`, `PlanCab`)

**Interfaces:**
- Produces: constants `REAR_WHEEL_LENGTH_MM = 900`, `REAR_WHEEL_POKE_MM = 300`, `REAR_WHEEL_RIGHT_OFFSETS_MM = [-100, 1300]` (negative = pokes past the box's right edge; the array holds the two wheel-hint rects' offsets, rearmost first).

- [ ] **Step 1: Add a front wheel-hint pair to `PlanCab` (fixed, matches Task 4's cab)**

In `PlanCab` (added in Task 4), the front wheel-hint rects (`x="68" y="26"` and `x="68" y="68"`) already exist from Task 4 Step 2 — no change needed here. (Named explicitly so the reviewer can confirm they're already covered rather than wondering if they were missed.)

- [ ] **Step 2: Add the rear wheel-hint constants**

Near `PANEL_LINE_COUNT`, add:

```jsx
const REAR_WHEEL_LENGTH_MM = 900
const REAR_WHEEL_POKE_MM = 300
const REAR_WHEEL_RIGHT_OFFSETS_MM = [-100, 1300]
```

- [ ] **Step 3: Add the animated rear wheel-hint pair to `PlanView`**

After the rear-door-seam line added in Task 5 Step 2, still inside `PlanView`'s box `<svg>`, add:

```jsx
        {REAR_WHEEL_RIGHT_OFFSETS_MM.map((offset) => {
          const boxRight = lengthGeo.innerOffset + lengthGeo.innerSize
          const rectX = boxRight - offset - REAR_WHEEL_LENGTH_MM
          const topY = widthGeo.innerOffset - REAR_WHEEL_POKE_MM + 60
          const bottomY = widthGeo.innerOffset + widthGeo.innerSize - 60
          return (
            <g key={offset}>
              <motion.rect
                initial={{ x: rectX, y: topY }}
                animate={{ x: rectX, y: topY }}
                transition={reduceMotion ? { duration: 0 } : SPRING}
                width={REAR_WHEEL_LENGTH_MM}
                height={REAR_WHEEL_POKE_MM}
                fill="#fff"
                stroke="#1f2933"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              <motion.rect
                initial={{ x: rectX, y: bottomY }}
                animate={{ x: rectX, y: bottomY }}
                transition={reduceMotion ? { duration: 0 } : SPRING}
                width={REAR_WHEEL_LENGTH_MM}
                height={REAR_WHEEL_POKE_MM}
                fill="#fff"
                stroke="#1f2933"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )
        })}
```

This reads `reduceMotion` and `SPRING`, both already in scope inside `PlanView` (the same values the box's own `<motion.rect>` uses) — using the **identical** `transition` object is what keeps these visually synced with the box without any explicit linking between them, per the design doc §5.

- [ ] **Step 4: Self-verify — this is the important one**

Same Playwright setup as prior tasks, but this time script **three** form states in sequence within the same page load (so you can watch the animation, not just compare static screenshots):

```javascript
// append to shot.mjs, after the existing screenshot
const lengthInput = page.locator('label:has-text("Panjang") input')
await lengthInput.fill('8000') // short — lots of headroom
await page.waitForTimeout(700)
await page.locator('text=Tampak Atas').locator('..').screenshot({ path: '/tmp/te-shots/top-short.png' })

await lengthInput.fill('19000') // over the 18000 legal limit
await page.waitForTimeout(700)
await page.locator('text=Tampak Atas').locator('..').screenshot({ path: '/tmp/te-shots/top-over.png' })
```

Read both screenshots and confirm:

1. In `top-short.png`, the rear wheel-hint pair sits near the box's *own* (short) right edge, not near the dashed legal-max line far off to the right — there should be a visible gap between the wheels and the dashed reference, matching the gap between the coloured box and the dashed line.
2. In `top-over.png`, the wheel pair has moved past the dashed legal-max line, together with the red overflowing box.
3. **Compare the wheel-to-box-edge gap between the two screenshots** — it must be the same in both (same offset formula, not an accidental per-state difference like the one caught earlier in the design process). Eyeball it, or check pixel positions if the images allow it.
4. Wheels read as flush/attached to the box's back edge, not floating with a visible gap before it.
5. No console errors in any of the three states.

- [ ] **Step 5: Lint/build, then commit**

```bash
npm --prefix frontend run lint
npm --prefix frontend run build
git add frontend/src/components/dispatch/TruckEnvelope.jsx
git commit -m "feat(dispatch): animate the top-view rear wheels with the input box

Own motion.rect per wheel-hint rect, sharing the box's exact SPRING
transition — independent Motion values with the same spring config
and trigger stay visually synced without explicit linking. Anchored
to the live input box's own edge on both axes (length via x, width via
y), never the fixed legal-max line, confirmed during design review
after an earlier version anchored to the wrong one."
```

---

## Self-review notes

- **Spec coverage:** §1 (nothing else changes) → verified by construction, no task touches `axisGeometry`, props, or placement. §2 (two-tier detail, outer cab never drawn) → Tasks 3/4 only ever render one cab per view. §3 (cab fixed, anchored to outer envelope) → Task 3/4's `vectorEffect`-free centering argument in each component's comment. §4 (green exception + DESIGN.md) → Task 1. §5 (wheels anchored to input, both axes, flush) → Task 6 (side, fixed by design) + Task 7 (top, animated, both axes). §6 (panel lines snap, wheels animate) → Task 5 vs. Task 7's explicit `motion.rect` usage. §7 (self-verification via screenshot) → every task's Step "Self-verify."
- **Type/name consistency:** `lengthGeo`/`widthGeo`/`heightGeo` field names (`canvas`, `legalSize`, `outerOffset`, `innerSize`, `innerOffset`, `over`) are unchanged from the shipped file throughout — no task renames them. `SPRING`, `reduceMotion`, `OVER_COLOUR`, `NEUTRAL_COLOUR` are read as-is from existing scope in every task that uses them, never redeclared.
- **No placeholders:** every task contains complete code, not a description of code. Numeric constants (wheel radii, offsets, panel line count) are stated exactly, with the Global Constraints section's explicit note that they're a validated starting point subject to the mandatory screenshot self-verification, not a claim of pixel-perfect certainty asserted without evidence.
