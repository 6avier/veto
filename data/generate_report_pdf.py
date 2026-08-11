"""
VETO — Regulatory Corpus PDF Report Generator
Membuat PDF terstruktur dari hasil scraping regulasi.
Output: d:/VETO/data/VETO_Regulatory_Corpus_Report.pdf
"""
import json, os, datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.platypus import ListFlowable, ListItem

# ── CONFIG ────────────────────────────────────────────────────────────────────
DATA_DIR   = r"d:\VETO\data\regulations"
OUTPUT_PDF = r"d:\VETO\data\VETO_Regulatory_Corpus_Report.pdf"
NOW        = datetime.datetime.now().strftime("%d %B %Y, %H:%M WIB")

# ── COLORS ────────────────────────────────────────────────────────────────────
C_NAVY      = colors.HexColor("#0B1F3A")
C_BLUE      = colors.HexColor("#1A3F6F")
C_ACCENT    = colors.HexColor("#E8372C")   # VETO red
C_GOLD      = colors.HexColor("#F4A83A")
C_LIGHT     = colors.HexColor("#EEF3FA")
C_LIGHTGRAY = colors.HexColor("#F5F5F5")
C_MIDGRAY   = colors.HexColor("#CCCCCC")
C_GREEN     = colors.HexColor("#1E7B34")
C_ORANGE    = colors.HexColor("#D4610D")
C_RED       = colors.HexColor("#B91C1C")
C_WHITE     = colors.white
C_BLACK     = colors.HexColor("#1A1A1A")

# ── LOAD DATA ─────────────────────────────────────────────────────────────────
def load(filename):
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)

REGULATIONS  = load("01_regulations.json")
RELATIONSHIPS= load("02_regulation_relationships.json")
ARTICLES     = load("03_articles.json")
RULES        = load("04_rules.json")
THRESHOLDS   = load("05_numeric_thresholds.json")
VEHICLE_R    = load("06_vehicle_rules.json")
CARGO_R      = load("07_cargo_rules.json")
ROAD_R       = load("08_road_rules.json")
SANCTIONS    = load("09_violation_sanctions.json")
SOURCES      = load("10_sources.json")
LOCAL_R      = load("11_local_regulations.json")
CONFLICTS    = load("conflicts.json")

# ── STYLES ────────────────────────────────────────────────────────────────────
SS = getSampleStyleSheet()

def style(name, **kw):
    base = SS[name] if name in SS else SS["Normal"]
    return ParagraphStyle(name + str(id(kw)), parent=base, **kw)

S_COVER_TITLE = style("Title",
    fontSize=30, textColor=C_WHITE, leading=38,
    fontName="Helvetica-Bold", alignment=TA_CENTER)
S_COVER_SUB   = style("Normal",
    fontSize=13, textColor=colors.HexColor("#BDD4F0"), leading=18,
    fontName="Helvetica", alignment=TA_CENTER)
S_COVER_META  = style("Normal",
    fontSize=10, textColor=colors.HexColor("#90B8E0"), leading=14,
    fontName="Helvetica", alignment=TA_CENTER)

S_H1 = style("Heading1",
    fontSize=18, textColor=C_NAVY, leading=24,
    fontName="Helvetica-Bold", spaceBefore=14, spaceAfter=6)
S_H2 = style("Heading2",
    fontSize=13, textColor=C_BLUE, leading=18,
    fontName="Helvetica-Bold", spaceBefore=10, spaceAfter=4)
S_H3 = style("Heading3",
    fontSize=11, textColor=C_NAVY, leading=15,
    fontName="Helvetica-Bold", spaceBefore=6, spaceAfter=3)

S_BODY = style("Normal",
    fontSize=9, textColor=C_BLACK, leading=14,
    fontName="Helvetica", alignment=TA_JUSTIFY)
S_BODY_L = style("Normal",
    fontSize=9, textColor=C_BLACK, leading=13,
    fontName="Helvetica", alignment=TA_LEFT)
S_SMALL = style("Normal",
    fontSize=7.5, textColor=colors.HexColor("#555555"), leading=11,
    fontName="Helvetica")
S_CAPTION = style("Normal",
    fontSize=8, textColor=colors.HexColor("#444444"), leading=12,
    fontName="Helvetica-Oblique", alignment=TA_CENTER)
S_MONO = style("Normal",
    fontSize=8, textColor=C_BLUE, leading=12,
    fontName="Courier")
S_RULE_TEXT = style("Normal",
    fontSize=8.5, textColor=colors.HexColor("#004080"), leading=12,
    fontName="Helvetica-Oblique")
S_BADGE_KRITIS = style("Normal",
    fontSize=8, textColor=C_WHITE, leading=10,
    fontName="Helvetica-Bold", backColor=C_ACCENT,
    borderPadding=(2,4,2,4))
S_TOC = style("Normal",
    fontSize=9.5, textColor=C_BLUE, leading=15,
    fontName="Helvetica")
S_TOC_H = style("Normal",
    fontSize=10.5, textColor=C_NAVY, leading=16,
    fontName="Helvetica-Bold")

W, H = A4
MARGIN = 18 * mm
TW = W - 2 * MARGIN  # text width

# ── TABLE HELPERS ─────────────────────────────────────────────────────────────
def th(text, color=C_NAVY, tc=C_WHITE, fs=9):
    return Paragraph(f"<b>{text}</b>",
        style("Normal", fontSize=fs, textColor=tc, fontName="Helvetica-Bold",
              leading=12, backColor=color))

def td(text, bold=False, color=None, fs=9, align=TA_LEFT):
    fn = "Helvetica-Bold" if bold else "Helvetica"
    kw = dict(fontSize=fs, textColor=color or C_BLACK,
               fontName=fn, leading=12, alignment=align)
    return Paragraph(str(text), style("Normal", **kw))

def status_badge(status):
    c = {
        "BERLAKU": C_GREEN, "DICABUT": C_RED,
        "DIUBAH":  C_ORANGE, "UNKNOWN": C_MIDGRAY
    }.get(status, C_MIDGRAY)
    return Paragraph(f"<b>{status}</b>",
        style("Normal", fontSize=8, textColor=C_WHITE,
              fontName="Helvetica-Bold", leading=11, backColor=c))

def priority_badge(p):
    c = {"KRITIS": C_ACCENT, "TINGGI": C_GOLD,
         "SEDANG": C_BLUE,   "RENDAH": C_MIDGRAY}.get(p, C_MIDGRAY)
    return Paragraph(f"<b>{p}</b>",
        style("Normal", fontSize=8, textColor=C_WHITE,
              fontName="Helvetica-Bold", leading=11, backColor=c))

BASE_TS = TableStyle([
    ("GRID",        (0,0), (-1,-1), 0.4, C_MIDGRAY),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [C_WHITE, C_LIGHTGRAY]),
    ("VALIGN",      (0,0), (-1,-1), "MIDDLE"),
    ("TOPPADDING",  (0,0), (-1,-1), 4),
    ("BOTTOMPADDING",(0,0),(-1,-1), 4),
    ("LEFTPADDING", (0,0), (-1,-1), 5),
    ("RIGHTPADDING",(0,0), (-1,-1), 5),
])

def add_header_style(ts, n_cols):
    ts = list(ts._cmds) if hasattr(ts, '_cmds') else list(BASE_TS._cmds)
    return TableStyle(ts + [
        ("BACKGROUND",  (0,0), (-1,0), C_NAVY),
        ("TEXTCOLOR",   (0,0), (-1,0), C_WHITE),
        ("FONTNAME",    (0,0), (-1,0), "Helvetica-Bold"),
    ])

HDR_TS = TableStyle([
    ("GRID",        (0,0), (-1,-1), 0.4, C_MIDGRAY),
    ("BACKGROUND",  (0,0), (-1,0), C_NAVY),
    ("TEXTCOLOR",   (0,0), (-1,0), C_WHITE),
    ("FONTNAME",    (0,0), (-1,0), "Helvetica-Bold"),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [C_WHITE, C_LIGHTGRAY]),
    ("VALIGN",      (0,0), (-1,-1), "MIDDLE"),
    ("TOPPADDING",  (0,0), (-1,-1), 4),
    ("BOTTOMPADDING",(0,0),(-1,-1), 4),
    ("LEFTPADDING", (0,0), (-1,-1), 5),
    ("RIGHTPADDING",(0,0), (-1,-1), 5),
])

SECTION_BAR = TableStyle([
    ("BACKGROUND",  (0,0), (-1,-1), C_LIGHT),
    ("LINEBELOW",   (0,-1), (-1,-1), 1.5, C_BLUE),
    ("LEFTPADDING", (0,0), (-1,-1), 8),
    ("TOPPADDING",  (0,0), (-1,-1), 6),
    ("BOTTOMPADDING",(0,0),(-1,-1), 6),
    ("VALIGN",      (0,0), (-1,-1), "MIDDLE"),
])

def section_heading(text, icon=""):
    t = Table([[Paragraph(f"{icon} <b>{text}</b>",
        style("Normal", fontSize=14, textColor=C_NAVY,
              fontName="Helvetica-Bold", leading=18))]],
        colWidths=[TW])
    t.setStyle(SECTION_BAR)
    return t

def rule_box(text):
    """Highlighted box for normalized rule text."""
    t = Table([[Paragraph(text,
        style("Normal", fontSize=9, textColor=colors.HexColor("#003366"),
              fontName="Helvetica-Oblique", leading=13))]],
        colWidths=[TW - 20])
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0,0),(-1,-1), colors.HexColor("#E8F0FC")),
        ("LINEBELOW",    (0,0),(-1,-1), 0, C_WHITE),
        ("LINEBEFORE",   (0,0),(0,-1), 3, C_BLUE),
        ("LEFTPADDING",  (0,0),(-1,-1), 10),
        ("TOPPADDING",   (0,0),(-1,-1), 5),
        ("BOTTOMPADDING",(0,0),(-1,-1), 5),
        ("RIGHTPADDING", (0,0),(-1,-1), 8),
    ]))
    return t

# ── PAGE TEMPLATE ─────────────────────────────────────────────────────────────
def on_page(canvas, doc):
    canvas.saveState()
    # Header bar
    canvas.setFillColor(C_NAVY)
    canvas.rect(0, H - 12*mm, W, 12*mm, fill=1, stroke=0)
    canvas.setFillColor(C_WHITE)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(MARGIN, H - 7.5*mm, "VETO — Indonesian Road Freight Regulatory Corpus")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(W - MARGIN, H - 7.5*mm, f"Confidential · {NOW}")
    # Footer
    canvas.setFillColor(C_NAVY)
    canvas.rect(0, 0, W, 10*mm, fill=1, stroke=0)
    canvas.setFillColor(C_WHITE)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(MARGIN, 3.5*mm, "VETO — ODOL Dispatch Validation System")
    canvas.drawRightString(W - MARGIN, 3.5*mm, f"Page {doc.page}")
    # Accent stripe
    canvas.setFillColor(C_ACCENT)
    canvas.rect(0, 10*mm, 5, H - 22*mm, fill=1, stroke=0)
    canvas.restoreState()

def on_cover(canvas, doc):
    canvas.saveState()
    # Full-page navy background
    canvas.setFillColor(C_NAVY)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)
    # Red accent top bar
    canvas.setFillColor(C_ACCENT)
    canvas.rect(0, H - 18*mm, W, 18*mm, fill=1, stroke=0)
    # Gold bottom stripe
    canvas.setFillColor(C_GOLD)
    canvas.rect(0, 0, W, 6*mm, fill=1, stroke=0)
    canvas.restoreState()

# ── BUILD ELEMENTS ─────────────────────────────────────────────────────────────
story = []

# ════════════════════════════════════════════════════════════════════════════════
# COVER PAGE
# ════════════════════════════════════════════════════════════════════════════════
story.append(Spacer(1, 40*mm))
story.append(Paragraph("VETO", style("Normal",
    fontSize=52, textColor=C_ACCENT, fontName="Helvetica-Bold",
    alignment=TA_CENTER, leading=60)))
story.append(Spacer(1, 4*mm))
story.append(Paragraph("Indonesian Road Freight", S_COVER_TITLE))
story.append(Paragraph("Regulatory Corpus Report", S_COVER_TITLE))
story.append(Spacer(1, 8*mm))
story.append(HRFlowable(width=80*mm, thickness=1.5, color=C_GOLD,
                         lineCap="round", spaceAfter=8*mm, hAlign="CENTER"))
story.append(Paragraph(
    "ODOL (Over Dimension Over Loading) Compliance &amp; Dispatch Validation System",
    S_COVER_SUB))
story.append(Spacer(1, 6*mm))
story.append(Paragraph(
    f"Diterbitkan: {NOW}", S_COVER_META))
story.append(Spacer(1, 4*mm))

# Stats boxes on cover
n_active  = sum(1 for r in REGULATIONS if r.get("status") == "BERLAKU")
stats_data = [
    [td("29", bold=True, fs=22, color=C_GOLD, align=TA_CENTER),
     td(str(n_active), bold=True, fs=22, color=C_GREEN, align=TA_CENTER),
     td(str(len(THRESHOLDS)), bold=True, fs=22, color=C_ACCENT, align=TA_CENTER),
     td(str(len(RULES)), bold=True, fs=22, color=colors.HexColor("#60B0FF"), align=TA_CENTER)],
    [td("Regulasi\nDitemukan", fs=8, color=C_WHITE, align=TA_CENTER),
     td("Berlaku\nAktif", fs=8, color=C_WHITE, align=TA_CENTER),
     td("Threshold\nNumerik", fs=8, color=C_WHITE, align=TA_CENTER),
     td("Aturan\nTerstruktur", fs=8, color=C_WHITE, align=TA_CENTER)],
]
stats_t = Table(stats_data, colWidths=[TW/4]*4)
stats_t.setStyle(TableStyle([
    ("BACKGROUND",   (0,0), (-1,-1), colors.HexColor("#0F2C55")),
    ("GRID",         (0,0), (-1,-1), 0.5, colors.HexColor("#1A4080")),
    ("TOPPADDING",   (0,0), (-1,-1), 8),
    ("BOTTOMPADDING",(0,0), (-1,-1), 8),
    ("VALIGN",       (0,0), (-1,-1), "MIDDLE"),
    ("ROUNDEDCORNERS",[3]),
]))
story.append(stats_t)
story.append(Spacer(1, 10*mm))
story.append(Paragraph(
    "Dokumen ini berisi corpus regulasi angkutan barang komersial Indonesia yang relevan "
    "untuk validasi kepatuhan truk ODOL. Digunakan sebagai basis knowledge untuk "
    "VETO Validation Engine.",
    style("Normal", fontSize=9.5, textColor=colors.HexColor("#90B8E0"),
          fontName="Helvetica", alignment=TA_CENTER, leading=15)))
story.append(PageBreak())

# ════════════════════════════════════════════════════════════════════════════════
# TABLE OF CONTENTS
# ════════════════════════════════════════════════════════════════════════════════
story.append(section_heading("Daftar Isi", "📋"))
story.append(Spacer(1, 4*mm))

toc_items = [
    ("1", "Ringkasan Eksekutif",             "Executive summary & key statistics"),
    ("2", "Corpus Regulasi (29 Regulasi)",    "Daftar lengkap UU, PP, Permenhub, SE, lokal"),
    ("3", "Top 10 Regulasi Prioritas VETO",  "Regulasi paling kritis untuk engine validasi"),
    ("4", "Pasal-Pasal Kunci (16 Pasal)",     "Artikel dengan teks asli & aturan ternormalisasi"),
    ("5", "Aturan Mesin (13 Rules)",          "Machine-readable conditional rules"),
    ("6", "Threshold Numerik (18 Nilai)",     "Semua batas angka: dimensi, MST, JBI, sanksi"),
    ("7", "Aturan Kendaraan per Konfigurasi", "JBI/MST per axle config"),
    ("8", "Aturan Kelas Jalan",              "Batas dimensi & MST per kelas jalan"),
    ("9", "Sanksi & Pelanggaran",            "Sanksi pidana dan administratif"),
    ("10","Regulasi Daerah (13 Daerah)",     "Peraturan provinsi & kota"),
    ("11","Konflik Regulasi",                "3 konflik terdeteksi & resolusinya"),
    ("12","Sumber Resmi",                    "7 portal JDIH resmi"),
    ("13","Gaps & Missing Regulations",      "10 gap kritis yang perlu research lanjutan"),
]
for num, title, desc in toc_items:
    row = Table([
        [td(f"{num}.", bold=True, fs=10, color=C_NAVY),
         td(title, bold=True, fs=10),
         td(f"— {desc}", fs=9, color=colors.HexColor("#555555"))]
    ], colWidths=[10*mm, 72*mm, TW-82*mm])
    row.setStyle(TableStyle([
        ("LINEBELOW",    (0,0),(-1,-1), 0.3, C_LIGHTGRAY),
        ("TOPPADDING",   (0,0),(-1,-1), 4),
        ("BOTTOMPADDING",(0,0),(-1,-1), 4),
        ("LEFTPADDING",  (0,0),(-1,-1), 2),
        ("VALIGN",       (0,0),(-1,-1), "MIDDLE"),
    ]))
    story.append(row)

story.append(PageBreak())

# ════════════════════════════════════════════════════════════════════════════════
# SECTION 1 — EXECUTIVE SUMMARY
# ════════════════════════════════════════════════════════════════════════════════
story.append(section_heading("1. Ringkasan Eksekutif", "📊"))
story.append(Spacer(1, 3*mm))

story.append(Paragraph(
    "Laporan ini merupakan output dari VETO Regulatory Data Ingestion Pipeline — "
    "Phase 1 (Known Corpus Build). Corpus ini mencakup seluruh regulasi Indonesia "
    "yang relevan untuk validasi kepatuhan kendaraan angkutan barang komersial di jalan raya, "
    "dengan fokus pada program ODOL (Over Dimension Over Loading) dan operasional "
    "dispatch truk.", S_BODY))
story.append(Spacer(1, 4*mm))

# Summary stats table
n_dicabut  = sum(1 for r in REGULATIONS if r.get("status") == "DICABUT")
n_diubah   = sum(1 for r in REGULATIONS if r.get("status") == "DIUBAH")
n_unknown  = sum(1 for r in REGULATIONS if r.get("status") == "UNKNOWN")
n_verify   = sum(1 for r in REGULATIONS if r.get("verification_required"))

exec_data = [
    [th("Metrik"), th("Nilai"), th("Keterangan")],
    [td("Total Regulasi Ditemukan"),   td("29", bold=True), td("UU, PP, Permenhub, SE, Perdirjen, Lokal")],
    [td("Aktif (BERLAKU)"),            td(str(n_active), bold=True, color=C_GREEN), td("Berlaku dan dapat diterapkan")],
    [td("Dicabut (DICABUT)"),          td(str(n_dicabut), bold=True, color=C_RED), td("Referensi historis")],
    [td("Diubah (DIUBAH)"),            td(str(n_diubah), bold=True, color=C_ORANGE), td("Masih berlaku, dengan perubahan")],
    [td("Status Tidak Diketahui"),     td(str(n_unknown), bold=True, color=colors.grey), td("Perlu verifikasi")],
    [td("Pasal Diekstrak"),            td(str(len(ARTICLES)), bold=True), td("Dengan teks asli Indonesia")],
    [td("Aturan Mesin (Rules)"),       td(str(len(RULES)), bold=True), td("Conditional rules siap pakai")],
    [td("Threshold Numerik"),          td(str(len(THRESHOLDS)), bold=True), td("Dimensi, MST, JBI, Sanksi")],
    [td("Sanksi Terdokumentasi"),      td(str(len(SANCTIONS)), bold=True), td("Pidana & Administratif")],
    [td("Regulasi Daerah"),            td(str(len(LOCAL_R)), bold=True), td("13 provinsi/kota")],
    [td("Regulasi Butuh Verifikasi"),  td(str(n_verify), bold=True, color=C_ORANGE), td("Nilai perlu dikonfirmasi dari PDF resmi")],
    [td("Konflik Terdeteksi"),         td(str(len(CONFLICTS)), bold=True), td("1 unresolved — perlu legal review")],
    [td("Relationship Graf"),          td(str(len(RELATIONSHIPS)), bold=True), td("IMPLEMENTS / AMENDS / REVOKES")],
]
exec_t = Table(exec_data, colWidths=[70*mm, 25*mm, TW-95*mm])
exec_t.setStyle(HDR_TS)
story.append(exec_t)
story.append(Spacer(1, 4*mm))

story.append(Paragraph(
    "<b>3 Regulasi Paling Kritis untuk VETO:</b>", S_H3))
for r in ["UU No. 22 Tahun 2009 — UU LLAJ (Pasal 19–22: kelas jalan+MST; Pasal 169: larangan muatan lebih; Pasal 307: sanksi pidana)",
           "PP No. 55 Tahun 2012 — Kendaraan (dimensi maks, JBI/MST, lampiran tabel JBI per konfigurasi sumbu)",
           "Permenhub No. 18 Tahun 2021 — Penimbangan (MST per kelas jalan, WIM, normalisasi muatan lebih)"]:
    story.append(Paragraph(f"• {r}", S_BODY_L))
story.append(Spacer(1, 2*mm))
story.append(Paragraph(
    "<b>⚠ Warning Penting:</b> Toleransi 5% dalam PM 18/2021 adalah toleransi teknis "
    "alat ukur, BUKAN tambahan hukum di atas JBI. VETO HARUS menggunakan JBI sebagai "
    "batas keras (hard limit).",
    style("Normal", fontSize=9, textColor=C_RED, fontName="Helvetica-Bold",
          leading=13, backColor=colors.HexColor("#FFF0F0"),
          borderPadding=(5,8,5,8))))
story.append(PageBreak())

# ════════════════════════════════════════════════════════════════════════════════
# SECTION 2 — FULL REGULATION LIST
# ════════════════════════════════════════════════════════════════════════════════
story.append(section_heading("2. Corpus Regulasi Lengkap (29 Regulasi)", "📜"))
story.append(Spacer(1, 3*mm))

# Group by type
type_order = ["UU","PP","PERMENHUB","SE_MENHUB","SE_DIRJEN","PERDIRJEN","KEPMENHUB","INPRES","PERGUB","PERDA"]
grouped = {}
for r in REGULATIONS:
    t = r.get("type","OTHER")
    grouped.setdefault(t, []).append(r)

for rtype in type_order:
    if rtype not in grouped:
        continue
    regs = grouped[rtype]
    type_labels = {
        "UU":"Undang-Undang (UU)", "PP":"Peraturan Pemerintah (PP)",
        "PERMENHUB":"Peraturan Menteri Perhubungan (Permenhub)",
        "SE_MENHUB":"Surat Edaran Menteri Perhubungan (SE Menhub)",
        "SE_DIRJEN":"Surat Edaran Direktur Jenderal",
        "PERDIRJEN":"Peraturan Direktur Jenderal",
        "KEPMENHUB":"Keputusan Menteri Perhubungan",
        "INPRES":"Instruksi Presiden (Inpres)",
        "PERGUB":"Peraturan Gubernur (Pergub)",
        "PERDA":"Peraturan Daerah (Perda)",
    }
    story.append(Paragraph(type_labels.get(rtype, rtype), S_H2))

    reg_data = [[
        th("No"), th("Nomor"), th("Tahun"), th("Judul"), th("Status"), th("Subjek Utama")
    ]]
    for i, r in enumerate(regs, 1):
        subj = ", ".join(r.get("subjects", [])[:3])
        if len(r.get("subjects", [])) > 3:
            subj += f" +{len(r['subjects'])-3}"
        reg_data.append([
            td(str(i), align=TA_CENTER),
            td(r.get("number","?"), bold=True),
            td(str(r.get("year","?")), align=TA_CENTER),
            td(r.get("title","")[:60] + ("…" if len(r.get("title","")) > 60 else "")),
            status_badge(r.get("status","?")),
            td(subj, fs=8),
        ])
    reg_t = Table(reg_data, colWidths=[8*mm, 22*mm, 14*mm, 62*mm, 20*mm, TW-126*mm])
    reg_t.setStyle(HDR_TS)
    story.append(reg_t)
    story.append(Spacer(1, 3*mm))

story.append(PageBreak())

# ════════════════════════════════════════════════════════════════════════════════
# SECTION 3 — TOP 10 PRIORITY
# ════════════════════════════════════════════════════════════════════════════════
story.append(section_heading("3. Top 10 Regulasi Prioritas VETO", "🏆"))
story.append(Spacer(1, 3*mm))

TOP10 = [
    ("UU_22_2009",       "KRITIS", "UU induk LLAJ. Pasal 19-22: kelas jalan + MST. Pasal 169: larangan muatan lebih. Pasal 307: sanksi pidana denda ≤Rp500.000 / kurungan ≤2 bulan."),
    ("PP_55_2012",       "KRITIS", "PP Kendaraan. Mendefinisikan dimensi maks (lebar 2.500mm, tinggi 4.200mm, panjang 12.000mm/18.000mm). Lampiran berisi tabel JBI per konfigurasi sumbu — KRITIS."),
    ("PERMENHUB_18_2021","KRITIS", "Permenhub penimbangan. MST per kelas jalan (Kelas I: 10t, II/III: 8t). WIM framework. Normalisasi kendaraan overloaded. Toleransi 5% = teknis saja."),
    ("PERMENHUB_60_2019","KRITIS", "Permenhub angkutan barang. Tata cara operasional, perizinan, daya angkut, rute. Wajib dibaca untuk dispatch validation."),
    ("PP_74_2014",       "TINGGI", "PP Angkutan Jalan. Perizinan dan ketentuan operasional angkutan barang — dasar hukum PM 60/2019."),
    ("PP_34_2006",       "TINGGI", "PP Jalan. Mendefinisikan kelas jalan I/II/III dan MST yang diizinkan. Dasar validasi rute."),
    ("PERMENHUB_19_2021","TINGGI", "Uji berkala wajib setiap 6 bulan. Kendaraan tanpa STNK/sertifikat uji berkala valid = tidak laik jalan = HOLD."),
    ("PERMENHUB_23_2021","TINGGI", "Uji tipe dan modifikasi kendaraan. Perubahan dimensi/berat harus sertifikat uji tipe baru."),
    ("PP_80_2012",       "TINGGI", "Tata cara pemeriksaan kendaraan di jalan dan penindakan pelanggaran LLAJ. Dasar hukum jembatan timbang."),
    ("SE_MENHUB_21_2019","TINGGI", "SE khusus ODOL. Dasar operasional pengawasan muatan lebih dan ukuran lebih di lapangan."),
]

for rank, (rid, priority, notes) in enumerate(TOP10, 1):
    reg = next((r for r in REGULATIONS if r["id"] == rid), {})
    art_count = sum(1 for a in ARTICLES if a.get("regulation_id") == rid)
    url = reg.get("official_urls", ["—"])[0] if reg.get("official_urls") else "—"

    c = {"KRITIS": C_ACCENT, "TINGGI": C_GOLD}.get(priority, C_BLUE)
    box = Table([
        [
            Paragraph(f"<b>#{rank}</b>",
                style("Normal", fontSize=14, textColor=C_WHITE,
                      fontName="Helvetica-Bold", alignment=TA_CENTER, leading=18)),
            Paragraph(f"<b>{reg.get('type','')} No. {reg.get('number','')} Tahun {reg.get('year','')}</b><br/>"
                      f"<font size='8'>{reg.get('title','')}</font>",
                style("Normal", fontSize=11, textColor=C_WHITE,
                      fontName="Helvetica-Bold", leading=15)),
            Table([[priority_badge(priority)], [status_badge(reg.get('status','?'))]],
                colWidths=[22*mm]),
        ]
    ], colWidths=[14*mm, TW-54*mm, 28*mm])
    box.setStyle(TableStyle([
        ("BACKGROUND",  (0,0),(-1,-1), c),
        ("VALIGN",      (0,0),(-1,-1), "MIDDLE"),
        ("TOPPADDING",  (0,0),(-1,-1), 8),
        ("BOTTOMPADDING",(0,0),(-1,-1), 8),
        ("LEFTPADDING", (0,0),(-1,-1), 10),
    ]))
    story.append(box)

    detail = Table([
        [td("Relevansi VETO:", bold=True, fs=8.5),
         td(notes, fs=8.5)],
        [td("Pasal diekstrak:", bold=True, fs=8.5),
         td(f"{art_count} artikel", fs=8.5)],
        [td("URL Resmi:", bold=True, fs=8.5),
         Paragraph(f'<link href="{url}" color="blue"><u>{url[:80]}</u></link>',
                   style("Normal", fontSize=8, fontName="Helvetica",
                         textColor=C_BLUE, leading=12))],
    ], colWidths=[32*mm, TW-32*mm])
    detail.setStyle(TableStyle([
        ("BACKGROUND",  (0,0),(-1,-1), C_LIGHTGRAY),
        ("LINEBELOW",   (0,-1),(-1,-1), 1, C_MIDGRAY),
        ("TOPPADDING",  (0,0),(-1,-1), 4),
        ("BOTTOMPADDING",(0,0),(-1,-1), 4),
        ("LEFTPADDING", (0,0),(-1,-1), 8),
        ("VALIGN",      (0,0),(-1,-1), "TOP"),
    ]))
    story.append(detail)
    story.append(Spacer(1, 4*mm))

story.append(PageBreak())

# ════════════════════════════════════════════════════════════════════════════════
# SECTION 4 — ARTICLES
# ════════════════════════════════════════════════════════════════════════════════
story.append(section_heading("4. Pasal-Pasal Kunci (16 Pasal)", "📖"))
story.append(Spacer(1, 3*mm))
story.append(Paragraph(
    "Pasal-pasal berikut diekstrak dari regulasi utama dengan teks asli bahasa Indonesia "
    "dan normalisasi menjadi aturan yang dapat dibaca mesin.", S_BODY))
story.append(Spacer(1, 3*mm))

for a in ARTICLES:
    rid = a.get("regulation_id","")
    reg = next((r for r in REGULATIONS if r["id"] == rid), {})
    pasal = f"Pasal {a.get('article_number','?')}"
    if a.get("paragraph_number"): pasal += f" ayat ({a['paragraph_number']})"
    if a.get("letter"):           pasal += f" huruf {a['letter']}"

    hdr = Table([[
        td(f"{reg.get('type','')} {reg.get('number','')}/{reg.get('year','')}", bold=True, fs=9),
        td(pasal, bold=True, fs=9, align=TA_CENTER),
        td(a.get("topic",""), bold=True, fs=9),
        status_badge(a.get("legal_status","?"))
    ]], colWidths=[44*mm, 36*mm, TW-102*mm, 22*mm])
    hdr.setStyle(TableStyle([
        ("BACKGROUND",  (0,0),(-1,-1), C_LIGHT),
        ("LINEABOVE",   (0,0),(-1,0), 1.5, C_BLUE),
        ("TOPPADDING",  (0,0),(-1,-1), 5),
        ("BOTTOMPADDING",(0,0),(-1,-1), 5),
        ("LEFTPADDING", (0,0),(-1,-1), 6),
        ("VALIGN",      (0,0),(-1,-1), "MIDDLE"),
    ]))
    story.append(hdr)

    # Teks asli
    story.append(Paragraph(
        f'<i>"{a.get("indonesian_text","")}"</i>',
        style("Normal", fontSize=8.5, textColor=C_BLACK, fontName="Helvetica-Oblique",
              leading=13, leftIndent=10, rightIndent=10, spaceAfter=3)))

    # Normalized rule
    story.append(rule_box(f"▶ {a.get('normalized_rule','')}"))
    story.append(Spacer(1, 4*mm))

story.append(PageBreak())

# ════════════════════════════════════════════════════════════════════════════════
# SECTION 5 — MACHINE RULES
# ════════════════════════════════════════════════════════════════════════════════
story.append(section_heading("5. Aturan Mesin — Machine-Readable Rules (13 Rules)", "⚙"))
story.append(Spacer(1, 3*mm))
story.append(Paragraph(
    "Rules berikut dalam format kondisional yang dapat langsung dimuat ke VETO "
    "Validation Engine tanpa interpretasi manual.", S_BODY))
story.append(Spacer(1, 3*mm))

rules_data = [[
    th("Rule ID"), th("Tipe"), th("Parameter"),
    th("Operator"), th("Nilai"), th("Unit"),
    th("Kondisi"), th("Aksi")
]]
for r in RULES:
    cond = "; ".join(
        f"{c['field']} {c['operator']} {c['value']}"
        for c in r.get("conditions", [])
    ) or "—"
    rules_data.append([
        td(r.get("rule_id",""), bold=True, fs=8),
        td(r.get("rule_type",""), fs=8),
        td(r.get("parameter",""), fs=8),
        td(r.get("operator",""), fs=8, align=TA_CENTER),
        td(str(r.get("value","")) if r.get("value") is not None else "formula", bold=True, fs=8, align=TA_CENTER),
        td(r.get("unit",""), fs=8, align=TA_CENTER),
        td(cond[:35], fs=7.5),
        td(r.get("action_if_violated",""), bold=True, fs=8,
           color=C_RED if r.get("action_if_violated") == "HOLD" else C_GREEN),
    ])
rules_t = Table(rules_data,
    colWidths=[24*mm, 26*mm, 28*mm, 14*mm, 16*mm, 12*mm, 30*mm, 14*mm])
rules_t.setStyle(HDR_TS)
story.append(rules_t)
story.append(PageBreak())

# ════════════════════════════════════════════════════════════════════════════════
# SECTION 6 — NUMERIC THRESHOLDS
# ════════════════════════════════════════════════════════════════════════════════
story.append(section_heading("6. Threshold Numerik (18 Nilai)", "🔢"))
story.append(Spacer(1, 3*mm))

thr_data = [[
    th("ID"), th("Parameter"), th("Op"), th("Nilai"), th("Satuan"),
    th("Kelas Jalan"), th("Dasar Hukum"), th("Verif?")
]]
for t in THRESHOLDS:
    v = str(t.get("value","")) if t.get("value") is not None else "—"
    verif = "⚠ Ya" if t.get("verification_required") else "✓"
    verif_color = C_ORANGE if t.get("verification_required") else C_GREEN
    thr_data.append([
        td(t.get("id",""), fs=7.5),
        td(t.get("parameter",""), bold=True, fs=8),
        td(t.get("operator",""), fs=8, align=TA_CENTER),
        td(v, bold=True, fs=9, align=TA_CENTER),
        td(t.get("unit",""), fs=8),
        td(t.get("road_class","—")[:18], fs=7.5),
        td(t.get("legal_basis","")[:35], fs=7.5),
        td(verif, fs=8, color=verif_color, align=TA_CENTER),
    ])
thr_t = Table(thr_data,
    colWidths=[18*mm, 32*mm, 10*mm, 16*mm, 12*mm, 24*mm, 40*mm, 12*mm])
thr_t.setStyle(HDR_TS)
story.append(thr_t)
story.append(PageBreak())

# ════════════════════════════════════════════════════════════════════════════════
# SECTION 7 — VEHICLE RULES
# ════════════════════════════════════════════════════════════════════════════════
story.append(section_heading("7. Aturan Kendaraan per Konfigurasi Sumbu", "🚛"))
story.append(Spacer(1, 3*mm))

for vr in VEHICLE_R:
    story.append(Paragraph(
        f"<b>{vr.get('vehicle_category','')} — {vr.get('vehicle_type','')} "
        f"(Konfigurasi {vr.get('axle_config','?')}, {vr.get('axle_count','?')} sumbu)</b>",
        S_H3))
    vdata = [
        [th("Parameter"), th("Nilai"), th("Satuan"), th("Catatan")],
        [td("JBI Kelas I"),  td(str(vr.get("JBI_kelas_I_kg","?")), bold=True),  td("kg"), td("Perlu verifikasi lampiran")],
        [td("JBI Kelas II"), td(str(vr.get("JBI_kelas_II_kg","?")), bold=True), td("kg"), td("Perlu verifikasi lampiran")],
        [td("JBI Kelas III"),td(str(vr.get("JBI_kelas_III_kg","") or "Dilarang"), bold=True), td("kg"), td("")],
        [td("Panjang Maks"), td(str(vr.get("max_length_mm","?")), bold=True),  td("mm"), td("")],
        [td("Lebar Maks"),   td(str(vr.get("max_width_mm","?")), bold=True),   td("mm"), td("")],
        [td("Tinggi Maks"),  td(str(vr.get("max_height_mm","?")), bold=True),  td("mm"), td("")],
        [td("Uji Berkala"),  td(str(vr.get("periodic_test_months","?")), bold=True), td("bulan"), td("")],
    ]
    vt = Table(vdata, colWidths=[45*mm, 30*mm, 20*mm, TW-95*mm])
    vt.setStyle(HDR_TS)
    story.append(vt)
    story.append(Spacer(1, 2*mm))
    if vr.get("notes"):
        story.append(Paragraph(f"<i>⚠ {vr['notes']}</i>",
            style("Normal", fontSize=8, textColor=C_ORANGE, fontName="Helvetica-Oblique",
                  leading=12, leftIndent=5)))
    story.append(Spacer(1, 5*mm))

story.append(PageBreak())

# ════════════════════════════════════════════════════════════════════════════════
# SECTION 8 — ROAD RULES
# ════════════════════════════════════════════════════════════════════════════════
story.append(section_heading("8. Aturan Kelas Jalan", "🛣"))
story.append(Spacer(1, 3*mm))

road_data = [[
    th("Kelas"), th("Kategori"), th("Lebar Maks\n(mm)"),
    th("Panjang Maks\n(mm)"), th("Tinggi Maks\n(mm)"),
    th("MST Maks\n(ton)"), th("Restriksi\nTruk"), th("Dasar Hukum")
]]
for r in ROAD_R:
    road_data.append([
        td(r.get("road_class",""), bold=True),
        td(r.get("road_category",""), fs=8),
        td(str(r.get("max_width_mm","?") or "—"), bold=True, align=TA_CENTER),
        td(str(r.get("max_length_mm","?") or "—"), bold=True, align=TA_CENTER),
        td(str(r.get("max_height_mm","?") or "—"), bold=True, align=TA_CENTER),
        td(str(r.get("max_MST_ton","?") or ">10"), bold=True, align=TA_CENTER,
           color=C_RED if str(r.get("max_MST_ton","?")) in ["8","8.0"] else C_GREEN),
        td("✓" if r.get("truck_restriction") else "—", align=TA_CENTER,
           color=C_ORANGE if r.get("truck_restriction") else C_GREEN),
        td(r.get("legal_basis","")[:30], fs=7.5),
    ])
road_t = Table(road_data,
    colWidths=[26*mm, 26*mm, 20*mm, 20*mm, 20*mm, 18*mm, 16*mm, TW-146*mm])
road_t.setStyle(HDR_TS)
story.append(road_t)
story.append(Spacer(1, 4*mm))

story.append(Paragraph("<b>Matriks Dimensi per Kelas Jalan:</b>", S_H3))
matrix = [
    [th("Parameter"), th("Kelas I"), th("Kelas II"), th("Kelas III"), th("Kelas Khusus")],
    [td("Lebar Maks"),        td("2.500 mm",bold=True), td("2.500 mm",bold=True), td("2.100 mm",bold=True,color=C_ORANGE), td("2.500 mm",bold=True)],
    [td("Panjang Maks"),      td("18.000 mm",bold=True), td("12.000 mm",bold=True), td("9.000 mm",bold=True,color=C_ORANGE), td("18.000 mm",bold=True)],
    [td("Tinggi Maks"),       td("4.200 mm",bold=True), td("4.200 mm",bold=True), td("3.500 mm",bold=True,color=C_ORANGE), td("4.200 mm",bold=True)],
    [td("MST Maks"),          td("10 ton",bold=True,color=C_GREEN), td("8 ton",bold=True,color=C_ORANGE), td("8 ton",bold=True,color=C_ORANGE), td(">10 ton",bold=True,color=C_BLUE)],
    [td("Dasar Hukum"),       td("Pasal 20"), td("Pasal 21"), td("Pasal 22"), td("PM 18/2021")],
]
mt = Table(matrix, colWidths=[36*mm, (TW-36*mm)/4]*4)
mt.setStyle(HDR_TS)
story.append(mt)
story.append(PageBreak())

# ════════════════════════════════════════════════════════════════════════════════
# SECTION 9 — SANCTIONS
# ════════════════════════════════════════════════════════════════════════════════
story.append(section_heading("9. Sanksi & Pelanggaran", "⚖"))
story.append(Spacer(1, 3*mm))

san_data = [[
    th("ID"), th("Jenis Pelanggaran"), th("Tipe Sanksi"),
    th("Kategori"), th("Nilai"), th("Dasar Hukum")
]]
for s in SANCTIONS:
    val = ""
    if s.get("value"):
        val = f"Rp{s['value']:,}" if s.get("unit") == "IDR" else f"{s['value']} {s.get('unit','')}"
    if s.get("alternative"):
        val += f" / {s['alternative']}"
    san_data.append([
        td(s.get("sanction_id",""), fs=8),
        td(s.get("violation_type",""), fs=8.5),
        td(s.get("sanction_type",""), bold=True, fs=8,
           color=C_RED if s.get("sanction_type") == "PIDANA" else C_ORANGE),
        td(s.get("sanction_category",""), fs=8),
        td(val or "—", fs=8),
        td(s.get("legal_basis",""), fs=7.5),
    ])
san_t = Table(san_data, colWidths=[18*mm, 48*mm, 20*mm, 30*mm, 32*mm, TW-148*mm])
san_t.setStyle(HDR_TS)
story.append(san_t)
story.append(PageBreak())

# ════════════════════════════════════════════════════════════════════════════════
# SECTION 10 — LOCAL REGULATIONS
# ════════════════════════════════════════════════════════════════════════════════
story.append(section_heading("10. Regulasi Daerah (13 Daerah)", "🗺"))
story.append(Spacer(1, 3*mm))
story.append(Paragraph(
    "Peraturan daerah provinsi yang membatasi operasional kendaraan angkutan barang. "
    "Sebagian besar masih perlu verifikasi nomor dan status terkini.", S_BODY))
story.append(Spacer(1, 3*mm))

loc_data = [[
    th("ID"), th("Tipe"), th("No/Tahun"), th("Provinsi/Kota"),
    th("Status"), th("Ketentuan Utama"), th("Verif?")
]]
for l in LOCAL_R:
    prov = (l.get("city") or "") + (l.get("province",""))
    num  = f"{l.get('number','?')}/{l.get('year','?')}"
    kp   = "; ".join(l.get("key_provisions",["—"])[:1])[:45]
    verif = "⚠" if l.get("verification_required") else "✓"
    loc_data.append([
        td(l.get("id",""), fs=7),
        td(l.get("type",""), fs=8),
        td(num, fs=8),
        td(prov, fs=8),
        status_badge(l.get("status","?")),
        td(kp, fs=7.5),
        td(verif, color=C_ORANGE if l.get("verification_required") else C_GREEN,
           fs=10, align=TA_CENTER),
    ])
loc_t = Table(loc_data, colWidths=[28*mm, 14*mm, 18*mm, 28*mm, 18*mm, 52*mm, 10*mm])
loc_t.setStyle(HDR_TS)
story.append(loc_t)
story.append(PageBreak())

# ════════════════════════════════════════════════════════════════════════════════
# SECTION 11 — CONFLICTS
# ════════════════════════════════════════════════════════════════════════════════
story.append(section_heading("11. Konflik Regulasi & Resolusi", "⚡"))
story.append(Spacer(1, 3*mm))

for c in CONFLICTS:
    unresolved = c.get("resolution") == "REQUIRES_LEGAL_REVIEW"
    bg = colors.HexColor("#FFF5F5") if unresolved else colors.HexColor("#F5FFF5")
    bdr = C_RED if unresolved else C_GREEN

    block = Table([[
        Paragraph(
            f"<b>{c.get('conflict_id','')} — {c.get('conflict_type','')}</b><br/>"
            f"<font color='#333333' size='8'>Aturan A: {c.get('rule_a','')}</font><br/>"
            f"<font color='#333333' size='8'>Aturan B: {c.get('rule_b','')}</font><br/><br/>"
            f"<font size='8.5'><b>Kemungkinan Penyebab:</b> {c.get('possible_reason','')}</font><br/>"
            f"<font size='8.5'><b>Resolusi:</b> <font color='{'red' if unresolved else 'green'}'>"
            f"{c.get('resolution','')}</font></font><br/>"
            f"<font size='8'><i>{c.get('notes','')}</i></font>",
            style("Normal", fontSize=9, fontName="Helvetica", leading=14))
    ]], colWidths=[TW-10])
    block.setStyle(TableStyle([
        ("BACKGROUND",   (0,0),(-1,-1), bg),
        ("LINEBEFOER",   (0,0),(0,-1), 3, bdr),
        ("LINEBEFORE",   (0,0),(0,-1), 3, bdr),
        ("LINEABOVE",    (0,0),(-1,0), 0.5, C_MIDGRAY),
        ("LINEBELOW",    (0,-1),(-1,-1), 0.5, C_MIDGRAY),
        ("TOPPADDING",   (0,0),(-1,-1), 8),
        ("BOTTOMPADDING",(0,0),(-1,-1), 8),
        ("LEFTPADDING",  (0,0),(-1,-1), 12),
        ("RIGHTPADDING", (0,0),(-1,-1), 8),
    ]))
    story.append(block)
    story.append(Spacer(1, 4*mm))

story.append(PageBreak())

# ════════════════════════════════════════════════════════════════════════════════
# SECTION 12 — SOURCES
# ════════════════════════════════════════════════════════════════════════════════
story.append(section_heading("12. Sumber Resmi (Official Sources)", "🌐"))
story.append(Spacer(1, 3*mm))

src_data = [[th("Prioritas"), th("Nama Sumber"), th("URL"), th("Cakupan")]]
for i, s in enumerate(SOURCES, 1):
    src_data.append([
        td(str(i), bold=True, align=TA_CENTER),
        td(s.get("name",""), bold=True),
        Paragraph(f'<link href="{s.get("url","")}" color="blue"><u>{s.get("url","")}</u></link>',
                  style("Normal", fontSize=8, fontName="Helvetica",
                        textColor=C_BLUE, leading=12)),
        td(s.get("coverage",""), fs=8),
    ])
src_t = Table(src_data, colWidths=[18*mm, 36*mm, 74*mm, TW-128*mm])
src_t.setStyle(HDR_TS)
story.append(src_t)
story.append(Spacer(1, 6*mm))

# ════════════════════════════════════════════════════════════════════════════════
# SECTION 13 — GAPS
# ════════════════════════════════════════════════════════════════════════════════
story.append(section_heading("13. Gaps & Missing Regulations (10 Gap Kritis)", "🔍"))
story.append(Spacer(1, 3*mm))

gaps = [
    ("KRITIS", "PP 55/2012 — Lampiran JBI Lengkap",
     "Tabel JBI per konfigurasi sumbu (1.1, 1.2, 1.22, 1.2+2, dll.) ada di lampiran PDF resmi. "
     "Nilai dalam corpus ini masih indikatif dan HARUS diverifikasi.",
     "https://peraturan.bpk.go.id/Details/5307/pp-no-55-tahun-2012"),
    ("KRITIS", "PM 60/2019 — Teks Lengkap",
     "Teks pasal lengkap tentang tata cara pemuatan, julur muatan, dan daya angkut per tipe kendaraan.",
     "https://jdih.kemenhub.go.id/regulasi/view/pm/60/2019"),
    ("KRITIS", "PM 18/2021 — Klausul Toleransi 5%",
     "Teks asli Pasal 5 ayat (1) perlu dikonfirmasi untuk memastikan toleransi 5% adalah teknis, "
     "bukan allowance hukum.",
     "https://jdih.kemenhub.go.id/regulasi/view/pm/18/2021"),
    ("TINGGI", "Regulasi ODOL 2024–2026",
     "Permenhub, SE, atau Inpres terkait Zero ODOL 2027 yang mungkin terbit setelah 2023.",
     "https://jdih.kemenhub.go.id/"),
    ("TINGGI", "Perdirjen — Petunjuk Teknis WIM",
     "SK/Perdirjen/Juknis operasional jembatan timbang dan WIM dari Ditjen Perhubungan Darat.",
     "https://jdih.kemenhub.go.id/"),
    ("TINGGI", "Regulasi Provinsi (12 Provinsi)",
     "Jawa Tengah, Jawa Timur, Jawa Barat, Banten, Sumut, Sumsel, Lampung, Riau, "
     "Kaltim, Sulsel, DIY, Kepulauan Riau — semua masih UNKNOWN.",
     "Masing-masing JDIH Provinsi"),
    ("SEDANG", "Regulasi Kota/Kabupaten Logistik Utama",
     "Surabaya, Medan, Semarang, Cikarang, Bekasi, Karawang — hub logistik utama Indonesia.",
     "Masing-masing JDIH Kota/Kabupaten"),
    ("SEDANG", "Korlantas Polri — Peraturan Enforcement",
     "Regulasi Polri tentang penindakan di jembatan timbang dan razia kendaraan.",
     "https://korlantas.polri.go.id/"),
    ("SEDANG", "Kementerian PUPR — Kapasitas Jalan",
     "Regulasi PUPR tentang daya dukung jembatan dan izin angkutan over-limit.",
     "https://jdih.pu.go.id/"),
    ("RENDAH", "Instruksi Presiden ODOL 2027",
     "Inpres atau Keppres yang mengarahkan program Zero ODOL 2027.",
     "https://peraturan.go.id/"),
]

gap_data = [[th("Prioritas"), th("Gap"), th("Keterangan"), th("URL/Sumber")]]
for priority, title, desc, url in gaps:
    c = {"KRITIS": C_ACCENT, "TINGGI": C_ORANGE, "SEDANG": C_BLUE, "RENDAH": C_MIDGRAY}.get(priority, C_MIDGRAY)
    gap_data.append([
        Paragraph(f"<b>{priority}</b>",
            style("Normal", fontSize=8, textColor=C_WHITE, fontName="Helvetica-Bold",
                  leading=11, backColor=c)),
        td(title, bold=True, fs=8.5),
        td(desc, fs=8),
        Paragraph(f'<link href="{url}" color="blue"><u>{url[:40]}</u></link>',
                  style("Normal", fontSize=7.5, fontName="Helvetica",
                        textColor=C_BLUE, leading=11)),
    ])
gap_t = Table(gap_data, colWidths=[18*mm, 40*mm, 82*mm, TW-140*mm])
gap_t.setStyle(HDR_TS)
story.append(gap_t)
story.append(Spacer(1, 6*mm))

# ── FINAL PAGE — DISCLAIMER ───────────────────────────────────────────────────
story.append(PageBreak())
story.append(Spacer(1, 20*mm))
story.append(HRFlowable(width=TW, thickness=1, color=C_MIDGRAY))
story.append(Spacer(1, 5*mm))
story.append(Paragraph("Disclaimer & Notes", S_H2))
story.append(Spacer(1, 3*mm))
disclaimers = [
    "Dokumen ini dibuat secara otomatis oleh VETO Regulatory Data Ingestion Pipeline.",
    "Semua nilai yang ditandai ⚠ (verification_required: true) HARUS dikonfirmasi dari teks PDF resmi sebelum digunakan dalam produksi.",
    "Nilai JBI per konfigurasi sumbu yang tercantum bersifat indikatif dan memerlukan verifikasi dari Lampiran PP No. 55 Tahun 2012.",
    "Toleransi 5% dalam PM 18/2021 adalah toleransi teknis pengukuran, BUKAN allowance hukum di atas JBI. VETO wajib menggunakan JBI sebagai batas keras.",
    "Regulasi daerah (provinsi/kota) yang berstatus UNKNOWN memerlukan penelitian lebih lanjut sebelum dapat diterapkan.",
    f"Tanggal pembuatan: {NOW}",
]
for d in disclaimers:
    story.append(Paragraph(f"• {d}", S_BODY_L))
    story.append(Spacer(1, 2*mm))

story.append(Spacer(1, 10*mm))
story.append(HRFlowable(width=TW, thickness=0.5, color=C_MIDGRAY))
story.append(Spacer(1, 3*mm))
story.append(Paragraph(
    "VETO — ODOL Dispatch Validation System | Indonesian Commercial Road Freight Compliance",
    style("Normal", fontSize=8, textColor=colors.grey, fontName="Helvetica",
          alignment=TA_CENTER, leading=12)))

# ── BUILD PDF ─────────────────────────────────────────────────────────────────
print(f"\n{'='*60}")
print("  VETO — Generating Regulatory Corpus PDF Report")
print(f"  Output: {OUTPUT_PDF}")
print(f"{'='*60}")

doc = SimpleDocTemplate(
    OUTPUT_PDF,
    pagesize=A4,
    topMargin    = 16*mm,
    bottomMargin = 14*mm,
    leftMargin   = MARGIN,
    rightMargin  = MARGIN,
    title        = "VETO Indonesian Road Freight Regulatory Corpus",
    author       = "VETO Regulatory Data Ingestion Pipeline",
    subject      = "ODOL Compliance & Dispatch Validation — Regulatory Report",
    creator      = "VETO System",
)

# First page uses cover template, rest use normal
from reportlab.platypus import NextPageTemplate, FrameBreak
from reportlab.platypus.frames import Frame
from reportlab.platypus.doctemplate import PageTemplate

cover_frame  = Frame(0, 0, W, H, leftPadding=MARGIN, rightPadding=MARGIN,
                     topPadding=55*mm, bottomPadding=20*mm, id="cover")
normal_frame = Frame(MARGIN, 14*mm, TW, H - 30*mm,
                     leftPadding=0, rightPadding=0,
                     topPadding=0, bottomPadding=0, id="normal")

doc.addPageTemplates([
    PageTemplate(id="Cover",  frames=[cover_frame],  onPage=on_cover),
    PageTemplate(id="Normal", frames=[normal_frame], onPage=on_page),
])

story.insert(0, NextPageTemplate("Normal"))
story.insert(0, NextPageTemplate("Cover"))

doc.build(story)

size_kb = os.path.getsize(OUTPUT_PDF) / 1024
print(f"\n  [OK] PDF generated successfully!")
print(f"  File: {OUTPUT_PDF}")
print(f"  Size: {size_kb:.0f} KB ({size_kb/1024:.1f} MB)")
print(f"{'-'*60}\n")
