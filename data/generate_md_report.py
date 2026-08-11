import json, os, datetime
import re

DATA_DIR = r'd:\VETO\data\regulations'
OUTPUT   = r'd:\VETO\data\VETO_Regulatory_Corpus.md'
NOW      = datetime.datetime.now().strftime('%d %B %Y, %H:%M WIB')

def load(f):
    p = os.path.join(DATA_DIR, f)
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else []

REGS   = load('01_regulations.json')
RELS   = load('02_regulation_relationships.json')
ARTS   = load('03_articles.json')
RULES  = load('04_rules.json')
THRS   = load('05_numeric_thresholds.json')
VEH    = load('06_vehicle_rules.json')
CARGO  = load('07_cargo_rules.json')
ROAD   = load('08_road_rules.json')
SANS   = load('09_violation_sanctions.json')
SRCS   = load('10_sources.json')
LOCAL  = load('11_local_regulations.json')
CONF   = load('conflicts.json')

n_act  = sum(1 for r in REGS if r.get('status')=='BERLAKU')
n_cab  = sum(1 for r in REGS if r.get('status')=='DICABUT')
n_ubh  = sum(1 for r in REGS if r.get('status')=='DIUBAH')
n_unk  = sum(1 for r in REGS if r.get('status')=='UNKNOWN')
n_ver  = sum(1 for r in REGS if r.get('verification_required'))

STATUS_ICON = {'BERLAKU':'✅','DICABUT':'🚫','DIUBAH':'🔄','UNKNOWN':'❓'}
PRI_ICON    = {'KRITIS':'🔴','TINGGI':'🟠','SEDANG':'🔵','RENDAH':'⚪'}

md = []
a = md.append

# ── HEADER ────────────────────────────────────────────────────────────────────
a('---')
a('title: VETO — Indonesian Road Freight Regulatory Corpus')
a('subtitle: ODOL Dispatch Validation System — Regulatory Knowledge Base')
a(f'generated: {NOW}')
a('version: 1.0.0')
a('status: Phase 1 — Known Corpus Build')
a('---')
a('')
a('# 🚛 VETO — Indonesian Road Freight Regulatory Corpus')
a('')
a('> **ODOL (Over Dimension Over Loading) Compliance & Dispatch Validation System**')
a(f'> Generated: {NOW}')
a('')

# ── STATS BADGES ──────────────────────────────────────────────────────────────
a('---')
a('')
a('## 📊 Ringkasan Statistik')
a('')
a('| Metrik | Nilai | Keterangan |')
a('|--------|-------|------------|')
a(f'| 📋 Total Regulasi | **{len(REGS)}** | UU, PP, Permenhub, SE, Perdirjen, Lokal |')
a(f'| ✅ Berlaku (Aktif) | **{n_act}** | Dapat diterapkan langsung |')
a(f'| 🚫 Dicabut | **{n_cab}** | Referensi historis |')
a(f'| 🔄 Diubah | **{n_ubh}** | Berlaku dengan perubahan |')
a(f'| ❓ Status Unknown | **{n_unk}** | Perlu verifikasi |')
a(f'| 📖 Pasal Diekstrak | **{len(ARTS)}** | Dengan teks asli + normalisasi |')
a(f'| ⚙️ Aturan Mesin | **{len(RULES)}** | Machine-readable conditional rules |')
a(f'| 🔢 Threshold Numerik | **{len(THRS)}** | Dimensi, MST, JBI, Sanksi |')
a(f'| ⚖️ Sanksi | **{len(SANS)}** | Pidana & Administratif |')
a(f'| 🗺️ Regulasi Daerah | **{len(LOCAL)}** | Provinsi & kota |')
a(f'| 🔗 Relationships | **{len(RELS)}** | IMPLEMENTS / AMENDS / REVOKES |')
a(f'| ⚠️ Butuh Verifikasi | **{n_ver}** | Nilai perlu konfirmasi dari PDF resmi |')
a(f'| ⚡ Konflik | **{len(CONF)}** | 1 unresolved — perlu legal review |')
a('')

# WARNING BOX
a('> [!CAUTION]')
a('> **Toleransi 5% dalam PM 18/2021** adalah toleransi teknis alat ukur di jembatan timbang,')
a('> **BUKAN** tambahan allowance hukum di atas JBI. VETO **HARUS** menggunakan JBI sebagai')
a('> batas keras (*hard limit*). Nilai `verification_required: true` wajib dikonfirmasi dari PDF resmi.')
a('')

# ── TOC ────────────────────────────────────────────────────────────────────────
def slugify(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text.strip('-')

a('---')
a('')
a('## 📋 Daftar Isi')
a('')
toc = [
    ('1','Corpus Regulasi Lengkap (29)','UU, PP, Permenhub, SE, Perdirjen, Lokal'),
    ('2','Top 10 Regulasi Prioritas VETO','Regulasi paling kritis untuk engine validasi'),
    ('3','Pasal-Pasal Kunci (16 Pasal)','Teks asli & aturan ternormalisasi'),
    ('4','Aturan Mesin — Machine-Readable Rules','13 conditional rules siap pakai'),
    ('5','Threshold Numerik (18 Nilai)','Semua batas angka: dimensi, MST, JBI, sanksi'),
    ('6','Aturan Kendaraan per Konfigurasi Sumbu','JBI/MST per axle config'),
    ('7','Matriks Kelas Jalan','Batas dimensi & MST per kelas jalan'),
    ('8','Sanksi & Pelanggaran','Pidana dan administratif'),
    ('9','Regulasi Daerah (13 Daerah)','13 daerah: provinsi & kota'),
    ('10','Graf Relasi Regulasi','IMPLEMENTS / AMENDS / REVOKES'),
    ('11','Konflik Regulasi & Resolusi','3 konflik terdeteksi'),
    ('12','Sumber Resmi','7 portal JDIH resmi'),
    ('13','Gaps & Missing Regulations','10 gap kritis'),
]
for num, title, desc in toc:
    slug = slugify(f"{num} {title}")
    a(f'{num}. [{title}](#{slug})')
    a(f'   *{desc}*')
a('')

# ── SECTION 1 — REGULATIONS ──────────────────────────────────────────────────
a('---')
a('')
a('## 1. Corpus Regulasi Lengkap (29)')
a('')

type_order = ['UU','PP','PERMENHUB','SE_MENHUB','SE_DIRJEN','PERDIRJEN','KEPMENHUB','INPRES','PERGUB','PERDA']
type_labels = {
    'UU':'Undang-Undang (UU)', 'PP':'Peraturan Pemerintah (PP)',
    'PERMENHUB':'Peraturan Menteri Perhubungan (Permenhub)',
    'SE_MENHUB':'Surat Edaran Menteri Perhubungan',
    'SE_DIRJEN':'Surat Edaran Direktur Jenderal',
    'PERDIRJEN':'Peraturan Direktur Jenderal',
    'KEPMENHUB':'Keputusan Menteri Perhubungan',
    'INPRES':'Instruksi Presiden',
    'PERGUB':'Peraturan Gubernur',
    'PERDA':'Peraturan Daerah',
}
grouped = {}
for r in REGS:
    grouped.setdefault(r.get('type','OTHER'), []).append(r)

for rtype in type_order:
    if rtype not in grouped: continue
    regs = grouped[rtype]
    a(f'### {type_labels.get(rtype, rtype)}')
    a('')
    a('| # | ID | Nomor/Tahun | Judul | Status | Subjek |')
    a('|---|----|-------------|-------|--------|--------|')
    for i, r in enumerate(regs, 1):
        sid  = STATUS_ICON.get(r.get('status','?'),'❓')
        subj = ', '.join(r.get('subjects',[])[:3])
        url  = r.get('official_urls',[''])[0] if r.get('official_urls') else ''
        title_link = f'[{r["title"][:55]}]({url})' if url else r['title'][:55]
        note = ' ⚠️' if r.get('verification_required') else ''
        a(f'| {i} | `{r["id"]}` | **{r.get("type","")} {r.get("number","?")} / {r.get("year","?")}** | {title_link} | {sid} {r.get("status","?")} | {subj}{note} |')
    a('')
    # Detail cards
    for r in regs:
        if r.get('notes'):
            icon = STATUS_ICON.get(r.get('status','?'),'❓')
            a(f'> **{r["id"]}** {icon} — {r["notes"]}')
    a('')

# ── SECTION 2 — TOP 10 ────────────────────────────────────────────────────────
a('---')
a('')
a('## 2. Top 10 Regulasi Prioritas VETO')
a('')
a('> [!IMPORTANT]')
a('> Regulasi berikut adalah core knowledge base untuk VETO Validation Engine.')
a('> Semua aturan validasi dispatch harus merujuk ke regulasi-regulasi ini.')
a('')

top10 = [
    ('UU_22_2009','KRITIS','Pasal 19-22: kelas jalan + MST. Pasal 169: larangan muatan lebih. Pasal 307: denda ≤Rp500.000 / kurungan ≤2 bulan.'),
    ('PP_55_2012','KRITIS','Dimensi maks (lebar 2.500mm, tinggi 4.200mm, panjang 12.000/18.000mm). Lampiran: tabel JBI per konfigurasi sumbu — wajib diverifikasi.'),
    ('PERMENHUB_18_2021','KRITIS','MST per kelas jalan (I:10t, II/III:8t). WIM framework. Normalisasi overloaded. Toleransi 5% = teknis, bukan legal.'),
    ('PERMENHUB_60_2019','KRITIS','Tata cara operasional angkutan barang, perizinan, daya angkut, rute. Core permenhub untuk dispatch.'),
    ('PP_74_2014','TINGGI','PP Angkutan Jalan. Perizinan dan ketentuan operasional — dasar hukum PM 60/2019.'),
    ('PP_34_2006','TINGGI','Kelas jalan I/II/III dan MST yang diizinkan. Wajib untuk validasi rute kendaraan.'),
    ('PERMENHUB_19_2021','TINGGI','Uji berkala wajib tiap 6 bulan. Tanpa sertifikat valid = tidak laik jalan = HOLD.'),
    ('PERMENHUB_23_2021','TINGGI','Uji tipe & modifikasi. Perubahan dimensi/berat harus sertifikat uji tipe baru.'),
    ('PP_80_2012','TINGGI','Tata cara pemeriksaan kendaraan di jalan & penindakan. Dasar hukum jembatan timbang.'),
    ('SE_MENHUB_21_2019','TINGGI','SE khusus ODOL. Dasar operasional pengawasan muatan lebih & ukuran lebih.'),
]
for rank, (rid, priority, notes) in enumerate(top10, 1):
    r = next((x for x in REGS if x['id']==rid), {})
    icon  = PRI_ICON.get(priority,'⚪')
    sicon = STATUS_ICON.get(r.get('status','?'),'❓')
    url   = r.get('official_urls',[''])[0] if r.get('official_urls') else ''
    art_n = sum(1 for a2 in ARTS if a2.get('regulation_id')==rid)
    a(f'### {rank}. {icon} `{rid}` — [{priority}]')
    a('')
    a(f'| Field | Detail |')
    a(f'|-------|--------|')
    a(f'| **Regulasi** | **{r.get("type","")} No. {r.get("number","?")} Tahun {r.get("year","?")}** |')
    a(f'| **Judul** | {r.get("title","")} |')
    a(f'| **Status** | {sicon} {r.get("status","?")} |')
    a(f'| **Prioritas** | {icon} {priority} |')
    a(f'| **Pasal Diekstrak** | {art_n} artikel |')
    a(f'| **Relevansi VETO** | {notes} |')
    if url:
        a(f'| **URL Resmi** | [{url}]({url}) |')
    a('')

# ── SECTION 3 — ARTICLES ─────────────────────────────────────────────────────
a('---')
a('')
a('## 3. Pasal-Pasal Kunci (16 Pasal)')
a('')
a('> Teks asli bahasa Indonesia + normalisasi menjadi aturan mesin.')
a('')

for art in ARTS:
    rid = art.get('regulation_id','')
    reg = next((r for r in REGS if r['id']==rid), {})
    pasal = f'Pasal {art.get("article_number","?")}'
    if art.get('paragraph_number'): pasal += f' ayat ({art["paragraph_number"]})'
    if art.get('letter'):           pasal += f' huruf {art["letter"]}'
    sid = STATUS_ICON.get(art.get('legal_status','?'),'❓')

    a(f'### {sid} {reg.get("type","")} {reg.get("number","?")} — {pasal}')
    a('')
    a(f'**Topik:** {art.get("topic","")}')
    a('')
    a(f'> *"{art.get("indonesian_text","")}"*')
    a('')
    a(f'**Aturan Ternormalisasi:**')
    a('')
    a(f'```')
    a(art.get('normalized_rule',''))
    a(f'```')
    a('')
    if art.get('source_url'):
        a(f'🔗 Sumber: [{art["source_url"]}]({art["source_url"]})')
    if art.get('verification_required'):
        a(f'⚠️ *Perlu verifikasi dari teks PDF resmi.*')
    a('')

# ── SECTION 4 — RULES ────────────────────────────────────────────────────────
a('---')
a('')
a('## 4. Aturan Mesin — Machine-Readable Rules')
a('')
a('| Rule ID | Tipe | Parameter | Operator | Nilai | Unit | Kondisi | Aksi |')
a('|---------|------|-----------|----------|-------|------|---------|------|')
for r in RULES:
    cond = '; '.join(f"{c['field']} {c['operator']} {c['value']}" for c in r.get('conditions',[])) or '—'
    val  = str(r.get('value','')) if r.get('value') is not None else '(formula)'
    aksi = f'**{r.get("action_if_violated","?")}**' if r.get('action_if_violated')=='HOLD' else r.get('action_if_violated','?')
    a(f'| `{r.get("rule_id","")}` | {r.get("rule_type","")} | `{r.get("parameter","")}` | `{r.get("operator","")}` | **{val}** | {r.get("unit","")} | {cond[:40]} | {aksi} |')
a('')
a('### Detail Aturan')
a('')
for r in RULES:
    a(f'#### `{r.get("rule_id","")}` — {r.get("rule_type","")} : {r.get("parameter","")}')
    a('')
    a(f'```json')
    a(json.dumps({k: r[k] for k in ['rule_id','rule_type','parameter','operator','value','unit','conditions','vehicle_types','road_classes','action_if_violated'] if k in r}, ensure_ascii=False, indent=2))
    a(f'```')
    a('')
    a(f'**Teks Hukum:** *"{r.get("legal_text","")}"*')
    a(f'**Sumber:** [{r.get("source_url","")}]({r.get("source_url","")})')
    a('')

# ── SECTION 5 — THRESHOLDS ──────────────────────────────────────────────────
a('---')
a('')
a('## 5. Threshold Numerik (18 Nilai)')
a('')
a('| ID | Parameter | Op | Nilai | Satuan | Kelas Jalan | Dasar Hukum | Verif? |')
a('|----|-----------|----|-------|--------|-------------|-------------|--------|')
for t in THRS:
    verif = '⚠️ Ya' if t.get('verification_required') else '✅'
    val   = str(t.get('value','—'))
    a(f'| `{t.get("id","")}` | `{t.get("parameter","")}` | `{t.get("operator","")}` | **{val}** | {t.get("unit","")} | {t.get("road_class","—")} | {t.get("legal_basis","")[:35]} | {verif} |')
a('')

# QUICK REFERENCE TABLE
a('### 📐 Quick Reference — Dimensi Kendaraan')
a('')
a('| Parameter | Kelas I | Kelas II | Kelas III | Kelas Khusus | Dasar Hukum |')
a('|-----------|---------|----------|-----------|--------------|-------------|')
a('| **Lebar Maks** | 2.500 mm | 2.500 mm | 2.100 mm ⚠️ | 2.500 mm | PP 55/2012 Ps 7(1) |')
a('| **Panjang Maks (Tunggal)** | 12.000 mm | 12.000 mm | 9.000 mm ⚠️ | 12.000 mm | PP 55/2012 Ps 7(2) |')
a('| **Panjang Maks (Kombinasi)** | 18.000 mm | — | — | 18.000 mm | PP 55/2012 Ps 9 |')
a('| **Tinggi Maks** | 4.200 mm | 4.200 mm | 3.500 mm ⚠️ | 4.200 mm | PP 55/2012 Ps 7(3) |')
a('| **Rasio Tinggi/Lebar** | ≤ 1.7× | ≤ 1.7× | ≤ 1.7× | ≤ 1.7× | PP 55/2012 Ps 7(3) |')
a('| **MST Maks** | **10 ton** | **8 ton** | **8 ton** | **>10 ton** | PM 18/2021 Ps 4 |')
a('')

# ── SECTION 6 — VEHICLE RULES ────────────────────────────────────────────────
a('---')
a('')
a('## 6. Aturan Kendaraan per Konfigurasi Sumbu')
a('')
a('> [!WARNING]')
a('> Nilai JBI di bawah bersifat indikatif. Wajib diverifikasi dari **Lampiran PP No. 55 Tahun 2012** (PDF resmi).')
a('')
for vr in VEH:
    a(f'### 🚛 {vr.get("vehicle_category","")} — Konfigurasi `{vr.get("axle_config","?")}` ({vr.get("axle_count","?")} sumbu)')
    a('')
    a(f'| Parameter | Nilai | Satuan |')
    a(f'|-----------|-------|--------|')
    a(f'| JBI Kelas I | **{vr.get("JBI_kelas_I_kg","?")}** | kg |')
    a(f'| JBI Kelas II | **{vr.get("JBI_kelas_II_kg","?")}** | kg |')
    a(f'| JBI Kelas III | **{vr.get("JBI_kelas_III_kg","Dilarang") or "Dilarang"}** | kg |')
    a(f'| Panjang Maks | **{vr.get("max_length_mm","?")}** | mm |')
    a(f'| Lebar Maks | **{vr.get("max_width_mm","?")}** | mm |')
    a(f'| Tinggi Maks | **{vr.get("max_height_mm","?")}** | mm |')
    a(f'| Uji Berkala | **{vr.get("periodic_test_months","?")}** | bulan |')
    a(f'| Dasar Hukum | {vr.get("legal_basis","")} | — |')
    a('')
    if vr.get('notes'):
        a(f'> ⚠️ *{vr["notes"]}*')
    a('')

# ── SECTION 7 — ROAD RULES ───────────────────────────────────────────────────
a('---')
a('')
a('## 7. Matriks Kelas Jalan')
a('')
a('| Kelas | Kategori | Lebar | Panjang | Tinggi | MST | Restriksi Truk | Dasar Hukum |')
a('|-------|----------|-------|---------|--------|-----|----------------|-------------|')
for r in ROAD:
    restr = '⚠️ Ada' if r.get('truck_restriction') else '—'
    a(f'| **{r.get("road_class","")}** | {r.get("road_category","")} | {r.get("max_width_mm","—")} mm | {r.get("max_length_mm","—")} mm | {r.get("max_height_mm","—")} mm | **{r.get("max_MST_ton",">10")} ton** | {restr} | {r.get("legal_basis","")[:30]} |')
a('')
for r in ROAD:
    if r.get('time_restriction') or r.get('route_restriction'):
        a(f'> **{r.get("road_class","")}:** {r.get("notes","")}')
a('')

# ── SECTION 8 — SANCTIONS ────────────────────────────────────────────────────
a('---')
a('')
a('## 8. Sanksi & Pelanggaran')
a('')
a('| ID | Pelanggaran | Tipe | Kategori | Nilai | Dasar Hukum |')
a('|----|-------------|------|----------|-------|-------------|')
for s in SANS:
    val = ''
    if s.get('value'):
        val = f'Rp{s["value"]:,}' if s.get('unit')=='IDR' else f'{s["value"]} {s.get("unit","")}'
    if s.get('alternative'): val += f' / {s["alternative"]}'
    tipe_icon = '🔴' if s.get('sanction_type')=='PIDANA' else '🟠'
    a(f'| `{s.get("sanction_id","")}` | {s.get("violation_type","")} | {tipe_icon} {s.get("sanction_type","")} | {s.get("sanction_category","")} | {val or "—"} | {s.get("legal_basis","")} |')
a('')

# ── SECTION 9 — LOCAL ────────────────────────────────────────────────────────
a('---')
a('')
a('## 9. Regulasi Daerah (13 Daerah)')
a('')
a('| ID | Tipe | No/Tahun | Provinsi | Status | Ketentuan Utama | Verif? |')
a('|----|------|----------|----------|--------|-----------------|--------|')
for l in LOCAL:
    sid   = STATUS_ICON.get(l.get('status','?'),'❓')
    prov  = l.get('city','') or '' + l.get('province','') or ''
    num   = f'{l.get("number","?")}/{l.get("year","?")}'
    kp    = '; '.join(l.get('key_provisions',['—'])[:1])[:45]
    verif = '⚠️' if l.get('verification_required') else '✅'
    a(f'| `{l.get("id","")}` | {l.get("type","")} | {num} | {prov} | {sid} {l.get("status","?")} | {kp} | {verif} |')
a('')

# ── SECTION 10 — RELATIONSHIPS ───────────────────────────────────────────────
a('---')
a('')
a('## 10. Graf Relasi Regulasi')
a('')
a('```mermaid')
a('graph TD')

# Group by type
for rel in RELS[:15]:  # limit to avoid huge diagram
    f = rel['from'].replace('-','_').replace('/','_')
    t = rel['to'].replace('-','_').replace('/','_')
    arrow = {'IMPLEMENTS':'-->','AMENDS':'-.->','REVOKES':'--x'}.get(rel['relationship'],'-->')
    label = rel['relationship']
    a(f'    {f} {arrow}|{label}| {t}')
a('```')
a('')
a('| Dari | Hubungan | Ke | Keterangan |')
a('|------|----------|----|------------|')
for rel in RELS:
    icon = {'IMPLEMENTS':'⬇️','AMENDS':'✏️','REVOKES':'🚫'}.get(rel['relationship'],'🔗')
    a(f'| `{rel["from"]}` | {icon} **{rel["relationship"]}** | `{rel["to"]}` | {rel.get("description","")} |')
a('')

# ── SECTION 11 — CONFLICTS ───────────────────────────────────────────────────
a('---')
a('')
a('## 11. Konflik Regulasi & Resolusi')
a('')
for c in CONF:
    unresolved = c.get('resolution') == 'REQUIRES_LEGAL_REVIEW'
    icon = '🔴' if unresolved else '🟢'
    a(f'### {icon} {c.get("conflict_id","")} — {c.get("conflict_type","")}')
    a('')
    a(f'| Field | Detail |')
    a(f'|-------|--------|')
    a(f'| **Aturan A** | {c.get("rule_a","")} |')
    a(f'| **Aturan B** | {c.get("rule_b","")} |')
    a(f'| **Penyebab** | {c.get("possible_reason","")} |')
    a(f'| **Resolusi** | `{c.get("resolution","")}` |')
    a(f'| **Catatan** | {c.get("notes","")} |')
    a('')
    if unresolved:
        a('> [!WARNING]')
        a(f'> Konflik ini **belum terselesaikan** dan memerlukan legal review sebelum dapat diimplementasikan.')
    a('')

# ── SECTION 12 — SOURCES ─────────────────────────────────────────────────────
a('---')
a('')
a('## 12. Sumber Resmi')
a('')
a('| Prioritas | Nama | URL | Cakupan |')
a('|-----------|------|-----|---------|')
for i, s in enumerate(SRCS, 1):
    a(f'| {i} | **{s.get("name","")}** | [{s.get("url","")}]({s.get("url","")}) | {s.get("coverage","")} |')
a('')

# ── SECTION 13 — GAPS ────────────────────────────────────────────────────────
a('---')
a('')
a('## 13. Gaps & Missing Regulations')
a('')
a('> [!NOTE]')
a('> Gap berikut perlu diselesaikan sebelum corpus ini dapat dianggap komprehensif untuk produksi.')
a('')

gaps = [
    ('KRITIS','PP 55/2012 — Lampiran JBI Lengkap','Tabel JBI per konfigurasi sumbu (1.1, 1.2, 1.22, dll.) wajib diverifikasi dari lampiran PDF resmi.','https://peraturan.bpk.go.id/Details/5307/pp-no-55-tahun-2012'),
    ('KRITIS','PM 60/2019 — Teks Lengkap','Pasal tata cara pemuatan, julur muatan, daya angkut per tipe kendaraan perlu diekstrak.','https://jdih.kemenhub.go.id/regulasi/view/pm/60/2019'),
    ('KRITIS','PM 18/2021 — Klausul 5% Tolerance','Pasal 5 ayat (1) perlu dikonfirmasi: toleransi 5% = teknis saja atau ada allowance legal.','https://jdih.kemenhub.go.id/regulasi/view/pm/18/2021'),
    ('TINGGI','Regulasi ODOL 2024–2026','Permenhub, SE, atau Inpres terkait Zero ODOL 2027 yang terbit setelah 2023.','https://jdih.kemenhub.go.id/'),
    ('TINGGI','Perdirjen — Petunjuk Teknis WIM','Juknis operasional jembatan timbang dan WIM dari Ditjen Perhubungan Darat.','https://jdih.kemenhub.go.id/'),
    ('TINGGI','Regulasi 12 Provinsi (status UNKNOWN)','Jateng, Jatim, Jabar, Banten, Sumut, Sumsel, Lampung, Riau, Kaltim, Sulsel, DIY, Kepri.','Masing-masing JDIH Provinsi'),
    ('SEDANG','Kota Hub Logistik Utama','Surabaya, Medan, Semarang, Cikarang, Bekasi, Karawang.','Masing-masing JDIH Kota'),
    ('SEDANG','Korlantas Polri','Regulasi Polri tentang penindakan di jembatan timbang dan razia kendaraan.','https://korlantas.polri.go.id/'),
    ('SEDANG','Kementerian PUPR','Regulasi daya dukung jembatan dan izin angkutan over-limit.','https://jdih.pu.go.id/'),
    ('RENDAH','Instruksi Presiden ODOL 2027','Inpres atau Keppres yang mengarahkan program Zero ODOL 2027.','https://peraturan.go.id/'),
]
a('| Prioritas | Gap | Keterangan | Sumber |')
a('|-----------|-----|------------|--------|')
for priority, title, desc, url in gaps:
    icon = PRI_ICON.get(priority,'⚪')
    a(f'| {icon} **{priority}** | **{title}** | {desc} | [{url[:40]}...]({url}) |')
a('')

# ── FOOTER ───────────────────────────────────────────────────────────────────
a('---')
a('')
a('## 📌 Metadata')
a('')
a('```yaml')
a(f'generated: {NOW}')
a(f'total_regulations: {len(REGS)}')
a(f'active_regulations: {n_act}')
a(f'articles_extracted: {len(ARTS)}')
a(f'machine_rules: {len(RULES)}')
a(f'numeric_thresholds: {len(THRS)}')
a(f'sanctions: {len(SANS)}')
a(f'local_regulations: {len(LOCAL)}')
a(f'conflicts: {len(CONF)}')
a(f'unresolved_conflicts: 1')
a(f'data_dir: d:/VETO/data/regulations/')
a(f'pdf_report: d:/VETO/data/VETO_Regulatory_Corpus_Report.pdf')
a('```')
a('')
a('---')
a('')
a('*VETO — ODOL Dispatch Validation System | Indonesian Commercial Road Freight Compliance*')

output = '\n'.join(md)
with open(OUTPUT, 'w', encoding='utf-8') as f:
    f.write(output)

size = os.path.getsize(OUTPUT)
print(f'[OK] Saved: {OUTPUT}')
print(f'[OK] Size: {size/1024:.0f} KB | Lines: {len(md)}')
