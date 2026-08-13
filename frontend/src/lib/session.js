/**
 * When this browsing session started.
 *
 * The audit trail is append-only and shared: every decision anyone has ever run
 * against this backend is in it. At a booth that meant a visitor opened /audit
 * and read fifty records belonging to strangers, which reads as fake seed data
 * rather than as their own trail.
 *
 * So the trail is *scoped*, never trimmed. This timestamp becomes the `from`
 * filter the API already supports, so the server does the filtering and the
 * totals on screen stay server-computed. Nothing is deleted, and the
 * "Semua catatan" toggle on /audit proves it.
 *
 * sessionStorage rather than localStorage: a session should end when the tab
 * does. `resetSession` exists because at a booth the tab never closes and the
 * operator needs to hand a clean screen to the next visitor.
 */

const KEY = 'veto.session_start'

/** Used when sessionStorage is unavailable (private mode, blocked storage). */
let fallback = null

function read() {
  try {
    return window.sessionStorage.getItem(KEY)
  } catch {
    return fallback
  }
}

function write(value) {
  try {
    window.sessionStorage.setItem(KEY, value)
  } catch {
    // Storage refused. Holding it in memory still scopes the trail correctly
    // for as long as the page lives, which is the whole demo.
    fallback = value
  }
  return value
}

/** ISO timestamp of this session's start, created on first read. */
export function sessionStart() {
  return read() ?? write(new Date().toISOString())
}

/** Begins a new session now. Returns the new timestamp. */
export function resetSession() {
  return write(new Date().toISOString())
}

/**
 * A date from `<input type="date">` as an absolute instant.
 *
 * The input yields a bare `2026-08-13`, and Django's `parse_datetime` returns
 * None for that — which is why the Dari/Sampai filters silently did nothing:
 * the backend skipped the filter and returned the unfiltered trail. Building a
 * real Date from local midnight and serialising it also carries the offset, so
 * the server never receives a naive datetime.
 */
export function dayBoundary(date, edge) {
  if (!date) return null
  const at = new Date(`${date}T${edge === 'end' ? '23:59:59.999' : '00:00:00.000'}`)
  return Number.isNaN(at.getTime()) ? null : at.toISOString()
}

/** The later of two ISO instants, ignoring nulls. */
export function latest(a, b) {
  if (!a) return b
  if (!b) return a
  return new Date(a) >= new Date(b) ? a : b
}
