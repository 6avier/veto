# Truck Envelope Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `TruckEnvelope.jsx` — a translucent top-down + side-elevation outline of the truck's legal footprint on `/dispatch`, with the live form input drawn inside it, overflow highlighted, and a spring "stretch" animation on change.

**Architecture:** One new presentational component, `frontend/src/components/dispatch/TruckEnvelope.jsx`, reading props already available in `Dispatch.jsx` (`form.length/width/height`, `limits`). No new API call, no backend change. SVG rectangles in an mm-based `viewBox`; Motion (`motion/react`) animates the inner rectangle's geometry on prop change.

**Tech Stack:** React 19, Tailwind v4 (raw hex utility classes, matching this surface's existing ERP-side convention), `motion` (new dependency).

Design reference: [`docs/plans/2026-08-12-truck-envelope-design.md`](2026-08-12-truck-envelope-design.md) (approved).

## Global Constraints

- **Frontend-only.** No file under `backend/` changes. This is 6avier's lane; Iqbal's backend work is untouched.
- **No new endpoint.** Reuse the `limits` object `Dispatch.jsx` already fetches via `listRules({ origin: 'CENTRAL' })` → `limitsFromRules` (`frontend/src/lib/limits.js`). Shape: `{ length?: {threshold, unit, citation, origin}, width?: {...}, height?: {...}, grossWeight?: {...}, axle0?: {...}, ... }`.
- **Dimension limits are flat, not axle-config scoped.** Do not read or branch on `axleConfig` anywhere in this component. (`backend/apps/rules/migrations/0002_seed_odol_central_rules.py` — `DIMENSION_LENGTH/WIDTH/HEIGHT` carry no `axle_config`.)
- **Overflow colour is `#a02a1f`** — the same red already used for live excess text in `frontend/src/components/dispatch/DispatchForm.jsx`'s `Field` component (`+N melebihi batas`). Never use VETO's amber (`--hold: #F2A93B` / `--hold-ink: #8A5200`) here — `DESIGN.md` §4 reserves amber for the VETO panel/HOLD accent, and this widget lives in the ERP-side page area.
- **Raw hex Tailwind classes, not the `ink-*` token ramp.** This surface is ERP-side, matching the existing convention in `DispatchForm.jsx` (`text-[#5a646e]`, `border-[#c9ced4]`, etc. — see `docs/HANDOFF.md` §18: "Raw hex appears only in `ErpLayout.jsx` and the ERP-side parts of `DispatchForm.jsx`, deliberately").
- **Display formatting goes through `frontend/src/lib/format.js`.** Use `formatMm`; never inline `toLocaleString`.
- **Motion is a scoped exception to `DESIGN.md`'s low motion-intensity dial**, confined to this one component. Do not carry loose spring easing into `VerdictPanel.jsx`, `ViolationDialog.jsx`, or anywhere else.
- **No frontend test runner exists** (`CLAUDE.md` §4, deliberate). Verification for every task in this plan is manual: run the dev servers and check the rendered result in a browser, per `CLAUDE.md` §6. This mirrors the deviation already recorded in `docs/plans/2026-08-11-rule-studio.md`.
- **Component style:** default export first, local non-exported helper components/functions below it in the same file, per `docs/HANDOFF.md` §18.
- **SVG stroke widths must use `vectorEffect="non-scaling-stroke"`.** The `viewBox` is in raw millimetres (tens of thousands of units); without this, any strokeWidth small enough to look reasonable in mm-space renders as a sub-pixel, invisible line once the browser scales the SVG down to its container width.

---

## File structure

| File | Responsibility |
|---|---|
| `frontend/package.json`, `frontend/package-lock.json` | *(modified)* adds the `motion` dependency |
| `frontend/src/components/dispatch/TruckEnvelope.jsx` | *(new)* the whole widget: plan view, side view, geometry math, placeholder state |
| `frontend/src/routes/Dispatch.jsx` | *(modified)* renders `<TruckEnvelope>` below the existing form+VerdictPanel grid |

---

### Task 1: Add the Motion dependency

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`

**Interfaces:**
- Produces: the `motion` package, imported downstream as `import { motion } from 'motion/react'`.

- [ ] **Step 1: Install the package**

Run:
```bash
npm --prefix frontend install motion
```

- [ ] **Step 2: Verify it installed cleanly**

Run:
```bash
npm --prefix frontend ls motion
```
Expected: prints the installed `motion` version with no `UNMET DEPENDENCY` or error output.

- [ ] **Step 3: Verify the existing build still succeeds**

Run:
```bash
npm --prefix frontend run build
```
Expected: build completes with no errors (the new dependency is unused so far, but this confirms the install didn't break resolution).

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(frontend): add motion for the truck envelope stretch animation"
```

---

### Task 2: Build the envelope geometry and static rendering (no animation yet)

**Files:**
- Create: `frontend/src/components/dispatch/TruckEnvelope.jsx`
- Modify: `frontend/src/routes/Dispatch.jsx`

**Interfaces:**
- Consumes: `limits.length?.threshold`, `limits.width?.threshold`, `limits.height?.threshold` (numbers, mm) — shape from `frontend/src/lib/limits.js`'s `limitsFromRules`. `formatMm(value)` from `frontend/src/lib/format.js` (`(value) => string`).
- Produces: `TruckEnvelope({ length, width, height, limits })` — a default-exported React component. `length`/`width`/`height` are the raw string form values (may be `''` mid-edit). No other file consumes anything from this component beyond the render itself.

This task builds correctness first — legal boundary drawn accurately, overflow computed and coloured correctly, edge cases (missing limits, empty fields) handled — with plain `<rect>` elements. Task 3 swaps the inner rects for animated `motion.rect`.

- [ ] **Step 1: Write the component**

```jsx
// frontend/src/components/dispatch/TruckEnvelope.jsx
import { formatMm } from '@/lib/format'

/**
 * A booth gimmick on /dispatch (CLAUDE.md §4, P2 polish): a translucent
 * outline of the truck's legal footprint, with the live form input drawn
 * inside it, and the excess coloured when a dimension goes over.
 *
 * Dimension limits are flat in the current rule base — unlike weight, they
 * do not vary by axle configuration (backend/apps/rules/migrations/
 * 0002_seed_odol_central_rules.py). This component never reads axleConfig.
 */
export default function TruckEnvelope({ length, width, height, limits }) {
  return (
    <section className="mt-4 border border-[#c9ced4] bg-white p-4">
      <p className="mb-3 text-label font-semibold text-[#1f2933]">Envelope Muatan</p>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <PlanView length={length} width={width} limits={limits} />
        <SideView height={height} limits={limits} />
      </div>
    </section>
  )
}

const CANVAS_PADDING = 1.2
const SIDE_VIEW_NOMINAL_WIDTH_MM = 3000
const OVER_COLOUR = '#a02a1f'
const NEUTRAL_COLOUR = '#1f2933'
const OUTER_STROKE = '#98a0a9'
const OUTER_FILL = '#f4f6f7'

/**
 * Geometry for one axis, in a fixed viewBox padded 20% past the legal limit
 * so overflow up to that much stays visible without the canvas growing
 * unbounded. Returns null when there is no limit to draw against yet
 * (limits still loading, or GET /rules failed and the fetch was swallowed
 * the same way Dispatch.jsx's own useEffect already swallows it).
 */
function axisGeometry(actualMm, legalMm) {
  if (!Number.isFinite(legalMm) || legalMm <= 0) return null
  const canvas = legalMm * CANVAS_PADDING
  const actual = Number.isFinite(actualMm) && actualMm > 0 ? actualMm : 0
  const innerSize = Math.min(actual, canvas)
  return {
    canvas,
    legalSize: legalMm,
    outerOffset: (canvas - legalMm) / 2,
    innerSize,
    innerOffset: (canvas - innerSize) / 2,
    over: actual > legalMm,
  }
}

function PlanView({ length, width, limits }) {
  const lengthGeo = axisGeometry(Number(length), limits.length?.threshold)
  const widthGeo = axisGeometry(Number(width), limits.width?.threshold)

  if (!lengthGeo || !widthGeo) return <EnvelopePlaceholder label="Tampak Atas" />

  const over = lengthGeo.over || widthGeo.over

  return (
    <EnvelopeFrame label="Tampak Atas">
      <svg viewBox={`0 0 ${lengthGeo.canvas} ${widthGeo.canvas}`} className="h-full w-full">
        <rect
          x={lengthGeo.outerOffset}
          y={widthGeo.outerOffset}
          width={lengthGeo.legalSize}
          height={widthGeo.legalSize}
          fill={OUTER_FILL}
          stroke={OUTER_STROKE}
          strokeWidth={2}
          strokeDasharray="8 6"
          vectorEffect="non-scaling-stroke"
        />
        <rect
          x={lengthGeo.innerOffset}
          y={widthGeo.innerOffset}
          width={lengthGeo.innerSize}
          height={widthGeo.innerSize}
          fill="none"
          stroke={over ? OVER_COLOUR : NEUTRAL_COLOUR}
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <EnvelopeReadout
        primary={`${formatMm(length)} × ${formatMm(width)}`}
        secondary={`Batas ${formatMm(limits.length?.threshold)} × ${formatMm(limits.width?.threshold)}`}
        over={over}
      />
    </EnvelopeFrame>
  )
}

function SideView({ height, limits }) {
  const heightGeo = axisGeometry(Number(height), limits.height?.threshold)

  if (!heightGeo) return <EnvelopePlaceholder label="Tampak Samping" />

  return (
    <EnvelopeFrame label="Tampak Samping">
      <svg
        viewBox={`0 0 ${SIDE_VIEW_NOMINAL_WIDTH_MM} ${heightGeo.canvas}`}
        className="h-full w-full"
      >
        <rect
          x={0}
          y={heightGeo.outerOffset}
          width={SIDE_VIEW_NOMINAL_WIDTH_MM}
          height={heightGeo.legalSize}
          fill={OUTER_FILL}
          stroke={OUTER_STROKE}
          strokeWidth={2}
          strokeDasharray="8 6"
          vectorEffect="non-scaling-stroke"
        />
        <rect
          x={0}
          y={heightGeo.innerOffset}
          width={SIDE_VIEW_NOMINAL_WIDTH_MM}
          height={heightGeo.innerSize}
          fill="none"
          stroke={heightGeo.over ? OVER_COLOUR : NEUTRAL_COLOUR}
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <EnvelopeReadout
        primary={formatMm(height)}
        secondary={`Batas ${formatMm(limits.height?.threshold)}`}
        over={heightGeo.over}
      />
    </EnvelopeFrame>
  )
}

function EnvelopeFrame({ label, children }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-label text-[#5a646e]">{label}</p>
      <div className="h-56 w-full border border-[#c9ced4] p-3">{children}</div>
    </div>
  )
}

function EnvelopePlaceholder({ label }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-label text-[#5a646e]">{label}</p>
      <div className="flex h-56 w-full items-center justify-center border border-[#c9ced4] bg-[#f4f6f7]">
        <p className="text-label text-[#98a0a9]">Menunggu batas legal…</p>
      </div>
    </div>
  )
}

function EnvelopeReadout({ primary, secondary, over }) {
  return (
    <p className="mt-2 text-label">
      <span className={`tnum font-medium ${over ? 'text-[#a02a1f]' : 'text-[#1f2933]'}`}>
        {primary}
      </span>
      <span className="text-[#98a0a9]"> · {secondary}</span>
    </p>
  )
}
```

- [ ] **Step 2: Wire it into `Dispatch.jsx`**

In `frontend/src/routes/Dispatch.jsx`, add the import alongside the other component imports (alphabetical, matching the existing order):

```jsx
import DispatchForm from '@/components/dispatch/DispatchForm'
import TruckEnvelope from '@/components/dispatch/TruckEnvelope'
import VerdictPanel from '@/components/dispatch/VerdictPanel'
```

Then render it directly below the closing `</div>` of the existing `grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]` row, before the `VETO memeriksa angka…` disclaimer paragraph:

```jsx
      <TruckEnvelope
        length={form.length}
        width={form.width}
        height={form.height}
        limits={limits}
      />
```

- [ ] **Step 3: Verify in the browser**

Run:
```bash
uv run --directory backend python manage.py runserver 8000
npm --prefix frontend run dev
```

Open `/dispatch` and check, using the field values already in `DEFAULTS` (`frontend/src/routes/Dispatch.jsx`: length 12000, width 2500, height 4100 — all under the 18000/2500/4200 legal limits):

1. Both panels render: outer dashed boundary, inner solid outline in `#1f2933` (not red), roughly centred and proportioned within each boundary.
2. Change **Panjang** to `19000` (over the 18000 legal length). The plan-view inner outline should visibly extend past the outer boundary on the long axis and turn `#a02a1f`. The readout text also turns red.
3. Change **Lebar** to `2900` (over 2500). Same on the short axis.
4. Change **Tinggi** to `4500` (over 4200). The side-view panel shows the same behaviour independently of the plan view.
5. Clear the **Panjang** field entirely. The inner plan-view rect should shrink to nothing / not error, not throw a console error about `NaN`.
6. Confirm no console errors in the browser devtools throughout.

- [ ] **Step 4: Run lint**

```bash
npm --prefix frontend run lint
```
Expected: no new oxlint errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/dispatch/TruckEnvelope.jsx frontend/src/routes/Dispatch.jsx
git commit -m "feat(dispatch): draw the truck's legal footprint as an envelope outline"
```

---

### Task 3: Animate the inner outline with a rubbery spring stretch

**Files:**
- Modify: `frontend/src/components/dispatch/TruckEnvelope.jsx`

**Interfaces:**
- Consumes: `motion` from `motion/react` (Task 1). `axisGeometry`, `PlanView`, `SideView` as built in Task 2 — same names, same return shape (`{canvas, legalSize, outerOffset, innerSize, innerOffset, over}`).
- Produces: no change to `TruckEnvelope`'s own props or exports — this task only changes how the inner rects render, not what the component takes or returns.

- [ ] **Step 1: Import Motion and add a shared spring config**

At the top of `frontend/src/components/dispatch/TruckEnvelope.jsx`, add the import and a constant near the other constants (`CANVAS_PADDING`, etc.):

```jsx
import { motion } from 'motion/react'
```

```jsx
const SPRING = { type: 'spring', stiffness: 90, damping: 12 }
```

- [ ] **Step 2: Replace the inner `<rect>` in `PlanView` with an animated one**

In `PlanView`, replace:

```jsx
        <rect
          x={lengthGeo.innerOffset}
          y={widthGeo.innerOffset}
          width={lengthGeo.innerSize}
          height={widthGeo.innerSize}
          fill="none"
          stroke={over ? OVER_COLOUR : NEUTRAL_COLOUR}
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
        />
```

with:

```jsx
        <motion.rect
          animate={{
            x: lengthGeo.innerOffset,
            y: widthGeo.innerOffset,
            width: lengthGeo.innerSize,
            height: widthGeo.innerSize,
          }}
          transition={SPRING}
          fill="none"
          stroke={over ? OVER_COLOUR : NEUTRAL_COLOUR}
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
        />
```

- [ ] **Step 3: Replace the inner `<rect>` in `SideView` the same way**

Replace:

```jsx
        <rect
          x={0}
          y={heightGeo.innerOffset}
          width={SIDE_VIEW_NOMINAL_WIDTH_MM}
          height={heightGeo.innerSize}
          fill="none"
          stroke={heightGeo.over ? OVER_COLOUR : NEUTRAL_COLOUR}
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
        />
```

with:

```jsx
        <motion.rect
          x={0}
          width={SIDE_VIEW_NOMINAL_WIDTH_MM}
          animate={{ y: heightGeo.innerOffset, height: heightGeo.innerSize }}
          transition={SPRING}
          fill="none"
          stroke={heightGeo.over ? OVER_COLOUR : NEUTRAL_COLOUR}
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
        />
```

- [ ] **Step 4: Verify the animation in the browser**

With both dev servers still running from Task 2, on `/dispatch`:

1. Type a new **Panjang** value a few thousand mm higher than the current one. The inner plan-view outline should visibly overshoot past its new target size and settle back — not snap instantly.
2. Do the same for **Lebar** and **Tinggi**, confirming each axis animates independently.
3. Push a value from under the limit to over it, and confirm the colour change (`#1f2933` → `#a02a1f`) happens together with the stretch, not a frame or two late.
4. Confirm the animation runs smoothly (no visible jank) with the browser devtools open.

- [ ] **Step 5: Run lint**

```bash
npm --prefix frontend run lint
```
Expected: no new oxlint errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/dispatch/TruckEnvelope.jsx
git commit -m "feat(dispatch): give the envelope's real-input outline a rubbery stretch"
```

---

## Self-review notes

- **Spec coverage:** §3 (component/placement) → Task 2 Step 2. §4 (rendering, viewBox padding) → Task 2 Step 1 `axisGeometry`. §5 (overflow colour) → Task 2 Step 1 (`OVER_COLOUR`, chosen the "whole inner stroke switches" simpler alternative the design doc explicitly permitted). §6 (animation, scoped exception) → Task 3, and the exception is restated in Global Constraints. §8 (edge cases: empty fields, limits not loaded, extreme overflow) → Task 2 Step 1 (`axisGeometry` null/zero handling) and Step 3's manual verification checklist covers all three. §9 (verification) → each task's manual browser checklist plus lint; no backend test run is added since nothing under `backend/` changed. §7 (weight ideas) is explicitly out of scope for this plan, left for a future spec.
- **Type/name consistency checked:** `axisGeometry`'s return shape (`canvas`, `legalSize`, `outerOffset`, `innerSize`, `innerOffset`, `over`) is used identically by `PlanView` and `SideView` in both Task 2 and Task 3 — no renames introduced between tasks.
- **No placeholders:** all three tasks contain complete, runnable code, not descriptions of code.
