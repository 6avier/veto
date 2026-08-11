/**
 * rejection_reason_code -> what the compliance officer reads.
 *
 * The backend returns a category; the wording is ours. api-contract.md §4:
 * "Rejection copy lives on the frontend. No generated prose crosses the wire."
 * That is the token saving in PRODUCT.md F3a made concrete.
 */
export const REJECTION_REASONS = {
  PUBLIC_REGULATION:
    'Ini peraturan pemerintah. VETO sudah memelihara aturan nasional secara terpusat, jadi dokumen ini tidak perlu diunggah.',
  OPERATIONAL_DOC:
    'Ini dokumen operasional, bukan dokumen kebijakan. Tidak ada ketentuan muatan yang bisa diambil darinya.',
  UNREADABLE:
    'Dokumen ini hasil pindaian tanpa lapisan teks. VETO belum mendukung OCR.',
  UNRELATED:
    'Dokumen ini tidak berkaitan dengan muatan, dimensi, atau kendaraan angkutan barang.',
}

export const CLASSIFICATION_LABELS = {
  INTERNAL_POLICY: 'Kebijakan internal',
  PUBLIC_REGULATION: 'Peraturan pemerintah',
  OPERATIONAL_DOC: 'Dokumen operasional',
  UNREADABLE: 'Tidak terbaca',
  UNRELATED: 'Di luar domain',
}

export const rejectionReason = (code) =>
  REJECTION_REASONS[code] ?? 'Dokumen ini tidak dapat diproses.'

export const classificationLabel = (code) => CLASSIFICATION_LABELS[code] ?? code
