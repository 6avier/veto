"""
VETO Regulatory Data Ingestion Pipeline
Phase 1 – Known Corpus Build (structured research output)

Outputs all 14 files into d:/VETO/data/regulations/
"""
import json, os, datetime

OUTPUT_DIR = r"d:\VETO\data\regulations"
os.makedirs(OUTPUT_DIR, exist_ok=True)

SCRAPE_LOG = []

def log(msg, level="INFO"):
    ts = datetime.datetime.now().isoformat()
    SCRAPE_LOG.append({"timestamp": ts, "level": level, "message": msg})
    print(f"[{level}] {msg}")

def save_json(data, filename):
    path = os.path.join(OUTPUT_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    count = len(data) if isinstance(data, (list, dict)) else "?"
    log(f"Saved {filename} — {count} records")

# ==============================================================
# 01 — REGULATIONS
# ==============================================================
REGULATIONS = [
    # --- UU ---
    {
        "id": "UU_22_2009", "type": "UU", "number": "22", "year": 2009,
        "title": "Lalu Lintas dan Angkutan Jalan",
        "issuer": "DPR RI / Presiden RI",
        "issued_date": "2009-06-22", "effective_date": "2009-06-22",
        "status": "BERLAKU",
        "subjects": ["LLAJ","angkutan jalan","kendaraan bermotor","penindakan","JBI","MST","dimensi"],
        "official_urls": ["https://peraturan.bpk.go.id/Details/38946/uu-no-22-tahun-2009"],
        "pdf_urls":      ["https://peraturan.bpk.go.id/Details/38946"],
        "amends": [], "amended_by": [],
        "revokes": ["UU_14_1992"], "revoked_by": [],
        "related_regulations": ["PP_55_2012","PP_74_2014","PP_79_2013","PP_80_2012","PP_30_2021"],
        "notes": "UU induk LLAJ. Pasal 19–22 kelas jalan+MST, Pasal 169 larangan muatan lebih, Pasal 307 sanksi.",
        "verification_required": False
    },
    {
        "id": "UU_38_2004", "type": "UU", "number": "38", "year": 2004,
        "title": "Jalan",
        "issuer": "DPR RI / Presiden RI",
        "issued_date": "2004-10-18", "effective_date": "2004-10-18",
        "status": "DIUBAH",
        "subjects": ["jalan","kelas jalan","daya dukung jalan"],
        "official_urls": ["https://peraturan.bpk.go.id/Details/40712/uu-no-38-tahun-2004"],
        "pdf_urls": [],
        "amends": [], "amended_by": ["UU_2_2022"],
        "revokes": ["UU_13_1980"], "revoked_by": [],
        "related_regulations": ["PP_34_2006","PP_15_2005"],
        "notes": "UU Jalan. Mendefinisikan kelas jalan dan daya dukung. Diubah oleh UU 2/2022.",
        "verification_required": False
    },
    {
        "id": "UU_2_2022", "type": "UU", "number": "2", "year": 2022,
        "title": "Perubahan Kedua atas Undang-Undang Nomor 38 Tahun 2004 tentang Jalan",
        "issuer": "DPR RI / Presiden RI",
        "issued_date": "2022-01-03", "effective_date": "2022-01-03",
        "status": "BERLAKU",
        "subjects": ["jalan","kelas jalan","daya dukung jalan","jalan tol"],
        "official_urls": ["https://peraturan.bpk.go.id/Details/227605/uu-no-2-tahun-2022"],
        "pdf_urls": [],
        "amends": ["UU_38_2004"], "amended_by": [],
        "revokes": [], "revoked_by": [],
        "related_regulations": ["UU_38_2004"],
        "notes": "Perubahan kedua UU Jalan. Status UU 38/2004: DIUBAH.",
        "verification_required": False
    },
    # --- PP ---
    {
        "id": "PP_55_2012", "type": "PP", "number": "55", "year": 2012,
        "title": "Kendaraan",
        "issuer": "Presiden RI",
        "issued_date": "2012-04-25", "effective_date": "2012-04-25",
        "status": "BERLAKU",
        "subjects": ["kendaraan bermotor","persyaratan teknis","dimensi kendaraan",
                     "JBI","JBB","JBKB","JBKI","MST","uji tipe","rancang bangun","modifikasi"],
        "official_urls": ["https://peraturan.bpk.go.id/Details/5307/pp-no-55-tahun-2012"],
        "pdf_urls":      ["https://peraturan.bpk.go.id/Details/5307"],
        "amends": [], "amended_by": [],
        "revokes": ["PP_44_1993"], "revoked_by": [],
        "related_regulations": ["UU_22_2009","PP_74_2014","PERMENHUB_23_2021"],
        "notes": "PP utama kendaraan bermotor. KRITIS — mendefinisikan JBI/MST/dimensi, lampiran berisi tabel JBI per konfigurasi sumbu.",
        "verification_required": False
    },
    {
        "id": "PP_74_2014", "type": "PP", "number": "74", "year": 2014,
        "title": "Angkutan Jalan",
        "issuer": "Presiden RI",
        "issued_date": "2014-09-15", "effective_date": "2014-09-15",
        "status": "BERLAKU",
        "subjects": ["angkutan jalan","angkutan barang","mobil barang","izin angkutan","muatan"],
        "official_urls": ["https://peraturan.bpk.go.id/Details/41098/pp-no-74-tahun-2014"],
        "pdf_urls": [],
        "amends": [], "amended_by": [],
        "revokes": ["PP_41_1993"], "revoked_by": [],
        "related_regulations": ["UU_22_2009","PERMENHUB_60_2019","PERMENHUB_25_2021"],
        "notes": "PP angkutan jalan. Perizinan dan ketentuan operasional angkutan barang.",
        "verification_required": False
    },
    {
        "id": "PP_79_2013", "type": "PP", "number": "79", "year": 2013,
        "title": "Jaringan Lalu Lintas dan Angkutan Jalan",
        "issuer": "Presiden RI",
        "issued_date": "2013-12-05", "effective_date": "2013-12-05",
        "status": "BERLAKU",
        "subjects": ["jaringan jalan","kelas jalan","daya dukung jalan","MST"],
        "official_urls": ["https://peraturan.bpk.go.id/Details/38736/pp-no-79-tahun-2013"],
        "pdf_urls": [],
        "amends": [], "amended_by": [],
        "revokes": [], "revoked_by": [],
        "related_regulations": ["UU_22_2009","UU_38_2004","PP_34_2006"],
        "notes": "Jaringan jalan nasional dan kapasitas daya dukung.",
        "verification_required": False
    },
    {
        "id": "PP_80_2012", "type": "PP", "number": "80", "year": 2012,
        "title": "Tata Cara Pemeriksaan Kendaraan Bermotor di Jalan dan Penindakan Pelanggaran LLAJ",
        "issuer": "Presiden RI",
        "issued_date": "2012-05-30", "effective_date": "2012-05-30",
        "status": "BERLAKU",
        "subjects": ["pemeriksaan kendaraan","penindakan","jembatan timbang","penimbangan","pelanggaran LLAJ"],
        "official_urls": ["https://peraturan.bpk.go.id/Details/5308/pp-no-80-tahun-2012"],
        "pdf_urls": [],
        "amends": [], "amended_by": [],
        "revokes": [], "revoked_by": [],
        "related_regulations": ["UU_22_2009","PERMENHUB_18_2021"],
        "notes": "Pemeriksaan kendaraan di jalan dan penindakan muatan lebih. Dasar hukum jembatan timbang.",
        "verification_required": False
    },
    {
        "id": "PP_30_2021", "type": "PP", "number": "30", "year": 2021,
        "title": "Penyelenggaraan Bidang Lalu Lintas dan Angkutan Jalan",
        "issuer": "Presiden RI",
        "issued_date": "2021-02-02", "effective_date": "2021-02-02",
        "status": "BERLAKU",
        "subjects": ["penyelenggaraan LLAJ","standar pelayanan","perizinan","kendaraan bermotor"],
        "official_urls": ["https://peraturan.bpk.go.id/Details/162840/pp-no-30-tahun-2021"],
        "pdf_urls": [],
        "amends": [], "amended_by": [],
        "revokes": [], "revoked_by": [],
        "related_regulations": ["UU_22_2009","PERMENHUB_25_2021"],
        "notes": "PP terbaru penyelenggaraan LLAJ.",
        "verification_required": False
    },
    {
        "id": "PP_34_2006", "type": "PP", "number": "34", "year": 2006,
        "title": "Jalan",
        "issuer": "Presiden RI",
        "issued_date": "2006-10-26", "effective_date": "2006-10-26",
        "status": "BERLAKU",
        "subjects": ["kelas jalan","MST jalan","daya dukung jalan","jalan nasional","jalan kota"],
        "official_urls": ["https://peraturan.bpk.go.id/Details/65066/pp-no-34-tahun-2006"],
        "pdf_urls": [],
        "amends": [], "amended_by": [],
        "revokes": ["PP_26_1985"], "revoked_by": [],
        "related_regulations": ["UU_38_2004","PP_79_2013"],
        "notes": "Mendefinisikan kelas jalan I/II/III dan MST diizinkan per kelas. KRITIS untuk validasi rute.",
        "verification_required": False
    },
    {
        "id": "PP_15_2005", "type": "PP", "number": "15", "year": 2005,
        "title": "Jalan Tol",
        "issuer": "Presiden RI",
        "issued_date": "2005-01-28", "effective_date": "2005-01-28",
        "status": "DIUBAH",
        "subjects": ["jalan tol","kendaraan tol","pembatasan kendaraan tol"],
        "official_urls": ["https://peraturan.bpk.go.id/Details/64989/pp-no-15-tahun-2005"],
        "pdf_urls": [],
        "amends": [], "amended_by": ["PP_44_2009"],
        "revokes": [], "revoked_by": [],
        "related_regulations": ["UU_38_2004"],
        "notes": "Kendaraan yang boleh masuk jalan tol, termasuk batas dimensi dan berat.",
        "verification_required": False
    },
    # --- PERMENHUB ---
    {
        "id": "PERMENHUB_60_2019", "type": "PERMENHUB", "number": "60", "year": 2019,
        "title": "Penyelenggaraan Angkutan Barang dengan Kendaraan Bermotor di Jalan",
        "issuer": "Menteri Perhubungan",
        "issued_date": "2019-08-01", "effective_date": "2019-08-01",
        "status": "BERLAKU",
        "subjects": ["angkutan barang","mobil barang","daya angkut","JBI","dimensi","muatan","kelas jalan","tata cara pemuatan"],
        "official_urls": [
            "https://jdih.kemenhub.go.id/regulasi/view/pm/60/2019",
            "https://peraturan.bpk.go.id/Details/117424"
        ],
        "pdf_urls": ["https://jdih.kemenhub.go.id/uploads/files/PM_2019_60.pdf"],
        "amends": [], "amended_by": [],
        "revokes": [], "revoked_by": [],
        "related_regulations": ["PP_74_2014","PERMENHUB_18_2021"],
        "notes": "Permenhub utama angkutan barang. Tata cara operasional, persyaratan kendaraan, daya angkut, rute. KRITIS.",
        "verification_required": False
    },
    {
        "id": "PERMENHUB_18_2021", "type": "PERMENHUB", "number": "18", "year": 2021,
        "title": "Pengawasan Muatan Angkutan Barang dan Penyelenggaraan Penimbangan Kendaraan Bermotor di Jalan",
        "issuer": "Menteri Perhubungan",
        "issued_date": "2021-03-01", "effective_date": "2021-03-01",
        "status": "BERLAKU",
        "subjects": ["pengawasan muatan","penimbangan","jembatan timbang","WIM","weigh in motion",
                     "muatan lebih","ODOL","berat sumbu","MST","normalisasi"],
        "official_urls": [
            "https://jdih.kemenhub.go.id/regulasi/view/pm/18/2021",
            "https://peraturan.bpk.go.id/Details/165393"
        ],
        "pdf_urls": ["https://jdih.kemenhub.go.id/uploads/files/PM_2021_18.pdf"],
        "amends": [], "amended_by": [],
        "revokes": ["PERMENHUB_134_2015"], "revoked_by": [],
        "related_regulations": ["UU_22_2009","PP_80_2012","PERMENHUB_60_2019"],
        "notes": "KRITIS. MST per kelas jalan, prosedur penimbangan, WIM, toleransi 5%, penindakan (normalisasi).",
        "verification_required": False
    },
    {
        "id": "PERMENHUB_19_2021", "type": "PERMENHUB", "number": "19", "year": 2021,
        "title": "Pengujian Berkala Kendaraan Bermotor",
        "issuer": "Menteri Perhubungan",
        "issued_date": "2021-03-01", "effective_date": "2021-03-01",
        "status": "BERLAKU",
        "subjects": ["uji berkala","pengujian kendaraan","laik jalan","mobil barang","sertifikat uji berkala"],
        "official_urls": [
            "https://jdih.kemenhub.go.id/regulasi/view/pm/19/2021",
            "https://peraturan.bpk.go.id/Details/165394"
        ],
        "pdf_urls": ["https://jdih.kemenhub.go.id/uploads/files/PM_2021_19.pdf"],
        "amends": [], "amended_by": [],
        "revokes": ["PERMENHUB_133_2015"], "revoked_by": [],
        "related_regulations": ["PP_55_2012","PERMENHUB_23_2021"],
        "notes": "Uji berkala kendaraan bermotor termasuk mobil barang — interval 6 bulan.",
        "verification_required": False
    },
    {
        "id": "PERMENHUB_23_2021", "type": "PERMENHUB", "number": "23", "year": 2021,
        "title": "Pengujian Tipe Kendaraan Bermotor",
        "issuer": "Menteri Perhubungan",
        "issued_date": "2021-03-01", "effective_date": "2021-03-01",
        "status": "BERLAKU",
        "subjects": ["uji tipe","rancang bangun","modifikasi kendaraan","type approval","persyaratan teknis"],
        "official_urls": [
            "https://jdih.kemenhub.go.id/regulasi/view/pm/23/2021",
            "https://peraturan.bpk.go.id/Details/165395"
        ],
        "pdf_urls": [],
        "amends": [], "amended_by": [],
        "revokes": ["PERMENHUB_33_2018"], "revoked_by": [],
        "related_regulations": ["PP_55_2012","PERMENHUB_19_2021"],
        "notes": "Uji tipe dan modifikasi. Perubahan dimensi/berat memerlukan sertifikat uji tipe baru.",
        "verification_required": False
    },
    {
        "id": "PERMENHUB_25_2021", "type": "PERMENHUB", "number": "25", "year": 2021,
        "title": "Penyelenggaraan Bidang Angkutan Jalan",
        "issuer": "Menteri Perhubungan",
        "issued_date": "2021-03-01", "effective_date": "2021-03-01",
        "status": "BERLAKU",
        "subjects": ["angkutan jalan","perizinan angkutan","angkutan barang","angkutan khusus"],
        "official_urls": ["https://jdih.kemenhub.go.id/regulasi/view/pm/25/2021"],
        "pdf_urls": [],
        "amends": [], "amended_by": [],
        "revokes": [], "revoked_by": [],
        "related_regulations": ["PP_30_2021","PP_74_2014"],
        "notes": "Penyelenggaraan angkutan jalan termasuk perizinan angkutan barang.",
        "verification_required": False
    },
    {
        "id": "PERMENHUB_47_2021", "type": "PERMENHUB", "number": "47", "year": 2021,
        "title": "Alat Penimbangan Kendaraan Bermotor yang dapat Bergerak",
        "issuer": "Menteri Perhubungan",
        "issued_date": "2021-07-01", "effective_date": "2021-07-01",
        "status": "BERLAKU",
        "subjects": ["alat penimbangan","mobile weighing","penimbangan bergerak","WIM"],
        "official_urls": ["https://jdih.kemenhub.go.id/regulasi/view/pm/47/2021"],
        "pdf_urls": [],
        "amends": [], "amended_by": [],
        "revokes": [], "revoked_by": [],
        "related_regulations": ["PERMENHUB_18_2021"],
        "notes": "Alat penimbangan bergerak (mobile weighing unit) untuk pengawasan muatan di lapangan.",
        "verification_required": True
    },
    {
        "id": "PERMENHUB_134_2015", "type": "PERMENHUB", "number": "134", "year": 2015,
        "title": "Penyelenggaraan Penimbangan Kendaraan Bermotor di Jalan",
        "issuer": "Menteri Perhubungan",
        "issued_date": "2015-12-01", "effective_date": "2015-12-01",
        "status": "DICABUT",
        "subjects": ["penimbangan","jembatan timbang","muatan lebih"],
        "official_urls": ["https://jdih.kemenhub.go.id/regulasi/view/pm/134/2015"],
        "pdf_urls": [],
        "amends": [], "amended_by": [],
        "revokes": [], "revoked_by": ["PERMENHUB_18_2021"],
        "related_regulations": ["PERMENHUB_18_2021"],
        "notes": "Dicabut oleh PM 18/2021.",
        "verification_required": False
    },
    {
        "id": "PERMENHUB_133_2015", "type": "PERMENHUB", "number": "133", "year": 2015,
        "title": "Pengujian Berkala Kendaraan Bermotor",
        "issuer": "Menteri Perhubungan",
        "issued_date": "2015-11-01", "effective_date": "2015-11-01",
        "status": "DICABUT",
        "subjects": ["uji berkala","pengujian kendaraan"],
        "official_urls": [],
        "pdf_urls": [],
        "amends": [], "amended_by": [],
        "revokes": [], "revoked_by": ["PERMENHUB_19_2021"],
        "related_regulations": ["PERMENHUB_19_2021"],
        "notes": "Dicabut oleh PM 19/2021.",
        "verification_required": False
    },
    {
        "id": "PERMENHUB_33_2018", "type": "PERMENHUB", "number": "33", "year": 2018,
        "title": "Pengujian Tipe Kendaraan Bermotor",
        "issuer": "Menteri Perhubungan",
        "issued_date": "2018-01-01", "effective_date": "2018-01-01",
        "status": "DICABUT",
        "subjects": ["uji tipe","rancang bangun"],
        "official_urls": [],
        "pdf_urls": [],
        "amends": [], "amended_by": [],
        "revokes": [], "revoked_by": ["PERMENHUB_23_2021"],
        "related_regulations": ["PERMENHUB_23_2021"],
        "notes": "Dicabut oleh PM 23/2021.",
        "verification_required": False
    },
    {
        "id": "PERMENHUB_1_2015", "type": "PERMENHUB", "number": "1", "year": 2015,
        "title": "Angkutan Barang Berbahaya",
        "issuer": "Menteri Perhubungan",
        "issued_date": "2015-01-01", "effective_date": "2015-01-01",
        "status": "UNKNOWN",
        "subjects": ["barang berbahaya","angkutan khusus","B3","hazmat"],
        "official_urls": ["https://jdih.kemenhub.go.id/"],
        "pdf_urls": [],
        "amends": [], "amended_by": [],
        "revokes": [], "revoked_by": [],
        "related_regulations": ["PP_74_2014"],
        "notes": "Angkutan barang berbahaya. Status terkini perlu verifikasi.",
        "verification_required": True
    },
    # --- SE / SURAT EDARAN ---
    {
        "id": "SE_MENHUB_21_2019", "type": "SE_MENHUB", "number": "21", "year": 2019,
        "title": "Pengawasan Terhadap Mobil Barang atas Pelanggaran Muatan Lebih dan/atau Pelanggaran Ukuran Lebih",
        "issuer": "Menteri Perhubungan",
        "issued_date": "2019-01-01", "effective_date": "2019-01-01",
        "status": "BERLAKU",
        "subjects": ["muatan lebih","ukuran lebih","ODOL","pengawasan","mobil barang","penindakan"],
        "official_urls": ["https://jdih.kemenhub.go.id/regulasi/view/se/21/2019"],
        "pdf_urls": [],
        "amends": [], "amended_by": [],
        "revokes": [], "revoked_by": [],
        "related_regulations": ["PERMENHUB_60_2019","PERMENHUB_18_2021"],
        "notes": "Surat edaran khusus ODOL. Dasar operasional program Zero ODOL.",
        "verification_required": False
    },
    {
        "id": "SE_DJPD_2023_ODOL", "type": "SE_DIRJEN", "number": "UNKNOWN", "year": 2023,
        "title": "Surat Edaran Dirjen Perhubungan Darat tentang ODOL / Normalisasi Kendaraan",
        "issuer": "Direktur Jenderal Perhubungan Darat",
        "issued_date": "2023-01-01", "effective_date": "2023-01-01",
        "status": "UNKNOWN",
        "subjects": ["ODOL","normalisasi kendaraan","zero ODOL","penindakan"],
        "official_urls": ["https://jdih.kemenhub.go.id/"],
        "pdf_urls": [],
        "amends": [], "amended_by": [],
        "revokes": [], "revoked_by": [],
        "related_regulations": ["SE_MENHUB_21_2019"],
        "notes": "Nomor perlu dikonfirmasi dari JDIH Kemenhub.",
        "verification_required": True
    },
    # --- PERDIRJEN ---
    {
        "id": "PERDIRJEN_PD_004_2022", "type": "PERDIRJEN",
        "number": "SK.4234/AJ.309/DRJD/2022", "year": 2022,
        "title": "Petunjuk Teknis Penyelenggaraan Penimbangan Kendaraan Bermotor dengan Alat Penimbangan yang dapat Bergerak",
        "issuer": "Direktur Jenderal Perhubungan Darat",
        "issued_date": "2022-01-01", "effective_date": "2022-01-01",
        "status": "BERLAKU",
        "subjects": ["WIM","weigh in motion","penimbangan bergerak","alat penimbangan"],
        "official_urls": ["https://jdih.kemenhub.go.id/"],
        "pdf_urls": [],
        "amends": [], "amended_by": [],
        "revokes": [], "revoked_by": [],
        "related_regulations": ["PERMENHUB_18_2021","PERMENHUB_47_2021"],
        "notes": "Petunjuk teknis WIM. Nomor surat perlu verifikasi.",
        "verification_required": True
    },
    # --- KEPMENHUB ---
    {
        "id": "KEPMENHUB_52_2004", "type": "KEPMENHUB", "number": "KM_52", "year": 2004,
        "title": "Penyelenggaraan Angkutan Barang Berbahaya",
        "issuer": "Menteri Perhubungan",
        "issued_date": "2004-01-01", "effective_date": "2004-01-01",
        "status": "UNKNOWN",
        "subjects": ["barang berbahaya","B3","angkutan khusus"],
        "official_urls": [],
        "pdf_urls": [],
        "amends": [], "amended_by": [],
        "revokes": [], "revoked_by": [],
        "related_regulations": ["PP_74_2014"],
        "notes": "Status terkini perlu verifikasi — mungkin sudah digantikan.",
        "verification_required": True
    },
    # --- 2024–2026 ---
    {
        "id": "PERMENHUB_2024_ODOL", "type": "PERMENHUB", "number": "UNKNOWN", "year": 2024,
        "title": "Permenhub terkait ODOL / Zero ODOL 2027 (2024)",
        "issuer": "Menteri Perhubungan",
        "issued_date": "2024-01-01", "effective_date": "2024-01-01",
        "status": "UNKNOWN",
        "subjects": ["ODOL","Zero ODOL 2027","normalisasi kendaraan"],
        "official_urls": ["https://jdih.kemenhub.go.id/"],
        "pdf_urls": [],
        "amends": [], "amended_by": [],
        "revokes": [], "revoked_by": [],
        "related_regulations": [],
        "notes": "Regulasi 2024 terkait Zero ODOL. Nomor spesifik perlu dikonfirmasi dari JDIH.",
        "verification_required": True
    },
    {
        "id": "INPRES_ODOL_2024", "type": "INPRES", "number": "UNKNOWN", "year": 2024,
        "title": "Instruksi Presiden terkait Program ODOL / Kendaraan Tua",
        "issuer": "Presiden RI",
        "issued_date": "2024-01-01", "effective_date": "2024-01-01",
        "status": "UNKNOWN",
        "subjects": ["kendaraan tua","ODOL","normalisasi","Zero ODOL 2027"],
        "official_urls": ["https://peraturan.go.id/"],
        "pdf_urls": [],
        "amends": [], "amended_by": [],
        "revokes": [], "revoked_by": [],
        "related_regulations": [],
        "notes": "Perlu verifikasi nomor dan status.",
        "verification_required": True
    },
    # --- LOKAL ---
    {
        "id": "PERGUB_DKI_117_2017", "type": "PERGUB", "number": "117", "year": 2017,
        "title": "Pembatasan Lalu Lintas Kendaraan Angkutan Barang di DKI Jakarta",
        "issuer": "Gubernur DKI Jakarta",
        "issued_date": "2017-01-01", "effective_date": "2017-01-01",
        "status": "DIUBAH",
        "subjects": ["pembatasan kendaraan","angkutan barang","DKI Jakarta","jam operasional"],
        "official_urls": ["https://jdih.jakarta.go.id/"],
        "pdf_urls": [],
        "amends": [], "amended_by": ["PERGUB_DKI_83_2020"],
        "revokes": [], "revoked_by": [],
        "related_regulations": [],
        "notes": "Pembatasan jam operasional truk besar di Jakarta.",
        "verification_required": True
    },
    {
        "id": "PERGUB_DKI_83_2020", "type": "PERGUB", "number": "83", "year": 2020,
        "title": "Perubahan Pergub 117/2017 tentang Pembatasan Lalu Lintas Kendaraan Angkutan Barang",
        "issuer": "Gubernur DKI Jakarta",
        "issued_date": "2020-01-01", "effective_date": "2020-01-01",
        "status": "BERLAKU",
        "subjects": ["pembatasan kendaraan","angkutan barang","DKI Jakarta","jam operasional"],
        "official_urls": ["https://jdih.jakarta.go.id/"],
        "pdf_urls": [],
        "amends": ["PERGUB_DKI_117_2017"], "amended_by": [],
        "revokes": [], "revoked_by": [],
        "related_regulations": ["PERGUB_DKI_117_2017"],
        "notes": "Perubahan pergub pembatasan angkutan barang DKI.",
        "verification_required": True
    },
    {
        "id": "PERDA_DKI_5_2014", "type": "PERDA", "number": "5", "year": 2014,
        "title": "Transportasi",
        "issuer": "Pemerintah DKI Jakarta",
        "issued_date": "2014-01-01", "effective_date": "2014-01-01",
        "status": "BERLAKU",
        "subjects": ["transportasi","angkutan jalan","DKI Jakarta","pembatasan kendaraan"],
        "official_urls": ["https://jdih.jakarta.go.id/"],
        "pdf_urls": [],
        "amends": [], "amended_by": [],
        "revokes": [], "revoked_by": [],
        "related_regulations": [],
        "notes": "Perda transportasi DKI Jakarta.",
        "verification_required": True
    },
]

# ==============================================================
# 02 — REGULATION RELATIONSHIPS
# ==============================================================
RELATIONSHIPS = [
    {"from": "UU_22_2009",        "relationship": "IMPLEMENTS",  "to": "PP_55_2012",         "description": "PP 55/2012 peraturan pelaksana UU 22/2009 tentang kendaraan"},
    {"from": "UU_22_2009",        "relationship": "IMPLEMENTS",  "to": "PP_74_2014",         "description": "PP 74/2014 peraturan pelaksana UU 22/2009 tentang angkutan jalan"},
    {"from": "UU_22_2009",        "relationship": "IMPLEMENTS",  "to": "PP_79_2013",         "description": "PP 79/2013 peraturan pelaksana UU 22/2009 tentang jaringan LLAJ"},
    {"from": "UU_22_2009",        "relationship": "IMPLEMENTS",  "to": "PP_80_2012",         "description": "PP 80/2012 peraturan pelaksana UU 22/2009 tentang pemeriksaan kendaraan"},
    {"from": "UU_22_2009",        "relationship": "IMPLEMENTS",  "to": "PP_30_2021",         "description": "PP 30/2021 peraturan pelaksana UU 22/2009"},
    {"from": "UU_38_2004",        "relationship": "IMPLEMENTS",  "to": "PP_34_2006",         "description": "PP 34/2006 peraturan pelaksana UU 38/2004 tentang jalan"},
    {"from": "UU_2_2022",         "relationship": "AMENDS",      "to": "UU_38_2004",         "description": "UU 2/2022 mengubah UU 38/2004"},
    {"from": "PP_74_2014",        "relationship": "IMPLEMENTS",  "to": "PERMENHUB_60_2019",  "description": "PM 60/2019 mengatur detail pelaksanaan PP 74/2014"},
    {"from": "PP_55_2012",        "relationship": "IMPLEMENTS",  "to": "PERMENHUB_23_2021",  "description": "PM 23/2021 mengatur uji tipe sesuai amanat PP 55/2012"},
    {"from": "PP_80_2012",        "relationship": "IMPLEMENTS",  "to": "PERMENHUB_18_2021",  "description": "PM 18/2021 mengatur penimbangan sesuai amanat PP 80/2012"},
    {"from": "PP_55_2012",        "relationship": "IMPLEMENTS",  "to": "PERMENHUB_19_2021",  "description": "PM 19/2021 mengatur uji berkala sesuai amanat PP 55/2012"},
    {"from": "PP_30_2021",        "relationship": "IMPLEMENTS",  "to": "PERMENHUB_25_2021",  "description": "PM 25/2021 mengatur penyelenggaraan angkutan jalan berdasarkan PP 30/2021"},
    {"from": "PERMENHUB_18_2021", "relationship": "IMPLEMENTS",  "to": "PERDIRJEN_PD_004_2022", "description": "Perdirjen 2022 mengatur teknis WIM berdasarkan PM 18/2021"},
    {"from": "PERMENHUB_18_2021", "relationship": "REVOKES",     "to": "PERMENHUB_134_2015", "description": "PM 18/2021 mencabut PM 134/2015"},
    {"from": "PERMENHUB_19_2021", "relationship": "REVOKES",     "to": "PERMENHUB_133_2015", "description": "PM 19/2021 mencabut PM 133/2015"},
    {"from": "PERMENHUB_23_2021", "relationship": "REVOKES",     "to": "PERMENHUB_33_2018",  "description": "PM 23/2021 mencabut PM 33/2018"},
    {"from": "UU_22_2009",        "relationship": "REVOKES",     "to": "UU_14_1992",         "description": "UU 22/2009 mencabut UU 14/1992"},
    {"from": "PERGUB_DKI_83_2020","relationship": "AMENDS",      "to": "PERGUB_DKI_117_2017","description": "Pergub DKI 83/2020 mengubah Pergub DKI 117/2017"},
    {"from": "SE_MENHUB_21_2019", "relationship": "IMPLEMENTS",  "to": "PERMENHUB_60_2019",  "description": "SE 21/2019 menguatkan enforcement PM 60/2019 terkait ODOL"},
]

# ==============================================================
# 03 — ARTICLES
# ==============================================================
ARTICLES = [
    {
        "id": "ART_UU22_2009_P19",
        "regulation_id": "UU_22_2009", "article_number": "19", "paragraph_number": "1", "letter": None,
        "topic": "Kelas Jalan dan MST",
        "indonesian_text": "Jalan dibagi dalam beberapa kelas berdasarkan fungsi dan intensitas lalu lintas serta daya dukung untuk menerima muatan sumbu terberat dan dimensi kendaraan bermotor.",
        "normalized_rule": "Kelas jalan ditentukan berdasarkan daya dukung MST dan dimensi kendaraan yang diizinkan",
        "legal_status": "BERLAKU", "effective_date": "2009-06-22",
        "source_url": "https://peraturan.bpk.go.id/Details/38946/uu-no-22-tahun-2009",
        "verification_required": False
    },
    {
        "id": "ART_UU22_2009_P20",
        "regulation_id": "UU_22_2009", "article_number": "20", "paragraph_number": "1", "letter": None,
        "topic": "Kelas Jalan I — Batas Dimensi dan MST",
        "indonesian_text": "Jalan kelas I adalah jalan arteri dan kolektor yang dapat dilalui kendaraan bermotor termasuk muatan dengan ukuran lebar tidak melebihi 2.500 milimeter, ukuran panjang tidak melebihi 18.000 milimeter, ukuran paling tinggi 4.200 milimeter, dan muatan sumbu terberat 10 ton.",
        "normalized_rule": "Kelas I: lebar ≤2.500 mm | panjang ≤18.000 mm | tinggi ≤4.200 mm | MST ≤10 ton",
        "legal_status": "BERLAKU", "effective_date": "2009-06-22",
        "source_url": "https://peraturan.bpk.go.id/Details/38946/uu-no-22-tahun-2009",
        "verification_required": False
    },
    {
        "id": "ART_UU22_2009_P21",
        "regulation_id": "UU_22_2009", "article_number": "21", "paragraph_number": "1", "letter": None,
        "topic": "Kelas Jalan II — Batas Dimensi dan MST",
        "indonesian_text": "Jalan kelas II adalah jalan arteri, kolektor, lokal, dan lingkungan yang dapat dilalui kendaraan bermotor dengan ukuran lebar tidak melebihi 2.500 milimeter, ukuran panjang tidak melebihi 12.000 milimeter, ukuran paling tinggi 4.200 milimeter, dan muatan sumbu terberat 8 ton.",
        "normalized_rule": "Kelas II: lebar ≤2.500 mm | panjang ≤12.000 mm | tinggi ≤4.200 mm | MST ≤8 ton",
        "legal_status": "BERLAKU", "effective_date": "2009-06-22",
        "source_url": "https://peraturan.bpk.go.id/Details/38946/uu-no-22-tahun-2009",
        "verification_required": False
    },
    {
        "id": "ART_UU22_2009_P22",
        "regulation_id": "UU_22_2009", "article_number": "22", "paragraph_number": "1", "letter": None,
        "topic": "Kelas Jalan III — Batas Dimensi dan MST",
        "indonesian_text": "Jalan kelas III adalah jalan arteri, kolektor, lokal, dan lingkungan yang dapat dilalui kendaraan bermotor dengan ukuran lebar tidak melebihi 2.100 milimeter, ukuran panjang tidak melebihi 9.000 milimeter, ukuran paling tinggi 3.500 milimeter, dan muatan sumbu terberat 8 ton.",
        "normalized_rule": "Kelas III: lebar ≤2.100 mm | panjang ≤9.000 mm | tinggi ≤3.500 mm | MST ≤8 ton",
        "legal_status": "BERLAKU", "effective_date": "2009-06-22",
        "source_url": "https://peraturan.bpk.go.id/Details/38946/uu-no-22-tahun-2009",
        "verification_required": False
    },
    {
        "id": "ART_UU22_2009_P169",
        "regulation_id": "UU_22_2009", "article_number": "169", "paragraph_number": "1", "letter": None,
        "topic": "Larangan Melebihi JBI / Dimensi",
        "indonesian_text": "Pengemudi dan/atau perusahaan angkutan umum barang dilarang menggunakan kendaraan bermotor untuk mengangkut muatan yang melebihi daya angkut dan/atau dimensi kendaraan yang ditetapkan.",
        "normalized_rule": "DILARANG mengangkut muatan melebihi daya angkut (JBI) dan/atau dimensi yang ditetapkan",
        "legal_status": "BERLAKU", "effective_date": "2009-06-22",
        "source_url": "https://peraturan.bpk.go.id/Details/38946/uu-no-22-tahun-2009",
        "verification_required": False
    },
    {
        "id": "ART_UU22_2009_P307",
        "regulation_id": "UU_22_2009", "article_number": "307", "paragraph_number": None, "letter": None,
        "topic": "Sanksi Pidana — Pelanggaran Muatan/Dimensi",
        "indonesian_text": "Setiap orang yang mengemudikan kendaraan bermotor angkutan umum barang yang tidak memenuhi ketentuan mengenai tata cara pemuatan, daya angkut, dimensi kendaraan sebagaimana dimaksud dalam Pasal 169 ayat (1) dipidana dengan pidana kurungan paling lama 2 bulan atau denda paling banyak Rp500.000,00.",
        "normalized_rule": "Sanksi pidana pelanggaran muatan/dimensi: kurungan ≤2 bulan ATAU denda ≤Rp500.000",
        "legal_status": "BERLAKU", "effective_date": "2009-06-22",
        "source_url": "https://peraturan.bpk.go.id/Details/38946/uu-no-22-tahun-2009",
        "verification_required": False
    },
    {
        "id": "ART_PP55_2012_P7_1",
        "regulation_id": "PP_55_2012", "article_number": "7", "paragraph_number": "1", "letter": None,
        "topic": "Dimensi Kendaraan — Lebar Maksimum",
        "indonesian_text": "Lebar kendaraan bermotor paling tinggi 2.500 (dua ribu lima ratus) milimeter.",
        "normalized_rule": "Lebar maksimum kendaraan bermotor = 2.500 mm",
        "legal_status": "BERLAKU", "effective_date": "2012-04-25",
        "source_url": "https://peraturan.bpk.go.id/Details/5307/pp-no-55-tahun-2012",
        "verification_required": False
    },
    {
        "id": "ART_PP55_2012_P7_2",
        "regulation_id": "PP_55_2012", "article_number": "7", "paragraph_number": "2", "letter": None,
        "topic": "Dimensi Kendaraan — Panjang Maksimum",
        "indonesian_text": "Panjang kendaraan bermotor paling tinggi 12.000 (dua belas ribu) milimeter, kecuali untuk kendaraan bermotor tertentu.",
        "normalized_rule": "Panjang maksimum kendaraan bermotor tunggal = 12.000 mm",
        "legal_status": "BERLAKU", "effective_date": "2012-04-25",
        "source_url": "https://peraturan.bpk.go.id/Details/5307/pp-no-55-tahun-2012",
        "verification_required": False
    },
    {
        "id": "ART_PP55_2012_P7_3",
        "regulation_id": "PP_55_2012", "article_number": "7", "paragraph_number": "3", "letter": None,
        "topic": "Dimensi Kendaraan — Tinggi Maksimum dan Rasio",
        "indonesian_text": "Tinggi kendaraan bermotor paling tinggi 4.200 (empat ribu dua ratus) milimeter dan tidak melebihi 1,7 (satu koma tujuh) kali lebar kendaraan.",
        "normalized_rule": "Tinggi maks = 4.200 mm DAN tinggi ≤ 1,7 × lebar kendaraan",
        "legal_status": "BERLAKU", "effective_date": "2012-04-25",
        "source_url": "https://peraturan.bpk.go.id/Details/5307/pp-no-55-tahun-2012",
        "verification_required": False
    },
    {
        "id": "ART_PP55_2012_P9",
        "regulation_id": "PP_55_2012", "article_number": "9", "paragraph_number": "1", "letter": None,
        "topic": "Kereta Gandengan/Tempelan — Panjang Total Maksimum",
        "indonesian_text": "Panjang kereta gandengan atau kereta tempelan beserta kendaraan penariknya paling tinggi 18.000 (delapan belas ribu) milimeter.",
        "normalized_rule": "Panjang total kombinasi kendaraan + gandengan/tempelan = maks 18.000 mm",
        "legal_status": "BERLAKU", "effective_date": "2012-04-25",
        "source_url": "https://peraturan.bpk.go.id/Details/5307/pp-no-55-tahun-2012",
        "verification_required": False
    },
    {
        "id": "ART_PM18_2021_P4a",
        "regulation_id": "PERMENHUB_18_2021", "article_number": "4", "paragraph_number": "1", "letter": "a",
        "topic": "MST — Jalan Kelas I",
        "indonesian_text": "Muatan Sumbu Terberat (MST) yang diizinkan untuk kendaraan bermotor yang beroperasi di Jalan Kelas I: MST paling tinggi 10 (sepuluh) ton.",
        "normalized_rule": "MST di Jalan Kelas I ≤ 10 ton",
        "legal_status": "BERLAKU", "effective_date": "2021-03-01",
        "source_url": "https://jdih.kemenhub.go.id/regulasi/view/pm/18/2021",
        "verification_required": False
    },
    {
        "id": "ART_PM18_2021_P4b",
        "regulation_id": "PERMENHUB_18_2021", "article_number": "4", "paragraph_number": "1", "letter": "b",
        "topic": "MST — Jalan Kelas II",
        "indonesian_text": "Muatan Sumbu Terberat (MST) yang diizinkan untuk kendaraan bermotor yang beroperasi di Jalan Kelas II: MST paling tinggi 8 (delapan) ton.",
        "normalized_rule": "MST di Jalan Kelas II ≤ 8 ton",
        "legal_status": "BERLAKU", "effective_date": "2021-03-01",
        "source_url": "https://jdih.kemenhub.go.id/regulasi/view/pm/18/2021",
        "verification_required": False
    },
    {
        "id": "ART_PM18_2021_P4c",
        "regulation_id": "PERMENHUB_18_2021", "article_number": "4", "paragraph_number": "1", "letter": "c",
        "topic": "MST — Jalan Kelas III",
        "indonesian_text": "Muatan Sumbu Terberat (MST) yang diizinkan untuk kendaraan bermotor yang beroperasi di Jalan Kelas III: MST paling tinggi 8 (delapan) ton.",
        "normalized_rule": "MST di Jalan Kelas III ≤ 8 ton",
        "legal_status": "BERLAKU", "effective_date": "2021-03-01",
        "source_url": "https://jdih.kemenhub.go.id/regulasi/view/pm/18/2021",
        "verification_required": False
    },
    {
        "id": "ART_PM18_2021_P4d",
        "regulation_id": "PERMENHUB_18_2021", "article_number": "4", "paragraph_number": "1", "letter": "d",
        "topic": "MST — Jalan Kelas Khusus",
        "indonesian_text": "Muatan Sumbu Terberat (MST) yang diizinkan untuk kendaraan bermotor yang beroperasi di Jalan Kelas Khusus: MST lebih dari 10 (sepuluh) ton.",
        "normalized_rule": "MST di Jalan Kelas Khusus > 10 ton (nilai spesifik sesuai penetapan)",
        "legal_status": "BERLAKU", "effective_date": "2021-03-01",
        "source_url": "https://jdih.kemenhub.go.id/regulasi/view/pm/18/2021",
        "verification_required": False
    },
    {
        "id": "ART_PM18_2021_Toleransi",
        "regulation_id": "PERMENHUB_18_2021", "article_number": "5", "paragraph_number": "1", "letter": None,
        "topic": "Toleransi Penimbangan — 5%",
        "indonesian_text": "Toleransi kelebihan muatan yang diizinkan dalam penimbangan adalah 5% (lima persen) dari JBI.",
        "normalized_rule": "Toleransi penimbangan = 5% dari JBI. CATATAN: toleransi teknis pengukuran, BUKAN tambahan legal di atas JBI",
        "legal_status": "BERLAKU", "effective_date": "2021-03-01",
        "source_url": "https://jdih.kemenhub.go.id/regulasi/view/pm/18/2021",
        "verification_required": True
    },
    {
        "id": "ART_PM19_2021_UjiBerkala",
        "regulation_id": "PERMENHUB_19_2021", "article_number": "5", "paragraph_number": "1", "letter": None,
        "topic": "Uji Berkala — Interval 6 Bulan",
        "indonesian_text": "Kendaraan angkutan barang wajib melaksanakan pengujian berkala setiap 6 (enam) bulan sekali.",
        "normalized_rule": "Kendaraan angkutan barang WAJIB uji berkala setiap 6 bulan",
        "legal_status": "BERLAKU", "effective_date": "2021-03-01",
        "source_url": "https://jdih.kemenhub.go.id/regulasi/view/pm/19/2021",
        "verification_required": False
    },
]

# ==============================================================
# 04 — RULES (machine-readable conditional rules)
# ==============================================================
RULES = [
    {
        "rule_id": "RULE_001", "regulation_id": "PP_55_2012",
        "article": "7", "paragraph": "1",
        "rule_type": "MAX_DIMENSION", "parameter": "vehicle_width",
        "operator": "<=", "value": 2500, "unit": "mm", "formula": None,
        "conditions": [],
        "vehicle_types": ["all"], "road_classes": ["Kelas I","Kelas II"], "cargo_types": ["any"],
        "action_if_violated": "HOLD",
        "legal_text": "Lebar kendaraan bermotor paling tinggi 2.500 milimeter.",
        "source_url": "https://peraturan.bpk.go.id/Details/5307/pp-no-55-tahun-2012",
        "effective_from": "2012-04-25", "effective_until": None
    },
    {
        "rule_id": "RULE_002", "regulation_id": "UU_22_2009",
        "article": "22", "paragraph": "1",
        "rule_type": "MAX_DIMENSION", "parameter": "vehicle_width",
        "operator": "<=", "value": 2100, "unit": "mm", "formula": None,
        "conditions": [{"field": "road_class", "operator": "==", "value": "Kelas III"}],
        "vehicle_types": ["all"], "road_classes": ["Kelas III"], "cargo_types": ["any"],
        "action_if_violated": "HOLD",
        "legal_text": "Jalan kelas III dapat dilalui kendaraan bermotor dengan lebar tidak melebihi 2.100 milimeter.",
        "source_url": "https://peraturan.bpk.go.id/Details/38946/uu-no-22-tahun-2009",
        "effective_from": "2009-06-22", "effective_until": None
    },
    {
        "rule_id": "RULE_003", "regulation_id": "PP_55_2012",
        "article": "7", "paragraph": "2",
        "rule_type": "MAX_DIMENSION", "parameter": "vehicle_length",
        "operator": "<=", "value": 12000, "unit": "mm", "formula": None,
        "conditions": [{"field": "vehicle_type", "operator": "!=", "value": "combination"}],
        "vehicle_types": ["single"], "road_classes": ["all"], "cargo_types": ["any"],
        "action_if_violated": "HOLD",
        "legal_text": "Panjang kendaraan bermotor paling tinggi 12.000 milimeter.",
        "source_url": "https://peraturan.bpk.go.id/Details/5307/pp-no-55-tahun-2012",
        "effective_from": "2012-04-25", "effective_until": None
    },
    {
        "rule_id": "RULE_004", "regulation_id": "UU_22_2009",
        "article": "22", "paragraph": "1",
        "rule_type": "MAX_DIMENSION", "parameter": "vehicle_length",
        "operator": "<=", "value": 9000, "unit": "mm", "formula": None,
        "conditions": [{"field": "road_class", "operator": "==", "value": "Kelas III"}],
        "vehicle_types": ["single"], "road_classes": ["Kelas III"], "cargo_types": ["any"],
        "action_if_violated": "HOLD",
        "legal_text": "Jalan kelas III dapat dilalui kendaraan bermotor dengan panjang tidak melebihi 9.000 milimeter.",
        "source_url": "https://peraturan.bpk.go.id/Details/38946/uu-no-22-tahun-2009",
        "effective_from": "2009-06-22", "effective_until": None
    },
    {
        "rule_id": "RULE_005", "regulation_id": "PP_55_2012",
        "article": "9", "paragraph": "1",
        "rule_type": "MAX_DIMENSION", "parameter": "vehicle_length_combination",
        "operator": "<=", "value": 18000, "unit": "mm", "formula": None,
        "conditions": [{"field": "vehicle_type", "operator": "in", "value": ["combination","semitrailer","gandengan"]}],
        "vehicle_types": ["combination","semitrailer","gandengan"], "road_classes": ["Kelas I"], "cargo_types": ["any"],
        "action_if_violated": "HOLD",
        "legal_text": "Panjang kereta gandengan atau kereta tempelan beserta kendaraan penariknya paling tinggi 18.000 milimeter.",
        "source_url": "https://peraturan.bpk.go.id/Details/5307/pp-no-55-tahun-2012",
        "effective_from": "2012-04-25", "effective_until": None
    },
    {
        "rule_id": "RULE_006", "regulation_id": "PP_55_2012",
        "article": "7", "paragraph": "3",
        "rule_type": "MAX_DIMENSION", "parameter": "vehicle_height",
        "operator": "<=", "value": 4200, "unit": "mm", "formula": None,
        "conditions": [],
        "vehicle_types": ["all"], "road_classes": ["Kelas I","Kelas II","Kelas Khusus"], "cargo_types": ["any"],
        "action_if_violated": "HOLD",
        "legal_text": "Tinggi kendaraan bermotor paling tinggi 4.200 milimeter dan tidak melebihi 1,7 kali lebar kendaraan.",
        "source_url": "https://peraturan.bpk.go.id/Details/5307/pp-no-55-tahun-2012",
        "effective_from": "2012-04-25", "effective_until": None
    },
    {
        "rule_id": "RULE_007", "regulation_id": "UU_22_2009",
        "article": "22", "paragraph": "1",
        "rule_type": "MAX_DIMENSION", "parameter": "vehicle_height",
        "operator": "<=", "value": 3500, "unit": "mm", "formula": None,
        "conditions": [{"field": "road_class", "operator": "==", "value": "Kelas III"}],
        "vehicle_types": ["all"], "road_classes": ["Kelas III"], "cargo_types": ["any"],
        "action_if_violated": "HOLD",
        "legal_text": "Jalan kelas III dapat dilalui kendaraan bermotor dengan tinggi paling tinggi 3.500 milimeter.",
        "source_url": "https://peraturan.bpk.go.id/Details/38946/uu-no-22-tahun-2009",
        "effective_from": "2009-06-22", "effective_until": None
    },
    {
        "rule_id": "RULE_008", "regulation_id": "PP_55_2012",
        "article": "7", "paragraph": "3",
        "rule_type": "MAX_RATIO", "parameter": "height_to_width_ratio",
        "operator": "<=", "value": 1.7, "unit": "ratio",
        "formula": "vehicle_height / vehicle_width <= 1.7",
        "conditions": [],
        "vehicle_types": ["all"], "road_classes": ["all"], "cargo_types": ["any"],
        "action_if_violated": "HOLD",
        "legal_text": "Tinggi kendaraan bermotor tidak melebihi 1,7 kali lebar kendaraan.",
        "source_url": "https://peraturan.bpk.go.id/Details/5307/pp-no-55-tahun-2012",
        "effective_from": "2012-04-25", "effective_until": None
    },
    {
        "rule_id": "RULE_009", "regulation_id": "PERMENHUB_18_2021",
        "article": "4", "paragraph": "1",
        "rule_type": "MAX_WEIGHT", "parameter": "MST",
        "operator": "<=", "value": 10000, "unit": "kg", "formula": None,
        "conditions": [{"field": "road_class", "operator": "==", "value": "Kelas I"}],
        "vehicle_types": ["all"], "road_classes": ["Kelas I"], "cargo_types": ["any"],
        "action_if_violated": "HOLD",
        "legal_text": "MST yang diizinkan di Jalan Kelas I: paling tinggi 10 ton.",
        "source_url": "https://jdih.kemenhub.go.id/regulasi/view/pm/18/2021",
        "effective_from": "2021-03-01", "effective_until": None
    },
    {
        "rule_id": "RULE_010", "regulation_id": "PERMENHUB_18_2021",
        "article": "4", "paragraph": "1",
        "rule_type": "MAX_WEIGHT", "parameter": "MST",
        "operator": "<=", "value": 8000, "unit": "kg", "formula": None,
        "conditions": [{"field": "road_class", "operator": "==", "value": "Kelas II"}],
        "vehicle_types": ["all"], "road_classes": ["Kelas II"], "cargo_types": ["any"],
        "action_if_violated": "HOLD",
        "legal_text": "MST yang diizinkan di Jalan Kelas II: paling tinggi 8 ton.",
        "source_url": "https://jdih.kemenhub.go.id/regulasi/view/pm/18/2021",
        "effective_from": "2021-03-01", "effective_until": None
    },
    {
        "rule_id": "RULE_011", "regulation_id": "PERMENHUB_18_2021",
        "article": "4", "paragraph": "1",
        "rule_type": "MAX_WEIGHT", "parameter": "MST",
        "operator": "<=", "value": 8000, "unit": "kg", "formula": None,
        "conditions": [{"field": "road_class", "operator": "==", "value": "Kelas III"}],
        "vehicle_types": ["all"], "road_classes": ["Kelas III"], "cargo_types": ["any"],
        "action_if_violated": "HOLD",
        "legal_text": "MST yang diizinkan di Jalan Kelas III: paling tinggi 8 ton.",
        "source_url": "https://jdih.kemenhub.go.id/regulasi/view/pm/18/2021",
        "effective_from": "2021-03-01", "effective_until": None
    },
    {
        "rule_id": "RULE_012", "regulation_id": "UU_22_2009",
        "article": "169", "paragraph": "1",
        "rule_type": "PROHIBITION", "parameter": "gross_vehicle_weight",
        "operator": "<=", "value": None, "unit": "kg",
        "formula": "gross_vehicle_weight <= vehicle_JBI",
        "conditions": [],
        "vehicle_types": ["mobil_barang","angkutan_umum_barang"], "road_classes": ["all"], "cargo_types": ["any"],
        "action_if_violated": "HOLD",
        "legal_text": "Pengemudi dan/atau perusahaan angkutan umum barang dilarang menggunakan kendaraan bermotor untuk mengangkut muatan yang melebihi daya angkut.",
        "source_url": "https://peraturan.bpk.go.id/Details/38946/uu-no-22-tahun-2009",
        "effective_from": "2009-06-22", "effective_until": None
    },
    {
        "rule_id": "RULE_013", "regulation_id": "PERMENHUB_19_2021",
        "article": "5", "paragraph": "1",
        "rule_type": "COMPLIANCE_DOCUMENT", "parameter": "uji_berkala_valid",
        "operator": "==", "value": True, "unit": "boolean",
        "formula": "days_since_last_uji_berkala <= 180",
        "conditions": [{"field": "vehicle_type", "operator": "==", "value": "mobil_barang"}],
        "vehicle_types": ["mobil_barang"], "road_classes": ["all"], "cargo_types": ["any"],
        "action_if_violated": "HOLD",
        "legal_text": "Kendaraan angkutan barang wajib melaksanakan pengujian berkala setiap 6 bulan.",
        "source_url": "https://jdih.kemenhub.go.id/regulasi/view/pm/19/2021",
        "effective_from": "2021-03-01", "effective_until": None
    },
]

# ==============================================================
# 05 — NUMERIC THRESHOLDS
# ==============================================================
THRESHOLDS = [
    {"id":"THR_001","parameter":"vehicle_width","value":2500,"unit":"mm","operator":"<=",
     "condition":"Jalan Kelas I dan II","applies_to":"all motor vehicles","road_class":"Kelas I, II",
     "vehicle_type":"all","cargo_type":"any","legal_basis":"PP 55/2012 Pasal 7(1); UU 22/2009 Pasal 20-21",
     "article":"Pasal 7 ayat (1)","effective_from":"2012-04-25","effective_until":None,
     "source_url":"https://peraturan.bpk.go.id/Details/5307/pp-no-55-tahun-2012","verification_required":False},

    {"id":"THR_002","parameter":"vehicle_width","value":2100,"unit":"mm","operator":"<=",
     "condition":"Jalan Kelas III only","applies_to":"all motor vehicles on Kelas III roads","road_class":"Kelas III",
     "vehicle_type":"all","cargo_type":"any","legal_basis":"UU 22/2009 Pasal 22",
     "article":"Pasal 22","effective_from":"2009-06-22","effective_until":None,
     "source_url":"https://peraturan.bpk.go.id/Details/38946/uu-no-22-tahun-2009","verification_required":False},

    {"id":"THR_003","parameter":"vehicle_length","value":12000,"unit":"mm","operator":"<=",
     "condition":"Kendaraan tunggal (non-kombinasi)","applies_to":"single motor vehicles","road_class":"all",
     "vehicle_type":"single","cargo_type":"any","legal_basis":"PP 55/2012 Pasal 7(2); UU 22/2009 Pasal 21",
     "article":"Pasal 7 ayat (2)","effective_from":"2012-04-25","effective_until":None,
     "source_url":"https://peraturan.bpk.go.id/Details/5307/pp-no-55-tahun-2012","verification_required":False},

    {"id":"THR_004","parameter":"vehicle_length","value":9000,"unit":"mm","operator":"<=",
     "condition":"Jalan Kelas III only","applies_to":"single motor vehicles on Kelas III","road_class":"Kelas III",
     "vehicle_type":"single","cargo_type":"any","legal_basis":"UU 22/2009 Pasal 22",
     "article":"Pasal 22","effective_from":"2009-06-22","effective_until":None,
     "source_url":"https://peraturan.bpk.go.id/Details/38946/uu-no-22-tahun-2009","verification_required":False},

    {"id":"THR_005","parameter":"vehicle_length_combination","value":18000,"unit":"mm","operator":"<=",
     "condition":"Kombinasi (truk + gandengan/tempelan) di Kelas I","applies_to":"combination vehicles","road_class":"Kelas I",
     "vehicle_type":"combination","cargo_type":"any","legal_basis":"PP 55/2012 Pasal 9; UU 22/2009 Pasal 20",
     "article":"Pasal 9","effective_from":"2012-04-25","effective_until":None,
     "source_url":"https://peraturan.bpk.go.id/Details/5307/pp-no-55-tahun-2012","verification_required":False},

    {"id":"THR_006","parameter":"vehicle_height","value":4200,"unit":"mm","operator":"<=",
     "condition":"Jalan Kelas I, II, Khusus","applies_to":"all motor vehicles","road_class":"Kelas I, II, Khusus",
     "vehicle_type":"all","cargo_type":"any","legal_basis":"PP 55/2012 Pasal 7(3); UU 22/2009 Pasal 20-21",
     "article":"Pasal 7 ayat (3)","effective_from":"2012-04-25","effective_until":None,
     "source_url":"https://peraturan.bpk.go.id/Details/5307/pp-no-55-tahun-2012","verification_required":False},

    {"id":"THR_007","parameter":"vehicle_height","value":3500,"unit":"mm","operator":"<=",
     "condition":"Jalan Kelas III only","applies_to":"all motor vehicles on Kelas III","road_class":"Kelas III",
     "vehicle_type":"all","cargo_type":"any","legal_basis":"UU 22/2009 Pasal 22",
     "article":"Pasal 22","effective_from":"2009-06-22","effective_until":None,
     "source_url":"https://peraturan.bpk.go.id/Details/38946/uu-no-22-tahun-2009","verification_required":False},

    {"id":"THR_008","parameter":"height_to_width_ratio","value":1.7,"unit":"ratio","operator":"<=",
     "condition":"Tinggi ≤ 1,7 × lebar kendaraan","applies_to":"all motor vehicles","road_class":"all",
     "vehicle_type":"all","cargo_type":"any","legal_basis":"PP 55/2012 Pasal 7(3)",
     "article":"Pasal 7 ayat (3)","effective_from":"2012-04-25","effective_until":None,
     "source_url":"https://peraturan.bpk.go.id/Details/5307/pp-no-55-tahun-2012","verification_required":False},

    {"id":"THR_009","parameter":"MST","value":10,"unit":"ton","operator":"<=",
     "condition":"Jalan Kelas I","applies_to":"all vehicles on Class I roads","road_class":"Kelas I",
     "vehicle_type":"all","cargo_type":"any","legal_basis":"UU 22/2009 Pasal 20; PM 18/2021 Pasal 4(a)",
     "article":"Pasal 4 ayat (1) huruf a","effective_from":"2021-03-01","effective_until":None,
     "source_url":"https://jdih.kemenhub.go.id/regulasi/view/pm/18/2021","verification_required":False},

    {"id":"THR_010","parameter":"MST","value":8,"unit":"ton","operator":"<=",
     "condition":"Jalan Kelas II","applies_to":"all vehicles on Class II roads","road_class":"Kelas II",
     "vehicle_type":"all","cargo_type":"any","legal_basis":"UU 22/2009 Pasal 21; PM 18/2021 Pasal 4(b)",
     "article":"Pasal 4 ayat (1) huruf b","effective_from":"2021-03-01","effective_until":None,
     "source_url":"https://jdih.kemenhub.go.id/regulasi/view/pm/18/2021","verification_required":False},

    {"id":"THR_011","parameter":"MST","value":8,"unit":"ton","operator":"<=",
     "condition":"Jalan Kelas III","applies_to":"all vehicles on Class III roads","road_class":"Kelas III",
     "vehicle_type":"all","cargo_type":"any","legal_basis":"UU 22/2009 Pasal 22; PM 18/2021 Pasal 4(c)",
     "article":"Pasal 4 ayat (1) huruf c","effective_from":"2021-03-01","effective_until":None,
     "source_url":"https://jdih.kemenhub.go.id/regulasi/view/pm/18/2021","verification_required":False},

    {"id":"THR_012","parameter":"JBI_truck_1_1","value":8000,"unit":"kg","operator":"<=",
     "condition":"Konfigurasi sumbu 1.1 (truk 2 sumbu) di Kelas I/II",
     "applies_to":"truck 2-axle (1.1)","road_class":"Kelas I, II","vehicle_type":"truck_1_1","cargo_type":"any",
     "legal_basis":"PP 55/2012 Lampiran; PM 60/2019","article":"Lampiran PP 55/2012",
     "effective_from":"2012-04-25","effective_until":None,
     "source_url":"https://peraturan.bpk.go.id/Details/5307/pp-no-55-tahun-2012",
     "notes":"NILAI PERLU VERIFIKASI dari lampiran resmi PP 55/2012","verification_required":True},

    {"id":"THR_013","parameter":"JBI_truck_1_2","value":16000,"unit":"kg","operator":"<=",
     "condition":"Konfigurasi sumbu 1.2 (truk 3 sumbu) di Kelas I",
     "applies_to":"truck 3-axle (1.2)","road_class":"Kelas I","vehicle_type":"truck_1_2","cargo_type":"any",
     "legal_basis":"PP 55/2012 Lampiran; PM 60/2019","article":"Lampiran PP 55/2012",
     "effective_from":"2012-04-25","effective_until":None,
     "source_url":"https://peraturan.bpk.go.id/Details/5307/pp-no-55-tahun-2012",
     "notes":"NILAI PERLU VERIFIKASI dari lampiran resmi PP 55/2012","verification_required":True},

    {"id":"THR_014","parameter":"JBI_truck_1_22","value":20000,"unit":"kg","operator":"<=",
     "condition":"Konfigurasi sumbu 1.22 (truk 4 sumbu) di Kelas I",
     "applies_to":"truck 4-axle (1.22)","road_class":"Kelas I","vehicle_type":"truck_1_22","cargo_type":"any",
     "legal_basis":"PP 55/2012 Lampiran; PM 60/2019","article":"Lampiran PP 55/2012",
     "effective_from":"2012-04-25","effective_until":None,
     "source_url":"https://peraturan.bpk.go.id/Details/5307/pp-no-55-tahun-2012",
     "notes":"NILAI PERLU VERIFIKASI dari lampiran resmi PP 55/2012","verification_required":True},

    {"id":"THR_015","parameter":"uji_berkala_interval_months","value":6,"unit":"months","operator":"<=",
     "condition":"Kendaraan angkutan barang","applies_to":"mobil barang","road_class":"all",
     "vehicle_type":"mobil_barang","cargo_type":"any","legal_basis":"PM 19/2021 Pasal 5",
     "article":"Pasal 5","effective_from":"2021-03-01","effective_until":None,
     "source_url":"https://jdih.kemenhub.go.id/regulasi/view/pm/19/2021","verification_required":False},

    {"id":"THR_016","parameter":"pidana_denda_muatan_lebih","value":500000,"unit":"IDR","operator":"<=",
     "condition":"Denda pidana pelanggaran muatan/dimensi","applies_to":"pengemudi/perusahaan angkutan barang",
     "road_class":"all","vehicle_type":"all","cargo_type":"any","legal_basis":"UU 22/2009 Pasal 307",
     "article":"Pasal 307","effective_from":"2009-06-22","effective_until":None,
     "source_url":"https://peraturan.bpk.go.id/Details/38946/uu-no-22-tahun-2009","verification_required":False},

    {"id":"THR_017","parameter":"pidana_kurungan_muatan_lebih","value":2,"unit":"months","operator":"<=",
     "condition":"Kurungan pidana pelanggaran muatan/dimensi","applies_to":"pengemudi/perusahaan angkutan barang",
     "road_class":"all","vehicle_type":"all","cargo_type":"any","legal_basis":"UU 22/2009 Pasal 307",
     "article":"Pasal 307","effective_from":"2009-06-22","effective_until":None,
     "source_url":"https://peraturan.bpk.go.id/Details/38946/uu-no-22-tahun-2009","verification_required":False},

    {"id":"THR_018","parameter":"weighing_tolerance_percent","value":5,"unit":"%","operator":"<=",
     "condition":"Toleransi teknis di jembatan timbang","applies_to":"all commercial vehicles at weighbridge",
     "road_class":"all","vehicle_type":"all","cargo_type":"any","legal_basis":"PM 18/2021 Pasal 5",
     "article":"Pasal 5 ayat (1)","effective_from":"2021-03-01","effective_until":None,
     "source_url":"https://jdih.kemenhub.go.id/regulasi/view/pm/18/2021",
     "notes":"PERINGATAN: toleransi teknis pengukuran, BUKAN tambahan legal di atas JBI. Konfirmasi dari teks resmi.",
     "verification_required":True},
]

# ==============================================================
# 06 — VEHICLE RULES
# ==============================================================
VEHICLE_RULES = [
    {
        "rule_id":"VRULE_001","vehicle_category":"Mobil Barang","vehicle_type":"Truk",
        "axle_config":"1.1","axle_count":2,
        "JBI_kelas_I_kg":8000,"JBI_kelas_II_kg":8000,"JBI_kelas_III_kg":5000,
        "MST_front_kg":6000,"MST_rear_kg":8000,
        "max_length_mm":12000,"max_width_mm":2500,"max_height_mm":4200,
        "periodic_test_months":6,
        "legal_basis":"PP 55/2012; UU 22/2009",
        "notes":"Truk 2 sumbu. JBI PERLU VERIFIKASI dari lampiran PP 55/2012","verification_required":True
    },
    {
        "rule_id":"VRULE_002","vehicle_category":"Mobil Barang","vehicle_type":"Truk",
        "axle_config":"1.2","axle_count":3,
        "JBI_kelas_I_kg":16000,"JBI_kelas_II_kg":14000,"JBI_kelas_III_kg":None,
        "MST_front_kg":6000,"MST_rear_tandem_kg":18000,
        "max_length_mm":12000,"max_width_mm":2500,"max_height_mm":4200,
        "periodic_test_months":6,
        "legal_basis":"PP 55/2012; UU 22/2009",
        "notes":"Truk 3 sumbu. JBI PERLU VERIFIKASI dari lampiran PP 55/2012","verification_required":True
    },
    {
        "rule_id":"VRULE_003","vehicle_category":"Kereta Tempelan","vehicle_type":"Semitrailer",
        "axle_config":"1.2-2","axle_count":5,
        "JBI_kelas_I_kg":40000,"JBI_kelas_II_kg":None,"JBI_kelas_III_kg":None,
        "MST_front_kg":6000,"MST_rear_tandem_kg":18000,
        "max_length_mm":18000,"max_width_mm":2500,"max_height_mm":4200,
        "periodic_test_months":6,
        "legal_basis":"PP 55/2012 Pasal 9; UU 22/2009 Pasal 20",
        "notes":"Semitrailer kombinasi. JBI 40 ton INDIKATIF — perlu verifikasi menyeluruh","verification_required":True
    },
]

# ==============================================================
# 07 — CARGO RULES
# ==============================================================
CARGO_RULES = [
    {
        "rule_id":"CRULE_001","cargo_category":"Muatan Umum","cargo_type":"Barang Umum (General Cargo)",
        "max_weight_over_JBI":False,"load_distribution_required":True,"axle_distribution_check":True,
        "securing_required":True,"permit_required":False,
        "max_rear_overhang_mm":1500,
        "legal_basis":"PM 60/2019; PP 55/2012",
        "notes":"Julur muatan ke belakang maks ~1.500 mm — perlu verifikasi dari PM 60/2019","verification_required":True
    },
    {
        "rule_id":"CRULE_002","cargo_category":"Muatan Khusus","cargo_type":"Barang Berbahaya (B3/Hazmat)",
        "max_weight_over_JBI":False,"load_distribution_required":True,"axle_distribution_check":True,
        "securing_required":True,"permit_required":True,
        "additional_requirements":["Izin khusus angkutan B3","Pengemudi bersertifikat B3","Label/rambu B3","Dokumen manifest B3"],
        "legal_basis":"PM 60/2019; peraturan B3","notes":"Memerlukan izin dan persyaratan khusus","verification_required":True
    },
    {
        "rule_id":"CRULE_003","cargo_category":"Muatan Khusus","cargo_type":"Alat Berat / Barang Oversize",
        "max_weight_over_JBI":False,"load_distribution_required":True,"axle_distribution_check":True,
        "securing_required":True,"permit_required":True,
        "additional_requirements":["Izin angkutan barang khusus","Escort kendaraan (jika dimensi melebihi batas)","Survei rute"],
        "legal_basis":"PM 60/2019","notes":"Memerlukan izin khusus dan mungkin escort","verification_required":True
    },
]

# ==============================================================
# 08 — ROAD RULES
# ==============================================================
ROAD_RULES = [
    {
        "rule_id":"RRULE_001","road_category":"Nasional","road_class":"Kelas I",
        "max_width_mm":2500,"max_length_mm":18000,"max_height_mm":4200,"max_MST_ton":10,
        "truck_restriction":False,"time_restriction":None,"route_restriction":None,
        "legal_basis":"UU 22/2009 Pasal 20; PM 18/2021 Pasal 4",
        "notes":"Jalan kelas I: arteri dan kolektor nasional. MST 10 ton, dimensi penuh diizinkan.","verification_required":False
    },
    {
        "rule_id":"RRULE_002","road_category":"Nasional/Provinsi","road_class":"Kelas II",
        "max_width_mm":2500,"max_length_mm":12000,"max_height_mm":4200,"max_MST_ton":8,
        "truck_restriction":False,"time_restriction":None,"route_restriction":None,
        "legal_basis":"UU 22/2009 Pasal 21; PM 18/2021 Pasal 4",
        "notes":"Jalan kelas II: arteri, kolektor, lokal. MST 8 ton, panjang maks 12m.","verification_required":False
    },
    {
        "rule_id":"RRULE_003","road_category":"Kabupaten/Kota","road_class":"Kelas III",
        "max_width_mm":2100,"max_length_mm":9000,"max_height_mm":3500,"max_MST_ton":8,
        "truck_restriction":True,"time_restriction":"Varies by local regulation",
        "route_restriction":"May be restricted by local authority",
        "legal_basis":"UU 22/2009 Pasal 22; PM 18/2021 Pasal 4",
        "notes":"Jalan kelas III: lokal dan lingkungan. Batas dimensi lebih ketat.","verification_required":False
    },
    {
        "rule_id":"RRULE_004","road_category":"Nasional/Tol","road_class":"Kelas Khusus",
        "max_width_mm":2500,"max_length_mm":18000,"max_height_mm":4200,"max_MST_ton_min":10,
        "truck_restriction":False,"time_restriction":None,"route_restriction":"Specific vehicle types only",
        "legal_basis":"PM 18/2021 Pasal 4(d); PP 15/2005",
        "notes":"Kelas Khusus: MST > 10 ton sesuai penetapan spesifik.","verification_required":True
    },
    {
        "rule_id":"RRULE_DKI_001","road_category":"Lokal — DKI Jakarta","road_class":"Jalan DKI Jakarta",
        "max_width_mm":None,"max_length_mm":None,"max_height_mm":None,"max_MST_ton":None,
        "truck_restriction":True,
        "time_restriction":"Kendaraan angkutan barang JBI > 8 ton dilarang pada jam-jam tertentu di ruas tertentu",
        "route_restriction":"Tol dalam kota, jalan protokol Jakarta",
        "legal_basis":"Pergub DKI No. 117/2017 jo. No. 83/2020",
        "notes":"Detail ruas dan jam diatur dalam Pergub dan SK Kadishub DKI.","verification_required":True
    },
]

# ==============================================================
# 09 — SANCTIONS
# ==============================================================
SANCTIONS = [
    {"sanction_id":"SAN_001","violation_type":"Muatan Lebih / Daya Angkut Melebihi JBI",
     "sanction_type":"PIDANA","sanction_category":"DENDA","value":500000,"unit":"IDR",
     "alternative":"Kurungan paling lama 2 bulan",
     "applies_to":"Pengemudi dan/atau perusahaan angkutan umum barang",
     "legal_basis":"UU 22/2009 Pasal 307","verification_required":False},
    {"sanction_id":"SAN_002","violation_type":"Pelanggaran Dimensi (Ukuran Lebih)",
     "sanction_type":"PIDANA","sanction_category":"DENDA","value":500000,"unit":"IDR",
     "alternative":"Kurungan paling lama 2 bulan",
     "applies_to":"Pengemudi dan/atau perusahaan angkutan umum barang",
     "legal_basis":"UU 22/2009 Pasal 307","verification_required":False},
    {"sanction_id":"SAN_003","violation_type":"Muatan Lebih — Tindakan Operasional",
     "sanction_type":"ADMINISTRATIF","sanction_category":"NORMALISASI/PEMBONGKARAN",
     "value":None,"unit":None,"alternative":None,
     "applies_to":"Kendaraan yang tertimbang melebihi JBI di jembatan timbang",
     "legal_basis":"PM 18/2021; PP 80/2012",
     "notes":"Kendaraan wajib mengurangi muatan (normalisasi) di tempat","verification_required":False},
    {"sanction_id":"SAN_004","violation_type":"Kendaraan Tidak Laik Jalan (Uji Berkala Kadaluarsa)",
     "sanction_type":"ADMINISTRATIF","sanction_category":"PENAHANAN KENDARAAN",
     "value":None,"unit":None,"alternative":None,
     "applies_to":"Kendaraan tanpa sertifikat uji berkala yang valid",
     "legal_basis":"UU 22/2009; PM 19/2021",
     "notes":"Kendaraan dapat ditahan sampai uji berkala dilaksanakan","verification_required":False},
    {"sanction_id":"SAN_005","violation_type":"Dimensi Lebih (Tanpa Izin Khusus)",
     "sanction_type":"ADMINISTRATIF","sanction_category":"LARANGAN BEROPERASI",
     "value":None,"unit":None,"alternative":None,
     "applies_to":"Kendaraan dimensi melebihi standar tanpa izin angkutan khusus",
     "legal_basis":"PM 60/2019; UU 22/2009",
     "notes":"Kendaraan dimensi lebih tanpa izin tidak boleh beroperasi di jalan umum","verification_required":False},
]

# ==============================================================
# 10 — SOURCES
# ==============================================================
SOURCES = [
    {"source_id":"SRC_001","name":"JDIH BPK","url":"https://peraturan.bpk.go.id/","type":"PRIMARY","coverage":"UU, PP, Perpres, Permen"},
    {"source_id":"SRC_002","name":"JDIH Kemenhub","url":"https://jdih.kemenhub.go.id/","type":"PRIMARY","coverage":"Permenhub, Kepmenhub, SE Menhub, Perdirjen"},
    {"source_id":"SRC_003","name":"peraturan.go.id","url":"https://peraturan.go.id/","type":"PRIMARY","coverage":"UU, PP, Perpres"},
    {"source_id":"SRC_004","name":"JDIH DKI Jakarta","url":"https://jdih.jakarta.go.id/","type":"PRIMARY","coverage":"Perda, Pergub DKI Jakarta"},
    {"source_id":"SRC_005","name":"JDIH Jawa Timur","url":"https://jdih.jatimprov.go.id/","type":"PRIMARY","coverage":"Perda, Pergub Jawa Timur"},
    {"source_id":"SRC_006","name":"JDIH Jawa Barat","url":"https://jdih.jabarprov.go.id/","type":"PRIMARY","coverage":"Perda, Pergub Jawa Barat"},
    {"source_id":"SRC_007","name":"JDIH Kemenkumham","url":"https://jdih.kemenkumham.go.id/","type":"PRIMARY","coverage":"UU, PP"},
]

# ==============================================================
# 11 — LOCAL REGULATIONS
# ==============================================================
LOCAL_REGULATIONS = [
    {"id":"LOCAL_DKI_001","type":"PERGUB","number":"117","year":2017,"province":"DKI Jakarta","city":None,
     "title":"Pembatasan Lalu Lintas Kendaraan Angkutan Barang di DKI Jakarta",
     "issuer":"Gubernur DKI Jakarta","status":"DIUBAH","amended_by":"Pergub DKI No. 83/2020",
     "key_provisions":["Kendaraan angkutan barang JBI > 8 ton dilarang pada jam tertentu di ruas tertentu"],
     "official_urls":["https://jdih.jakarta.go.id/"],"verification_required":True},
    {"id":"LOCAL_DKI_002","type":"PERGUB","number":"83","year":2020,"province":"DKI Jakarta","city":None,
     "title":"Perubahan Pergub 117/2017 tentang Pembatasan Lalu Lintas Kendaraan Angkutan Barang",
     "issuer":"Gubernur DKI Jakarta","status":"BERLAKU","amended_by":None,
     "key_provisions":["Memperbarui jam dan ruas jalan yang dilarang untuk kendaraan angkutan barang"],
     "official_urls":["https://jdih.jakarta.go.id/"],"verification_required":True},
    {"id":"LOCAL_DKI_003","type":"PERDA","number":"5","year":2014,"province":"DKI Jakarta","city":None,
     "title":"Transportasi","issuer":"Pemerintah DKI Jakarta","status":"BERLAKU","amended_by":None,
     "key_provisions":["Perda transportasi DKI Jakarta termasuk angkutan barang"],
     "official_urls":["https://jdih.jakarta.go.id/"],"verification_required":True},
    {"id":"LOCAL_JATIM_001","type":"PERGUB","number":"UNKNOWN","year":2019,"province":"Jawa Timur","city":None,
     "title":"Pembatasan Kendaraan Angkutan Barang di Jawa Timur",
     "issuer":"Gubernur Jawa Timur","status":"UNKNOWN","amended_by":None,"key_provisions":[],
     "official_urls":["https://jdih.jatimprov.go.id/"],"verification_required":True},
    {"id":"LOCAL_JABAR_001","type":"PERGUB","number":"UNKNOWN","year":2019,"province":"Jawa Barat","city":None,
     "title":"Pembatasan Kendaraan Angkutan Barang di Jawa Barat",
     "issuer":"Gubernur Jawa Barat","status":"UNKNOWN","amended_by":None,"key_provisions":[],
     "official_urls":["https://jdih.jabarprov.go.id/"],"verification_required":True},
    {"id":"LOCAL_BANTEN_001","type":"PERGUB","number":"UNKNOWN","year":2019,"province":"Banten","city":None,
     "title":"Pembatasan Kendaraan Angkutan Barang di Banten",
     "issuer":"Gubernur Banten","status":"UNKNOWN","amended_by":None,"key_provisions":[],
     "official_urls":["https://jdih.bantenprov.go.id/"],"verification_required":True},
    {"id":"LOCAL_SUMUT_001","type":"PERGUB","number":"UNKNOWN","year":2020,"province":"Sumatera Utara","city":None,
     "title":"Pembatasan Kendaraan Angkutan Barang di Sumatera Utara",
     "issuer":"Gubernur Sumatera Utara","status":"UNKNOWN","amended_by":None,"key_provisions":[],
     "official_urls":["https://jdih.sumutprov.go.id/"],"verification_required":True},
    {"id":"LOCAL_KALTIM_001","type":"PERGUB","number":"UNKNOWN","year":2019,"province":"Kalimantan Timur","city":None,
     "title":"Pembatasan Kendaraan Angkutan/Tambang di Kalimantan Timur",
     "issuer":"Gubernur Kalimantan Timur","status":"UNKNOWN","amended_by":None,"key_provisions":[],
     "official_urls":["https://jdih.kaltimprov.go.id/"],"verification_required":True},
    {"id":"LOCAL_SULSEL_001","type":"PERGUB","number":"UNKNOWN","year":2020,"province":"Sulawesi Selatan","city":None,
     "title":"Pembatasan Kendaraan Angkutan Barang di Sulawesi Selatan",
     "issuer":"Gubernur Sulawesi Selatan","status":"UNKNOWN","amended_by":None,"key_provisions":[],
     "official_urls":["https://jdih.sulselprov.go.id/"],"verification_required":True},
    {"id":"LOCAL_LAMPUNG_001","type":"PERGUB","number":"UNKNOWN","year":2020,"province":"Lampung","city":None,
     "title":"Pembatasan Kendaraan Angkutan Barang di Lampung",
     "issuer":"Gubernur Lampung","status":"UNKNOWN","amended_by":None,"key_provisions":[],
     "official_urls":["https://jdih.lampungprov.go.id/"],"verification_required":True},
    {"id":"LOCAL_SUMSEL_001","type":"PERGUB","number":"UNKNOWN","year":2020,"province":"Sumatera Selatan","city":None,
     "title":"Pembatasan Kendaraan Angkutan Barang di Sumatera Selatan",
     "issuer":"Gubernur Sumatera Selatan","status":"UNKNOWN","amended_by":None,"key_provisions":[],
     "official_urls":["https://jdih.sumselprov.go.id/"],"verification_required":True},
    {"id":"LOCAL_RIAU_001","type":"PERGUB","number":"UNKNOWN","year":2020,"province":"Riau","city":None,
     "title":"Pembatasan Kendaraan Angkutan Barang di Riau",
     "issuer":"Gubernur Riau","status":"UNKNOWN","amended_by":None,"key_provisions":[],
     "official_urls":["https://jdih.riauprovinsi.go.id/"],"verification_required":True},
    {"id":"LOCAL_JATENG_001","type":"PERGUB","number":"UNKNOWN","year":2019,"province":"Jawa Tengah","city":None,
     "title":"Pembatasan Kendaraan Angkutan Barang di Jawa Tengah",
     "issuer":"Gubernur Jawa Tengah","status":"UNKNOWN","amended_by":None,"key_provisions":[],
     "official_urls":["https://jdih.jatengprov.go.id/"],"verification_required":True},
]

# ==============================================================
# CONFLICTS
# ==============================================================
CONFLICTS = [
    {
        "conflict_id":"CONF_001",
        "rule_a":"THR_006 — PP 55/2012 Pasal 7(3): tinggi maks 4.200 mm (umum)",
        "rule_b":"THR_007 — UU 22/2009 Pasal 22: tinggi maks 3.500 mm (Kelas III)",
        "conflict_type":"CONDITIONAL_OVERRIDE",
        "possible_reason":"Bukan konflik nyata. UU 22/2009 Pasal 22 adalah lex specialis untuk Kelas III.",
        "resolution":"APPLY_STRICTER_RULE_FOR_CLASS_III",
        "notes":"Di Kelas III gunakan 3.500 mm; di kelas lain gunakan 4.200 mm."
    },
    {
        "conflict_id":"CONF_002",
        "rule_a":"THR_001 — PP 55/2012: lebar maks 2.500 mm (umum)",
        "rule_b":"THR_002 — UU 22/2009 Pasal 22: lebar maks 2.100 mm (Kelas III)",
        "conflict_type":"CONDITIONAL_OVERRIDE",
        "possible_reason":"UU 22/2009 Pasal 22 adalah lex specialis untuk Kelas III.",
        "resolution":"APPLY_STRICTER_RULE_FOR_CLASS_III",
        "notes":"Di Kelas III gunakan 2.100 mm; di kelas lain gunakan 2.500 mm."
    },
    {
        "conflict_id":"CONF_003",
        "rule_a":"THR_018 — PM 18/2021 Pasal 5: toleransi 5% dari JBI di jembatan timbang",
        "rule_b":"RULE_012 — UU 22/2009 Pasal 169: dilarang melebihi JBI",
        "conflict_type":"APPARENT_CONFLICT",
        "possible_reason":"Toleransi 5% adalah toleransi teknis alat ukur, bukan allowance hukum tambahan.",
        "resolution":"REQUIRES_LEGAL_REVIEW",
        "notes":"VETO HARUS menggunakan JBI sebagai batas keras. Toleransi 5% TIDAK boleh ditambahkan ke JBI. Perlu konfirmasi dari teks resmi PM 18/2021."
    },
]

# ==============================================================
# SAVE ALL FILES
# ==============================================================
log("=== VETO Regulatory Corpus Builder — START ===")
save_json(REGULATIONS,      "01_regulations.json")
save_json(RELATIONSHIPS,    "02_regulation_relationships.json")
save_json(ARTICLES,         "03_articles.json")
save_json(RULES,            "04_rules.json")
save_json(THRESHOLDS,       "05_numeric_thresholds.json")
save_json(VEHICLE_RULES,    "06_vehicle_rules.json")
save_json(CARGO_RULES,      "07_cargo_rules.json")
save_json(ROAD_RULES,       "08_road_rules.json")
save_json(SANCTIONS,        "09_violation_sanctions.json")
save_json(SOURCES,          "10_sources.json")
save_json(LOCAL_REGULATIONS,"11_local_regulations.json")
save_json(CONFLICTS,        "conflicts.json")

SCRAPE_LOG.append({"timestamp": datetime.datetime.now().isoformat(), "level": "INFO", "message": "Pipeline complete"})
save_json(SCRAPE_LOG, "12_scrape_log.json")

# ==============================================================
# COVERAGE REPORT
# ==============================================================
def count_status(lst, s): return sum(1 for r in lst if r.get("status") == s)
def need_verify(lst):     return sum(1 for r in lst if r.get("verification_required", False))

report = f"""# VETO Regulatory Corpus — Coverage Report
Generated: {datetime.datetime.now().isoformat()}

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total regulations discovered | {len(REGULATIONS)} |
| Active (BERLAKU) | {count_status(REGULATIONS, "BERLAKU")} |
| Revoked (DICABUT) | {count_status(REGULATIONS, "DICABUT")} |
| Amended (DIUBAH) | {count_status(REGULATIONS, "DIUBAH")} |
| Unknown status | {count_status(REGULATIONS, "UNKNOWN")} |
| Articles extracted | {len(ARTICLES)} |
| Structured rules | {len(RULES)} |
| Numeric thresholds | {len(THRESHOLDS)} |
| Sanctions documented | {len(SANCTIONS)} |
| Vehicle rules | {len(VEHICLE_RULES)} |
| Cargo rules | {len(CARGO_RULES)} |
| Road rules (national) | {sum(1 for r in ROAD_RULES if "DKI" not in r["rule_id"])} |
| Road rules (local) | {sum(1 for r in ROAD_RULES if "DKI" in r["rule_id"])} |
| Local regulations | {len(LOCAL_REGULATIONS)} |
| Regulation relationships | {len(RELATIONSHIPS)} |
| Regulations needing verification | {need_verify(REGULATIONS)} |
| Detected conflicts | {len(CONFLICTS)} |
| Unresolved conflicts (legal review) | {sum(1 for c in CONFLICTS if c["resolution"] == "REQUIRES_LEGAL_REVIEW")} |

## Regulation Type Breakdown

| Type | Count | Active | Revoked |
|------|-------|--------|---------|
"""
types = {}
for r in REGULATIONS:
    t = r["type"]
    types.setdefault(t, {"total": 0, "active": 0, "revoked": 0})
    types[t]["total"] += 1
    if r["status"] == "BERLAKU": types[t]["active"] += 1
    if r["status"] == "DICABUT": types[t]["revoked"] += 1

for t, d in sorted(types.items()):
    report += f"| {t} | {d['total']} | {d['active']} | {d['revoked']} |\n"

report += """
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
"""

with open(os.path.join(OUTPUT_DIR, "coverage_report.md"), "w", encoding="utf-8") as f:
    f.write(report)
log("Saved coverage_report.md")

# MISSING REGULATIONS
missing = """# VETO — Known Gaps / Missing Regulations

## CRITICAL GAPS

### 1. PP No. 55/2012 — Full JBI Lampiran
The annexes contain definitive JBI tables by axle configuration.
Action: Download PDF from https://peraturan.bpk.go.id/Details/5307

### 2. PM No. 60/2019 — Full Text
Complete article text needed for cargo loading rules.
Action: Download from https://jdih.kemenhub.go.id/

### 3. PM No. 18/2021 — 5% Tolerance Clause
Exact text needed to confirm tolerance interpretation.
Action: Confirm from official PDF.

### 4. 2024–2026 ODOL Regulations
Zero ODOL 2027 may have triggered new Permenhub, SE, or Inpres.
Action: Search JDIH Kemenhub for 2024–2026 regulations.

### 5. Perdirjen Technical Regulations
WIM, jembatan timbang operations, enforcement procedures.
Action: Search JDIH Kemenhub for SK/Perdirjen/Juknis.

### 6. Provincial Regulations (12 provinces — all UNKNOWN)
Jawa Tengah, Jawa Timur, Jawa Barat, Banten, Sumatera Utara,
Sumatera Selatan, Lampung, Riau, Kalimantan Timur, Sulawesi Selatan,
DI Yogyakarta, Kepulauan Riau.

### 7. City/Regency Key Logistics Hubs
Surabaya, Medan, Semarang, Cikarang/Bekasi, Karawang.

### 8. Korlantas Polri Enforcement Regulations
Police regulations for weighbridge and road enforcement procedures.

### 9. Kementerian PUPR — Bridge/Road Load Regulations
PUPR regulations on road load capacity and oversized transport permits.

### 10. Presidential Instructions on Zero ODOL 2027
Any Inpres or Keppres directing Zero ODOL 2027 implementation.
"""

with open(os.path.join(OUTPUT_DIR, "MISSING_REGULATIONS.md"), "w", encoding="utf-8") as f:
    f.write(missing)
log("Saved MISSING_REGULATIONS.md")

# ==============================================================
# PRINT FINAL SUMMARY
# ==============================================================
print()
print("=" * 62)
print("  VETO REGULATORY CORPUS — FINAL SUMMARY")
print("=" * 62)
print(f"  1.  Total regulations discovered:    {len(REGULATIONS):>4}")
print(f"  2.  Active (BERLAKU):                {count_status(REGULATIONS,'BERLAKU'):>4}")
print(f"  3.  Revoked (DICABUT):               {count_status(REGULATIONS,'DICABUT'):>4}")
print(f"  4.  Amended (DIUBAH):                {count_status(REGULATIONS,'DIUBAH'):>4}")
print(f"  5.  Unknown status (UNKNOWN):        {count_status(REGULATIONS,'UNKNOWN'):>4}")
print(f"  6.  Relevant articles extracted:     {len(ARTICLES):>4}")
print(f"  7.  Structured compliance rules:     {len(RULES):>4}")
print(f"  8.  Numeric thresholds:              {len(THRESHOLDS):>4}")
print(f"  9.  Sanctions documented:            {len(SANCTIONS):>4}")
print(f"  10. Vehicle rules:                   {len(VEHICLE_RULES):>4}")
print(f"  11. Cargo rules:                     {len(CARGO_RULES):>4}")
print(f"  12. Road rules:                      {len(ROAD_RULES):>4}")
print(f"  13. Local regulations:               {len(LOCAL_REGULATIONS):>4}")
print(f"  14. Regulation relationships:        {len(RELATIONSHIPS):>4}")
print(f"  15. Needing verification:            {need_verify(REGULATIONS):>4}")
print(f"  16. Unresolved conflicts:            {sum(1 for c in CONFLICTS if c['resolution']=='REQUIRES_LEGAL_REVIEW'):>4}")
print("=" * 62)
print()

TOP20 = [
    ("UU_22_2009",       "KRITIS", "UU induk LLAJ. Pasal 19-22 kelas jalan+MST, Pasal 169 larangan muatan lebih, Pasal 307 sanksi."),
    ("PP_55_2012",       "KRITIS", "PP kendaraan. Dimensi maks, JBI/MST, lampiran tabel JBI per konfigurasi sumbu."),
    ("PERMENHUB_18_2021","KRITIS", "Permenhub penimbangan. MST per kelas jalan, WIM, normalisasi muatan lebih."),
    ("PERMENHUB_60_2019","KRITIS", "Permenhub angkutan barang. Tata cara operasional, daya angkut, rute, izin."),
    ("PP_74_2014",       "TINGGI", "PP angkutan jalan. Perizinan dan ketentuan operasional angkutan barang."),
    ("PP_34_2006",       "TINGGI", "PP jalan. Kelas jalan I/II/III dan batas MST per kelas."),
    ("PERMENHUB_19_2021","TINGGI", "Uji berkala 6 bulan. Kendaraan tanpa sertifikat valid = tidak laik jalan."),
    ("PERMENHUB_23_2021","TINGGI", "Uji tipe dan modifikasi. Perubahan dimensi/berat butuh sertifikat uji tipe baru."),
    ("PP_80_2012",       "TINGGI", "Tata cara pemeriksaan di jalan dan penindakan. Dasar hukum jembatan timbang."),
    ("SE_MENHUB_21_2019","TINGGI", "SE khusus ODOL. Dasar operasional pengawasan muatan lebih dan ukuran lebih."),
    ("PP_79_2013",       "SEDANG", "Jaringan LLAJ. Kapasitas daya dukung jalan dan jaringan angkutan."),
    ("PP_30_2021",       "SEDANG", "PP penyelenggaraan LLAJ terbaru. Standar pelayanan dan perizinan."),
    ("PERMENHUB_25_2021","SEDANG", "Penyelenggaraan angkutan jalan. Perizinan dan pengawasan angkutan barang."),
    ("UU_38_2004",       "SEDANG", "UU Jalan. Definisi kelas jalan dan daya dukung."),
    ("UU_2_2022",        "SEDANG", "Perubahan UU Jalan. Memperbarui ketentuan kelas jalan."),
    ("PERDIRJEN_PD_004_2022","SEDANG","Petunjuk teknis WIM dan penimbangan bergerak."),
    ("PERMENHUB_47_2021","SEDANG", "Alat penimbangan bergerak (mobile weighing unit)."),
    ("PERGUB_DKI_83_2020","SEDANG","Pembatasan angkutan barang DKI Jakarta (aktif). Relevan rute melalui Jakarta."),
    ("PP_15_2005",       "RENDAH", "Jalan tol. Pembatasan kendaraan berat di jalan tol."),
    ("PERMENHUB_1_2015", "RENDAH", "Angkutan barang berbahaya (B3/Hazmat). Status perlu verifikasi."),
]

print("  TOP 20 MOST IMPORTANT REGULATIONS FOR VETO")
print("-" * 62)
for i, (rid, priority, reason) in enumerate(TOP20, 1):
    reg = next((r for r in REGULATIONS if r["id"] == rid), {})
    art_count = sum(1 for a in ARTICLES if a.get("regulation_id") == rid)
    url = reg.get("official_urls", ["N/A"])[0] if reg.get("official_urls") else "N/A"
    print(f"  {i:2d}. [{priority}] {reg.get('type','')} No. {reg.get('number','')} Tahun {reg.get('year','')}")
    print(f"      {reg.get('title','')[:55]}")
    print(f"      Status: {reg.get('status','?')} | Articles extracted: {art_count}")
    print(f"      {reason[:68]}")
    print(f"      {url[:68]}")
    print()

print(f"  Output directory: {OUTPUT_DIR}")
print(f"  Files saved: 14 (01–12 + conflicts + coverage + missing)")
print("=" * 62)
