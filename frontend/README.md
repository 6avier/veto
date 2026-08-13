# frontend

Vite + React + Tailwind. See the [root README](../README.md) for lane ownership and how to run it.

- `src/api/` — axios layer. One module per contract section.
- `src/routes/` — one file per surface.

The app talks to the API only; mock mode was removed in `c5a03b4`. Run Django on `:8000` and the Vite proxy forwards `/api` to it.

**A HOLD is HTTP 403 and axios throws on it.** Use `validateDispatch()` from `@/api`, which absorbs that.
