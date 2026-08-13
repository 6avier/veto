import Dialog from '@/components/Dialog'
import PrintableWaybill from '@/components/dispatch/PrintableWaybill'

/**
 * The surat jalan, on screen before it is on paper.
 *
 * Its body is the same PrintableWaybill the print stylesheet renders, not a
 * second copy of it. This repo has twice shipped two copies of one fact and
 * watched them drift; a preview that can disagree with the document it previews
 * is worse than no preview.
 *
 * The verdict-gated print:block in Dispatch is untouched. This dialog only adds
 * a way to *see* the document — what reaches paper is still gated on PASS.
 */
export default function WaybillDialog({ form, onClose, onBack }) {
  return (
    <Dialog
      open
      onClose={onClose}
      title="Pratinjau Surat Jalan"
      maxWidth="880px"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onBack ?? onClose}
            className="min-h-[44px] rounded-veto border border-ink-200 px-4 py-2 text-label text-ink-700 transition-colors hover:bg-ink-50"
          >
            Kembali
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-[44px] rounded-veto bg-ink-900 px-4 py-2 text-label text-white transition-colors hover:bg-ink-950"
          >
            Cetak
          </button>
        </div>
      }
    >
      {/*
        The document is laid out in millimetres for A4 and does not reflow, so
        on a narrow screen it scrolls sideways inside its own box rather than
        being squeezed into something that is no longer the document.
      */}
      <div className="overflow-x-auto bg-ink-50 p-4">
        <div className="mx-auto w-[210mm] min-w-[210mm] bg-white shadow-[0_1px_3px_rgba(20,23,26,0.18)]">
          <PrintableWaybill form={form} />
        </div>
      </div>
    </Dialog>
  )
}
