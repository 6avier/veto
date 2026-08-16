# backend

Django + DRF, managed with uv. See the [root README](../README.md) for what VETO
is and how to run both halves.

- `config/` — settings, root URLs, the contract error-envelope handler
- `apps/validation` — `POST /validate`. `engine.py` is the deterministic
  evaluator: boolean checks against versioned rule packs, no model calls
- `apps/audit` — decisions, violations, and append-only overrides
- `apps/rules` — Rule Studio: upload, triage, extraction, candidate approval
- `apps/profiles` — vehicle profiles

```bash
uv run python manage.py test apps
```

Those tests assert live responses against `/contract/*.json`, the fixtures the
frontend is built against. Keep them green — they are what stops the two halves
drifting apart.
