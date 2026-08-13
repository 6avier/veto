import { useCallback, useEffect, useId, useRef } from 'react'

/**
 * The shell every VETO dialog is built on.
 *
 * It exists because the dispatch flow needed three dialogs and the one we had
 * was measurably broken: Tab escaped it into the form behind the scrim, closing
 * it dropped focus on <body>, the page scrolled underneath it, and on a 375px
 * viewport a tall dialog clipped off the bottom of the screen with no way to
 * reach its own buttons. Building two more on that shell would have tripled the
 * defect, so the fixes live here once.
 *
 * What it owns: the scrim, Escape, backdrop click, focus trap, focus restore,
 * scroll lock, the dialog roles, and an internal scroll region.
 * What it does not own: any content. Callers pass a header, a body and a footer.
 */

/**
 * Everything Tab can reach. Used to find the trap's two ends on each keypress
 * rather than once on mount, because a dialog's controls change — the HOLD
 * dialog's list grows with the number of violations.
 */
/**
 * The last element that genuinely held focus.
 *
 * document.activeElement is not enough to identify what opened a dialog. The
 * dispatch form disables its submit button while the request is in flight, and
 * disabling the focused element hands focus straight to <body> — so by the time
 * a verdict dialog mounts, the button that opened it has already been forgotten
 * and there is nothing to restore focus to. This remembers it.
 */
let lastFocused = null
if (typeof document !== 'undefined') {
  document.addEventListener(
    'focusin',
    (event) => {
      const target = event.target
      if (target instanceof HTMLElement && target !== document.body) lastFocused = target
    },
    true,
  )
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export default function Dialog({
  open,
  onClose,
  title,
  header,
  footer,
  labelledBy,
  maxWidth = '560px',
  children,
}) {
  const panelRef = useRef(null)
  // Captured before the dialog takes focus, so closing can hand it back to
  // whatever opened it. Without this, focus lands on <body> and a keyboard
  // user is returned to the top of the document.
  const openerRef = useRef(null)
  const generatedId = useId()
  const titleId = labelledBy ?? `veto-dialog-${generatedId}`

  // onClose is an inline arrow at every call site, so it is a new function on
  // every parent render. Reading it through a ref keeps it out of the effect's
  // dependencies. When it was a dependency, the effect tore down and set up
  // again on every render — and each setup re-captured document.activeElement
  // as "the opener", which by then was the dialog's own panel. Closing then
  // tried to restore focus to a detached node and dropped it on <body>, which
  // is the exact defect this shell exists to fix.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const focusables = useCallback(
    () =>
      Array.from(panelRef.current?.querySelectorAll(FOCUSABLE) ?? []).filter(
        (node) => node.offsetParent !== null || node === document.activeElement,
      ),
    [],
  )

  useEffect(() => {
    if (!open) return undefined

    // Captured before the panel takes focus, so the record is of who opened
    // this dialog rather than of the dialog itself.
    const active = document.activeElement
    openerRef.current =
      active instanceof HTMLElement && active !== document.body ? active : lastFocused

    // The panel itself is focused rather than its first control: a dialog that
    // opens with a button already focused reads as though it has pre-empted the
    // decision, and a screen reader announces the button instead of the verdict.
    panelRef.current?.focus()

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const nodes = focusables()
      if (nodes.length === 0) {
        // Nothing to move to, so Tab must not be allowed to leave.
        event.preventDefault()
        return
      }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement

      if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      } else if (!panelRef.current?.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = overflow
      // Guarded: the opener can have been unmounted while the dialog was up.
      if (openerRef.current?.isConnected) openerRef.current.focus()
    }
  }, [open, focusables])

  if (!open) return null

  return (
    <div
      className="veto-scrim fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ maxWidth }}
        // The panel is a column so the header and footer stay put while only
        // the body scrolls. dvh, not vh, because mobile browser chrome makes vh
        // taller than the visible viewport and the footer lands under it.
        className="veto-dialog flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-veto bg-white font-sans shadow-[0_24px_60px_rgba(20,23,26,0.28)] focus:outline-none"
      >
        {header ? (
          <div className="shrink-0 border-b border-ink-200 px-5 py-4">{header}</div>
        ) : (
          title && (
            <div className="shrink-0 border-b border-ink-200 px-5 py-4">
              <h2 id={titleId} className="text-h1 text-ink-900">
                {title}
              </h2>
            </div>
          )
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-ink-200 px-5 py-4">{footer}</div>
        )}
      </div>
    </div>
  )
}
