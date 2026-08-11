# VETO Regulatory Corpus — Coverage Report
Generated: 2026-08-11T16:12:57.078642

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total regulations discovered | 29 |
| Active (BERLAKU) | 18 |
| Revoked (DICABUT) | 3 |
| Amended (DIUBAH) | 3 |
| Unknown status | 5 |
| Articles extracted | 16 |
| Structured rules | 13 |
| Numeric thresholds | 18 |
| Sanctions documented | 5 |
| Vehicle rules | 3 |
| Cargo rules | 3 |
| Road rules (national) | 4 |
| Road rules (local) | 1 |
| Local regulations | 13 |
| Regulation relationships | 19 |
| Regulations needing verification | 10 |
| Detected conflicts | 3 |
| Unresolved conflicts (legal review) | 1 |

## Regulation Type Breakdown

| Type | Count | Active | Revoked |
|------|-------|--------|---------|
| INPRES | 1 | 0 | 0 |
| KEPMENHUB | 1 | 0 | 0 |
| PERDA | 1 | 1 | 0 |
| PERDIRJEN | 1 | 1 | 0 |
| PERGUB | 2 | 1 | 0 |
| PERMENHUB | 11 | 6 | 3 |
| PP | 7 | 6 | 0 |
| SE_DIRJEN | 1 | 0 | 0 |
| SE_MENHUB | 1 | 1 | 0 |
| UU | 3 | 2 | 0 |

## Coverage Areas

### ✅ Confirmed Coverage
- Vehicle dimensions (width/length/height) — national standards per road class
- MST (Muatan Sumbu Terberat) per road class (Kelas I/II/III/Khusus)
- JBI framework (JBI per axle config — values need lampiran verification)
- Road class definitions (Kelas I, II, III, Khusus)
- Periodic vehicle testing (uji berkala) — 6-month interval
- Type approval (uji tipe) — requirements for modification
- ODOL enforcement mechanisms (normalisasi, jembatan timbang, WIM)
- Criminal sanctions (Pasal 307: denda ≤Rp500.000 / kurungan ≤2 bulan)
- Administrative sanctions (normalisasi/pembongkaran, penahanan kendaraan)
- DKI Jakarta local truck restrictions (partial — hours/routes need verification)
- Trailer/semitrailer dimension rules
- Dangerous goods transport framework (B3)
- Special cargo permit requirements
- Weigh-In-Motion (WIM) legal framework

### ⚠️ Requiring Additional Research
- JBI tables by axle configuration (full PP 55/2012 Lampiran needed)
- Perdirjen technical regulations on WIM procedures
- 2024–2026 regulatory updates (Zero ODOL 2027 implementation decrees)
- Provincial regulations beyond DKI Jakarta (all UNKNOWN status)
- City/regency regulations (Cikarang, Bekasi, Karawang, Surabaya, Medan, Semarang)
- Police (Korlantas) enforcement regulations
- Ministry of Public Works (PUPR) bridge/road load regulations
- Presidential instructions on Zero ODOL 2027

## Official Source Priority

| Priority | Source | URL |
|----------|--------|-----|
| 1 | JDIH BPK | https://peraturan.bpk.go.id/ |
| 2 | JDIH Kemenhub | https://jdih.kemenhub.go.id/ |
| 3 | peraturan.go.id | https://peraturan.go.id/ |
| 4 | JDIH DKI Jakarta | https://jdih.jakarta.go.id/ |
| 5–11 | Provincial JDIH portals | Various |

> **WARNING**: All thresholds marked `verification_required: true` must be confirmed
> against official PDF text before use in production, especially JBI values by axle config.

> **WARNING**: The 5% tolerance in PM 18/2021 is for weighbridge measurement purposes,
> NOT an additional legal allowance above JBI. VETO must enforce JBI as the hard legal limit.
