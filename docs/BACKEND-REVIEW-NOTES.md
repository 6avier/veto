# Backend review: apa aja yang diubah

Buat Iqbal. Backend di-review lalu di-fix langsung (sekali ini aja pegang lane backend). Semua test lulus (38 test lama + 18 baru = 56), dan alur PASS / HOLD / override / audit / Rule Studio udah dicek di app lokal.

**Yang perlu kamu lakuin:** pull `main`, jalanin `python manage.py migrate` (ada migration baru `rules.0010`), terus baca bagian "Perubahan perilaku" di bawah. Ada beberapa respons API yang dulunya 200/403 sekarang jadi 400 atau 409.

---

## 1. Bug yang bisa bikin demo rusak

### Override HOLD diblok CSRF di production
`apps/audit/views.py`. View audit tadinya pakai Django `View` biasa, jadi kena `CsrfViewMiddleware`. POST override dari frontend (beda origin, ga ada cookie CSRF) bakal balik **403**. Test-nya tetep lulus karena test client Django ga ngecek CSRF.
→ Ketiga view audit sekarang pakai DRF `APIView`, jadi dapet parsing, error envelope, dan rate limit yang sama kayak endpoint lain.

### Rule SOP klien hasil Rule Studio ga pernah dipakai engine
`Rule.axle_config` dari Rule Studio bentuknya list (`["1.2.2"]`), sedangkan engine ngebandinginnya pakai `==` ke string `"1.2.2"`. Hasilnya ga pernah cocok, jadi rule yang udah di-approve diem-diem dilewatin.
→ `engine._config_matches()` sekarang nerima string atau list, dan list dibaca sebagai "salah satu dari ini".

### Input aneh bikin 500
`vehicle` berupa string, `axle_config` berupa angka, dimensi berupa string, `dispatch_ref` lebih dari 100 karakter (di Postgres jadi DataError), profile dengan `tare_weight_kg: "abc"`, output LLM berbentuk object bukan array: semuanya dulu 500.
→ Semua field dicek tipe dan batasnya di `validation/views.py`, `profiles/views.py`, dan `rules/candidates.py` (file baru). Sekarang balik 400 dengan `field`.

### Cache ALPR satu buat semua orang
`vision.py`. Key `veto-alpr-latest-session` dipakai semua caller selama 60 detik, jadi scan truk kedua dalam rentang itu dapet plat truk pertama.
→ Cache sekarang per caller (`client_ident`) dan cuma 15 detik. Hasil fallback (pas OpenAI gagal) ga di-cache lagi.

---

## 2. Celah logika

| Masalah | Fix |
|---|---|
| Gross ga dicek kalau `axle_config` kosong atau ga dikenal (60 t lolos PASS) | `axle_config` sekarang **wajib**. Config tanpa rule JBI CENTRAL → 400 `field: axle_config` |
| Rule 18 t "Sumbu Ganda/Tandem" (`axle_index=1`) berlaku buat semua config, jadi sumbu belakang tunggal truk 1.2 dinilai pakai limit tandem | Migration `0010`: rule itu dibatasi ke `["1.2.2", "1.2.2-2.2", "1.2.2-2.2.2"]`. Truk 1.2 sekarang jatuh ke fallback 10 t |
| Cek "gross ≠ jumlah sumbu" ditulis sebagai violation CENTRAL dengan citation `"Integritas Data Sumbu vs Total"` (bukan pasal hukum) | Sekarang jadi **400** `field: gross_weight_kg` dan ga masuk audit. Frontend ga kena karena gross = jumlah sumbu |
| Saran "geser muatan" selalu ke sumbu pertama yang masih ada ruang, bisa bikin sumbu depan overload | Pilih sumbu dengan ruang terbesar, bisa dibagi ke beberapa sumbu, dan cuma muncul kalau ruangnya cukup |
| Saran pengurangan gross dibagi proporsional ke semua sumbu (termasuk yang ga overload), jumlahnya ga pas, dan ada hardcode `limit = 10000` | Sumbu yang overload dikurangi duluan, sisanya proporsional, totalnya pas. Kalau ada sumbu tanpa rule, ga ada saran |
| Override bisa ditimpa (padahal audit "immutable"), reason 10 spasi lolos | Override kedua → **409**. Reason di-trim, 10–2000 karakter |
| Approve dobel (double click) bikin 2 rule | `transaction.atomic` + `select_for_update`. Approve kedua → 409 |
| Extract ulang dokumen yang sama numpuk kandidat dobel | Kandidat PENDING dokumen itu diganti. Yang udah di-review tetep disimpen |
| `applies_to.vehicle_class` diabaikan, jadi rule "Pickup: 3.500 kg" berlaku ke **semua** truk (sample SOP NLI isinya tabel kelas kendaraan!) | Kelas yang jelas dipetakan ke config (`rules/candidates.py: VEHICLE_CLASS_AXLE_CONFIGS`, misalnya Tronton → 1.2.2). Kelas ambigu (Pickup, Light/Medium/Heavy Truck) → approve ditolak 409 dengan pesan |
| Rule pack klien selalu v1 | Setiap approve naikin `version` pack CLIENT |
| Kandidat fallback "belum-diverifikasi" jadi rule aktif dengan citation = nama file | Masih boleh di-approve (biar demo tetep jalan kalau OpenAI mati), tapi citation-nya dikasih "(cadangan, belum diverifikasi)" |
| Body type yang ga kebaca di-default ke `BAK_TERPAL`, jadi DUMP_TRUCK terdaftar dapet peringatan palsu "Tukar Pelat" | Body type yang ga kebaca jadi `null`, dan ga dibandingin ke register |
| Teks PDF dipotong 10.000 karakter (tabel dimensi sample SOP kepotong), komentar `# Limit text...` ikut kekirim ke LLM | Batas dinaikin ke 60.000. Prompt diperjelas: payload ≠ GROSS_WEIGHT, overhang di-skip, `vehicle_class` diminta |
| Output LLM ga divalidasi (dimension di luar enum, `"24 ton"`, unit `m`) | `sanitize_candidate()`: enum dicek, unit dikonversi (ton→kg, m/cm→mm), entry yang ga valid dibuang |
| PDF rusak → 500, file-nya ketinggalan di disk | 400 `field: file` dan file-nya dihapus |

---

## 3. Throttle (booth)

Satu laptop booth atau NAT venue = satu IP buat semua pengunjung. Batas lama (10 extract / 30 write per jam) bakal habis dalam satu jam.

| Scope | Lama | Baru | Env var |
|---|---|---|---|
| upload | 12/hour | 60/hour | `THROTTLE_UPLOAD` |
| extract | 10/hour | 40/hour | `THROTTLE_EXTRACT` |
| write | 30/hour | 300/hour | `THROTTLE_WRITE` |

Batas biaya OpenAI tetep dipegang `EXTRACT_DAILY_CAP` dan `VISION_ALPR_DAILY_CAP`. Override sekarang ikut scope `write`.

**Penting buat hari booth:** sejak commit `e31ffdf` (ALPR dari CAM 01 di setiap frame selama plat belum ketemu), satu scanner yang terus jalan bisa manggil OpenAI sampai ~4×/menit, karena cache per caller 15 detik. Dengan `VISION_ALPR_DAILY_CAP=120`, jatahnya habis kira-kira dalam 30 menit scanning nonstop, dan setelah itu ALPR jatuh ke fallback (tanpa plat). Naikin `VISION_ALPR_DAILY_CAP` di Render sebelum booth.

---

## 4. Kecil-kecil

- `/validate`: decision + violations ditulis dalam satu `transaction.atomic`.
- `evaluated_at` di respons sekarang diambil dari row yang tersimpan (dulu ada dua timestamp yang beda).
- `rule_packs_applied` urutannya stabil (dulu dari `set`).
- Import yang ga kepakai dibuang.
- `DocumentPageView`: PNG halaman di-cache pakai `lru_cache(32)`, jadi ga dirender ulang tiap pindah halaman.
- `contract/validate.response.hold.json`: wording directive gross disesuaikan dengan saran yang baru.

---

## 5. Perubahan perilaku API (cek kalau ada client lain)

- `POST /validate` tanpa `vehicle.axle_config` → **400** (dulu diterima).
- `POST /validate` dengan gross ≠ jumlah sumbu (selisih > 500 kg) → **400** (dulu HOLD).
- `POST /validate` dengan config tanpa batas JBI (misal `"1.22"`) → **400**.
- `POST /decisions/{id}/override` yang kedua → **409**.
- `POST /rule-candidates/{id}/approve` buat kelas kendaraan yang ga terpetakan → **409**.
- Error 409 sekarang pakai `code: "CONFLICT"` (dulu `VALIDATION_ERROR`), sama kayak mapping di `config/exceptions.py`.
- `alpr.detected_body_type` dan `fleet_match.detected_body_type` bisa `null`.
- Truk 1.2 dengan sumbu belakang > 10 t sekarang HOLD (dulu limitnya 18 t).

---

## 6. Belum disentuh, perlu keputusan / verifikasi

1. **Limit tandem masih per sumbu, bukan per grup.** Di 1.2.2, sumbu tengah limitnya 18 t dan sumbu belakang 10 t. Yang benar seharusnya limit grup tandem (jumlah dua sumbu). Ini butuh modeling grup sumbu dan verifikasi angka regulasi.
2. **Mapping kelas kendaraan → konfigurasi** (`VEHICLE_CLASS_AXLE_CONFIGS`) masih asumsi, ada `TODO: verify`.
3. **Roboflow fallback v8 → v6**: setiap frame kosong manggil model dua kali (latency dobel). Dibiarkan karena kelihatannya disengaja.
4. **`classification_confidence` 0.95/0.98** di upload itu angka hasil heuristik keyword, bukan confidence beneran. Kalau tampil di UI, ini nyerempet numbers policy.
5. File upload ada di disk Render yang ephemeral. Setelah restart, `Document` masih ada di DB tapi file-nya hilang (page view → 404).
6. Frontend belum punya tombol override (`overrideDecision` ada di `api/` tapi ga dipanggil).

## File yang berubah

```
backend/apps/validation/engine.py, views.py, vision.py, fleet_registry.py
backend/apps/rules/views.py, candidates.py (baru), migrations/0010_scope_tandem_axle_rule.py (baru)
backend/apps/audit/views.py
backend/apps/profiles/views.py
backend/config/settings.py, backend/.env.example
backend/apps/validation/tests/test_review_fixes.py (baru)
backend/apps/rules/tests/test_review_fixes.py (baru)
contract/validate.response.hold.json
```
