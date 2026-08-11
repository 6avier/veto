# backend

Django + DRF, managed with uv. See the [root README](../README.md) for lane ownership and how to run it.

- `config/` — settings, root URLs, the contract error-envelope handler
- `apps/validation` — `POST /validate`. Currently a **stub**; see the docstring in `views.py`
- `apps/audit` — decisions and overrides. Not started
- `apps/rules` — Rule Studio. Owned by the Rule Studio lane
- `apps/profiles` — vehicle profiles, P2

```bash
uv run python manage.py test apps
```

Those tests assert live responses against `/contract/*.json`, which are also the frontend's mocks. Keep them green.
