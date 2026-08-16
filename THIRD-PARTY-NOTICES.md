# Third-party notices

VETO is licensed under the GNU Affero General Public License v3.0 — see
[LICENSE](LICENSE). The items below are **not** covered by that licence. They
carry their own terms, and those terms continue to apply to them.

---

## SAP 72 (typeface)

```
frontend/src/assets/fonts/72-Regular.woff2
frontend/src/assets/fonts/72-Semibold.woff2
frontend/src/assets/fonts/72-Bold.woff2
```

The SAP **72** typeface, obtained from
[SAP/theming-base-content](https://github.com/SAP/theming-base-content), under
the **Apache License 2.0**. The full licence text sits beside the files as
`frontend/src/assets/fonts/LICENSE-Apache-2.0.txt`, with attribution in
`frontend/src/assets/fonts/NOTICE.md`.

Apache-2.0 is one-way compatible with AGPL-3.0: Apache-licensed files may be
included in an AGPL-licensed work, the combined work is AGPL, and the Apache
terms keep governing those files. Nothing here relicenses them.

72 is used for the fictional host ERP surface only — the NUSANTARA WMS chrome
and the dispatch form — because that surface is meant to read as ordinary
enterprise software. VETO's own surfaces use Archivo and JetBrains Mono, both
installed as npm dependencies under the SIL Open Font License.

**On record:** Apache-2.0 is an unusual licence for a typeface, and SAP's own
marketing describes 72 as designed for SAP products. This is fine for a
competition build and a portfolio artefact. Have it reviewed before any
commercial release.

## Indonesian regulatory text

Legal citations, article references and threshold figures throughout this
repository — including `data/regulations/` and the seeded rule packs in
`backend/apps/rules/migrations/` — derive from Indonesian government
regulations, principally PP 55/2012, PM 60/2019 and PM 18/2021.

Government regulations are public law and are not the copyright of this
project. They are reproduced here as references. **They are not verified for
operational use**, which is stated plainly in
[docs/ENGINEERING.md](docs/ENGINEERING.md) §5 and in the README.

## Runtime dependencies

Every npm and Python package is installed from its registry rather than vendored
into this repository, and each keeps its own licence. The full sets are pinned in
`frontend/package-lock.json` and `backend/uv.lock`.

## NUSANTARA WMS

The host ERP shown at `/dispatch` — its name, logo and interface — is invented
for this project. It is not a real product and does not depict any real company.
