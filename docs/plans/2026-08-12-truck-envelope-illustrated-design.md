# Truck Envelope — Illustrated Redesign

**Status:** Design validated through iterative visual mockups (superpowers visual companion, screenshot-verified at each round) with 6avier. Ready for implementation planning.

**Builds on:** [`2026-08-12-truck-envelope-design.md`](2026-08-12-truck-envelope-design.md) and [`2026-08-12-truck-envelope-implementation.md`](2026-08-12-truck-envelope-implementation.md) — both already shipped to `main`. This doc replaces only the *visual* layer (plain rectangles → illustrated truck), not the underlying geometry engine (`axisGeometry`), the data flow (`limits`, live form values, no new API), or the placement (full-width block below the form+VerdictPanel grid on `/dispatch`).

---

## 1. What's changing and what isn't

**Not changing:** `axisGeometry()`'s math (canvas padding, `over` boolean, clamping), that `TruckEnvelope` reads `limits`/`length`/`width`/`height` exactly as it does today, that dimension limits are flat (not axle-config scoped), that the widget lives below the dispatch form/verdict grid, no new backend endpoint.

**Changing:** every shape drawn. Plain outer/inner rectangles become an illustrated truck (cab + wheels + detailed cargo box) in both the top-down and side views, with a **two-tier detail system** and a **colour rule that deliberately overrides `DESIGN.md`**.

---

## 2. Two detail tiers

- **Outer (legal max)**: a plain, dashed, undetailed silhouette — just the cab outline and a bare box rectangle. Fixed size always (the legal threshold never changes).
- **Inner (live input)**: the detailed truck — mirror, windshield glass, door line, wheel hubs (side view), panel lines and a rear door seam on the box, wheel-hint markers (top view). Sized to the live form value, spring-animated on change (unchanged Motion setup from the shipped version).

**Implementation simplification:** because the cab is identical in size and position between outer and inner (it's a fixed decorative element — see §3), the outer tier's cab silhouette is **never actually drawn**. It would be 100% covered by the inner cab painted on top of it regardless. Only the outer tier's *box* needs to render (dashed rect), since that's the only outer-tier shape whose boundary is ever visible (peeking out past/short of the inner box).

---

## 3. The cab is fixed, and anchored to the outer envelope

The cab (mirror, windshield, wheels-under-cab) never changes size or moves — it's decoration establishing "this is a truck," not data. Because it's fixed, it needs a fixed anchor point, and that anchor is the **outer (legal-max) envelope's centerline** — the one geometric reference that's also always fixed. (An earlier mockup round anchored the cab to a coordinate that didn't match the outer envelope's actual center and it visibly sat off-axis from the box; this is the fix for that.)

**Top-down cab shape:** a tapered hood — full width at the box junction, straight taper facets narrowing forward, one small rounded curve only at the very nose tip (everywhere else is straight-edged, which is what let earlier rounds keep every detail cleanly separated instead of fighting curve-inset math by hand). Windshield is one glass-filled rect sitting safely inside the taper's full-width section. Mirrors are small rects **overlapping** the cab's top/bottom edge by a couple of units — not connected by a thin stalk line, which at real render size was nearly invisible and made the mirrors read as floating, disconnected debris (caught by an actual browser screenshot, not by eyeballing the SVG source).

**Side-view cab shape:** bumper, hood, windshield rake, roof, back — five straight edges plus one shared vertex, no curves. Windshield glass is an inset quad using points comfortably inside the frame (generous margin, not edge-hugging) rather than trying to hand-compute a tight inset against angled edges. Mirror is a small rect on a short stalk, positioned with real clearance from the windshield corner.

---

## 4. Colour: green fits, red overflows — a recorded DESIGN.md exception

Inner truck outline: **`#2f8f4e`** (candidate shade, confirm against the real render) when every dimension is within its limit, **`#a02a1f`** (existing convention, already used for live excess text in `DispatchForm.jsx`'s `Field`) the moment any dimension exceeds its limit.

**This directly overrides `DESIGN.md` §4** — "VETO never uses green" and "PASS has no colour... do not add a green tick" are both explicit, deliberate rules, not oversights. 6avier confirmed the override explicitly after being shown the conflict. **This implementation must also patch `DESIGN.md` §4** to record the exception (scoped to `TruckEnvelope.jsx` only — the ERP's green identity and VETO's "PASS has no colour" rule everywhere else stay exactly as documented). An undocumented deviation from a rule this explicit is worse than the deviation itself.

---

## 5. Wheels: anchored to the input box, not the max box

This took several rounds to nail down and is worth stating precisely, since it's the one piece of geometry that's genuinely new (the shipped version has no wheels at all).

**Top-down rear wheel-hint pair:** anchored to the **inner (live-input) box's own right edge**, not the fixed outer envelope. Two small rects, offset `boxRight − 30` and `boxRight − 12` (rect width 14, so the rearmost pair's right edge sits 2 units *past* `boxRight` — flush/overlapping, not floating with a gap before it). Same formula regardless of state — verified by screenshot that the offsets are numerically identical whether the box is short (headroom) or long (overflow), after an earlier round used two different, inconsistent offsets between the two example states.

Concretely, this means the wheel-hint rects move (and should spring-animate, same as the box) as the user types a different length — they are physically part of "this truck," and this truck's real size is the input, not the legal ceiling. The dashed max line is a fixed reference the input truck is measured against, not something the wheels ever attach to.

**Open detail for spec review:** the same principle — anchored to input, not max — presumably also applies to the *width* axis (front/rear wheel spread, i.e. the wheel-hint pair's Y-offset from center). This was asked about mid-brainstorm and the conversation moved on before getting an explicit yes/no. **Default assumption for planning purposes: yes, apply the same rule** (wheel Y-spread tracks the live width input, not the fixed legal width) for consistency with the length-axis fix. Flag this explicitly to 6avier when the spec is reviewed — if the answer is actually "no, width stays fixed to the outer envelope," that's a small, contained change to make before planning tasks.

**Side-view wheels:** unchanged from the already-confirmed axis convention — side view's horizontal extent is fixed/decorative (length isn't re-shown there; only height is data-driven), so there is no "input length" for side-view wheels to track. They stay at fixed `cx` positions, same as originally shipped.

---

## 6. Panel lines and the animation-sync problem

Both box treatments need evenly spaced vertical panel lines (cosmetic corrugation) across the *current* box length/width, plus a rear door seam line matching the fit/overflow colour.

**The real technical wrinkle:** Motion's `animate` prop drives the box's `motion.rect` via its own internal tween, updating the DOM directly every frame — it does not wait for a React re-render. Panel lines and wheel-hint rects, if computed as plain SVG elements from the same React state, would only update at React's (much coarser) render cadence, not in the same smooth per-frame sweep as the spring-animated outline. Rendered together, the outline would stretch smoothly while the lines inside it "snapped" to new positions in discrete jumps — visually mismatched.

**Recommended resolution, for confirmation during spec review:** don't fight this. Only the main outline (outer silhouette line + inner box outline) gets the full rubbery spring. Panel lines and wheel-hint rects recompute from the same plain (non-animated) geometry values on every render and simply snap to their new position — no spring on the secondary detail. This is a deliberate scope-limiting call: the "wow" of the widget is the outline stretching, and secondary cosmetic detail staying kinematically perfect with it is not worth the added complexity (animating N independently-positioned line elements, or wiring `useTransform` off the box's own motion value). If this reads as visually janky once actually built, revisit — but it should not block starting the implementation plan.

**Line count/spacing formula:** a fixed count (8, matching what read well in the mockups) evenly distributed as a fraction of the *current* animated width/length, not a fixed pixel spacing (which would mean a variable, jittery line count as the box resizes).

---

## 7. Verification

Same posture as the original `TruckEnvelope` plan: no frontend test runner, browser-only verification (`CLAUDE.md` §6). Given how much of this round's actual bugs (floating mirrors, misaligned cab center, inconsistent wheel offsets) were only caught by an actual Playwright screenshot rather than reading the SVG source, **the implementation plan should build in a self-verification screenshot pass as part of each visual task**, not defer all visual checking to a human pass at the end. The Playwright + headless Chromium approach already used during this brainstorming session (scratchpad-installed, no new project dependency) is a reasonable model for how an implementer task can self-check before reporting done.

---

## 8. Non-goals

Weight/axle-load visualization is still out of scope (per the original design doc's §7 — untouched, still just ideas, not built). No change to the validation engine, API, or `Dispatch.jsx`'s wiring into `TruckEnvelope` (same props: `length`, `width`, `height`, `limits`).
