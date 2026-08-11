# frontend

Vite + React + Tailwind. See the [root README](../README.md) for lane ownership and how to run it.

- `src/api/` — axios layer. One module per contract section. Every call has a mock branch.
- `src/mocks/` — imports the canonical fixtures from `/contract`. Do not hand-edit response shapes here.
- `src/routes/` — one file per surface.

`VITE_USE_MOCKS=true` in `.env.local` runs the whole app without a backend.

**A HOLD is HTTP 403 and axios throws on it.** Use `validateDispatch()` from `@/api`, which absorbs that.
