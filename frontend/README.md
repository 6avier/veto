# frontend

Vite + React + Tailwind. See the [root README](../README.md) for what VETO is and
how to run both halves.

- `src/api/` — axios layer. One module per contract section.
- `src/routes/` — one file per surface: `Dispatch`, `RuleStudio`, `AuditLog`.
- `src/layouts/` — `ErpLayout` is the host ERP's chrome; `VetoLayout` is VETO's own.
- `src/index.css` — every design token. The system of record is [DESIGN.md](../DESIGN.md).

The app talks to the API only. Run Django on `:8000` and the Vite proxy forwards
`/api` to it.

**A HOLD is HTTP 403 and axios throws on it.** It is not an error — it is the
most important success path in the product. Use `validateDispatch()` from
`@/api`, which absorbs that and returns the decision for both outcomes.
