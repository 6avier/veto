# Truck Envelope Visualization — Design

**Status:** Design approved by 6avier 2026-08-12, pending implementation plan.

**Goal:** A demo gimmick on `/dispatch` — a translucent top-down (and side) outline of the truck's maximum legal footprint, with the operator's real input drawn inside it as a second outline. When the input exceeds the legal envelope, the excess is visibly drawn poking past the boundary in a warning colour. Purpose is judge/booth "wow," not a P0/P1 requirement — `CLAUDE.md` §4 places polish/micro-interaction work at P2.

**Why now:** Requested directly by 6avier (frontend lane owner) as the next piece of dispatch-screen work, separate from the backend-lane P0 items in `docs/HANDOFF.md` (CLIENT rule pack, citation verification).

---

## 1. Corrected premise

The request assumed the legal max footprint varies by axle configuration. It does not, in the current rule base: `DIMENSION_LENGTH` / `DIMENSION_WIDTH` / `DIMENSION_HEIGHT` are flat thresholds (18000 / 2500 / 4200 mm) with no `axle_config` scoping — see `backend/apps/rules/migrations/0002_seed_odol_central_rules.py`. Only `GROSS_WEIGHT` and `AXLE_LOAD` vary by axle config/index (`0005_seed_detailed_axle_rules.py`).

**Decision:** the envelope outline uses the flat dimension limits, unmodified by axle config, for every truck. Axle config is not part of this feature's math. (It will matter for the weight visualization — see §7.)

---

## 2. Scope

**In scope:** a top-down plan view (length × width) and a side elevation view (height), both comparing the live form input against the active legal limit, with overflow highlighted and a spring "stretch" animation on change.

**Out of scope (this pass):** weight/axle-load visualization (§7, ideas only, not built), any change to the validation engine or API, any change to `VerdictPanel` or the PASS/HOLD gate logic.

---

## 3. Component & placement

New component: `frontend/src/components/dispatch/TruckEnvelope.jsx`.

Rendered in `frontend/src/routes/Dispatch.jsx` as a new full-width block below the existing `grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]` row (i.e., below both the form and `VerdictPanel`, spanning the full `max-w-[1400px]` container).

Props: `{ length, width, height, limits }` — `length`/`width`/`height` are the raw string form values already held in `Dispatch.jsx`'s `form` state (live, updates on every keystroke, independent of submit/decision). `limits` is the same object already fetched via `listRules` → `limitsFromRules` in `Dispatch.jsx` (`limits.length`, `limits.width`, `limits.height`), so no new API call.

No new backend endpoint. This satisfies the "connect to VETO's API" requirement structurally — the ceilings drawn are the live, versioned rule-base numbers, not hardcoded — while reusing data the form already fetches.

---

## 4. Rendering

SVG, not canvas: the shapes are simple axis-aligned rectangles, need crisp static outlines, must scale responsively, and are easiest to reason about in mm-based `viewBox` coordinates.

Two panels side by side inside the block, each its own `<svg>`:

- **Tampak Atas** (top-down): outer rect = legal length × width, centred in a `viewBox` sized to `1.2 ×` the legal envelope (fixed headroom so overflow up to 20% over the limit is never clipped; beyond that the shape is clamped visually at the canvas edge rather than growing the viewBox, so a wild HOLD input never blows out the layout).
- **Tampak Samping** (side elevation): same approach, one axis (height) against a nominal fixed body width for the drawing, since the wire payload carries no separate "side width."

Both outer rects: translucent fill (`ink-100` at low opacity), dashed `ink-300` stroke — reads as a boundary, not a solid object.

Inner rect (the real input): centred inside the outer rect's coordinate space, solid `ink-700` stroke by default.

## 5. Overflow treatment

When `length`, `width`, or `height` exceeds its `limits.*.threshold`, the inner rect grows past the outer rect on that axis. The portion of the inner rect that lies outside the outer rect's bounds is stroked/filled in `#a02a1f` — the same red already used for live excess text in `DispatchForm.jsx`'s `Field` component (`+N melebihi batas`). This reuses an existing convention instead of introducing a new colour, and deliberately does **not** use VETO's amber: amber is reserved by `DESIGN.md` §4 for the VETO panel/HOLD accent, and this widget lives in the ERP-side page area, structurally parallel to the form's own field-level excess indicators.

Implementation approach: render the inner rect in two layers — the portion clipped to the outer rect's bounds in `ink-700`, and the portion outside (computed from the same width/length/height numbers) in `#a02a1f`. Simpler alternative if clipping proves fiddly in the plan phase: the whole inner stroke switches to `#a02a1f` the moment any axis is over, rather than partial-segment colouring. Left as an implementation-time call, not a design blocker either way.

## 6. Animation

Adds **Motion** (`motion`, formerly `framer-motion`) as a new frontend dependency — the first animation library in this project (`frontend/package.json` currently has none).

`motion.rect` (or `motion.g` wrapping the inner shape) animates its geometry (width/height/position, in mm-mapped SVG units) on every change to the live form value — not gated on submit or on a PASS/HOLD decision. Spring config: comparatively loose stiffness and moderate damping for a visible "rubbery" overshoot rather than a snap-to-value transition.

**Explicit exception, scoped narrowly.** `DESIGN.md` §0 sets `MOTION_INTENSITY 4` and CLAUDE.md §7 warns against decorative motion with no purpose. This animation is deliberately louder than that dial, by direct instruction from 6avier, because this widget's entire purpose is the physical "wow" of watching an over-length load visibly stretch past its legal boundary — the motion *is* the demonstration, not decoration on top of one. This exception is confined to `TruckEnvelope.jsx`. It must not be read as licence to loosen motion elsewhere in the product; `VerdictPanel`, `ViolationDialog`, and the rest of `/dispatch` keep their existing restrained motion language.

## 7. Weight visualization — ideas only, not built this pass

Three directions to pick from in a follow-up brainstorming pass, once dimensions are shipped and demo-tested:

1. **Per-axle weighbridge gauge.** A row of simple horizontal bar gauges, one per axle (count from `axleCountFor(axleConfig)`), each bar's fill = actual axle load, a marker line = the per-axle-index legal limit from `limits.axle{N}`. Ties thematically to `CLAUDE.md` §1's framing — "violations get caught at weighbridges, after the truck has left" — the product visually becomes the weighbridge the officer never has to drive onto. Fits the existing dark-graphite "instrumentation" density described in `DESIGN.md` §3 for `/dispatch`.
2. **Total gross weight as a single fuel-gauge-style dial**, needle sweeping toward the axle-config-specific `GROSS_WEIGHT` limit (this is where axle config *does* legitimately matter, per §1 above), with the per-axle bars as a secondary, smaller readout beneath it.
3. **Weight distribution as a horizontal stacked bar under the truck envelope itself** — segments positioned left-to-right roughly where each axle sits along the drawn truck length, so the top-down view and the weight readout share one visual spine instead of being two unrelated widgets. Most ambitious, most visually unified; also the most implementation risk given the extra positional mapping.

No recommendation locked in — revisit after this spec ships.

---

## 8. Edge cases

- Empty/invalid form values (mid-edit, cleared field): inner rect does not render, or renders at zero/hidden rather than animating to `NaN`.
- `limits` not yet loaded (network delay/failure, same silent-failure posture as `Dispatch.jsx`'s existing `useEffect`): outer rect does not render; component shows a quiet placeholder rather than a broken shape, consistent with `CLAUDE.md` §6 ("handle failure gracefully in the UI").
- Extreme overflow (e.g., a length far beyond 120% of the limit): visual clamps at the canvas edge rather than the SVG growing unbounded; the numeric excess is still available from the existing `Field` excess text, so nothing is hidden, only the drawing is capped.

## 9. Verification

No new backend surface, so `manage.py test apps` is unaffected. Frontend has no test runner (`CLAUDE.md` §4, deliberate). Verification is browser-only, per `CLAUDE.md` §6: exercise `/dispatch` with a PASS-shaped load (headroom on all axes), a HOLD-shaped load exceeding length only, one exceeding width only, and one exceeding height only, confirming the stretch animation and overflow colour on each axis independently.
