# VETO — Script Demo ke Juri

Pitch sudah dibawakan teman satu tim. Ini murni jalan-jalan di aplikasinya.
Target **2–3 menit**. Alur: Rule Studio → aturan pusat → persetujuan → ERP klien
→ LOLOS / TAHAN.

---

## 0. Buka (10 detik)

> "Saya **[nama]**, saya lanjut demoin aplikasinya langsung ya, Pak/Bu."

Langsung buka **Rule Studio**. Jangan menjelaskan latar belakang lagi.

---

## 1. Rule Studio — upload SOP klien (45 detik)

**Upload dokumen SOP.**

> "Peraturan pemerintah sudah kami pelihara terpusat, jadi klien tidak upload
> apa-apa soal itu. Yang di-upload cuma **kebijakan internal mereka sendiri**.
>
> Sebelum masuk ekstraksi, dokumennya **ditriase dulu**. Kalau yang masuk
> ternyata packing list atau invoice, ditolak di sini, tidak lanjut."

Sambil tahapan jalan:

> "Baca dokumen, temukan klausa, susun ambang batas, lalu **bandingkan dengan
> basis aturan VETO**."

---

## 2. Split-screen + aturan pusat (30 detik)

Tunjuk **kiri vs kanan**.

> "Kiri hasil ekstraksinya, kanan halaman asli dengan kalimat sumbernya
> ditandai. Orang legal **verifikasi ke dokumen**, bukan percaya ke AI."

Scroll ke **Aturan yang berlaku** → buka grup **Konfigurasi 1.2.2**.

> "Ini basis aturan pusat. Tronton 1.2.2, batas nasional **24.000 kg**.
> SOP klien tadi **22.000 kg** — lebih ketat."

---

## 3. Setujui (15 detik)

Klik **Setujui**.

> "AI cuma menyusun draf. Yang bikin aturan ini aktif **manusia**, dan namanya
> tercatat. Aturannya masuk sebagai **versi baru**, tidak menimpa yang lama."

---

## 4. ERP klien — input data (45 detik)

Klik tab **Client ERP**.

> "Ini bukan aplikasi VETO. Ini **ERP milik klien**. Petugas gudang tidak pernah
> buka VETO."

Isi:

| Field | Nilai |
|---|---|
| Konfigurasi sumbu | **1.2.2 — tronton** |
| Berat kosong | **8500** |
| Sumbu depan / tengah / belakang | **6000 / 9000 / 8000** |
| Panjang / Lebar / Tinggi | **9000 / 2400 / 4000** |

> "Berat kotor **tidak diketik** — dihitung dari jumlah beban sumbu. **23.000 kg.**
> Catat: 23 ton ini **legal secara nasional**, di bawah 24 ton tadi."

Klik **Validasi ke VETO**.

---

## 5. TAHAN (40 detik)

> "**TAHAN** — dan alasannya **`[ SOP KLIEN ]`**.
>
> Legal menurut negara, melanggar SOP gudangnya sendiri. Kalau aturan klien dan
> aturan pusat mengatur hal yang sama, **yang lebih ketat yang dipakai.**
>
> Dan bukan cuma bilang salah — dia bilang **kurangi berapa kilo dari sumbu
> mana**, plus dasar hukumnya. Surat jalannya **terkunci** sampai diperbaiki."

**Perbaiki satu sumbu → submit ulang → LOLOS.**

> "Sekarang tombol **Cetak Surat Jalan** terbuka."

Klik tombolnya, tunjukkan pratinjau surat jalannya sebentar.

---

## 6. Jejak Audit (20 detik)

Buka **Jejak Audit**.

> "Dua keputusan tadi tercatat — versi aturan, dasar hukum, waktunya.
> **Tidak bisa diubah, tidak bisa dihapus.**"

Tutup:

> "Segitu, Pak/Bu. Silakan kalau mau coba sendiri."

---

## Kalau ditanya

**"Kalau petugasnya bohong soal beratnya?"**
> "Betul, VETO memeriksa angka yang **dideklarasikan**, bukan hasil timbangan —
> kalimat itu kami tulis terang di layarnya. Timbangan dan IoT fase berikutnya."

**"Kenapa validasinya tidak pakai AI?"**
> "Menyangkut sanksi hukum. Harus **sama persis setiap kali** dan bisa ditelusuri
> ke pasalnya. Nol panggilan AI waktu validasi."

---

## Catatan buat kamu sendiri

- **Demo dari URL yang sudah dideploy**, jangan laptop lokal — ambang tandem di
  database lokal masih versi lama.
- **SOP klien harus sudah siap di-upload.** Kalau ekstraksi AI gagal, **lompat
  langsung ke langkah 4** — mesin validasinya jalan penuh tanpa AI.
- Juri buru-buru? **Langkah 4 dan 5 saja.**
- Jangan sebut angka atau pasal yang tidak ada di layar.
