import axios from 'axios'

/**
 * Axios instance for the VETO API.
 *
 * Base URL is relative so the Vite dev proxy handles it in development and the
 * deployed origin handles it in production. Override with VITE_API_BASE_URL when
 * pointing a local frontend at a deployed backend.
 */
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  // Render's free plan sleeps after ~15 minutes and takes around 50 seconds to
  // wake — a cold start was measured at 41.7s. The old 15s ceiling turned that
  // wait into a failure, and with mock mode gone there is nothing behind it:
  // the dispatch call errors and GET /rules fails silently, leaving the form
  // without its ceilings. A cron keeps the service awake, so this is the second
  // line rather than the first. Slow is recoverable; failed is not.
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

/**
 * Normalises an axios failure into the contract's error envelope.
 * See api-contract.md §0.
 */
export class ApiError extends Error {
  constructor({ code, message, field, status }) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.field = field
    this.status = status
  }

  static from(error) {
    const status = error.response?.status
    const envelope = error.response?.data?.error

    if (envelope) {
      return new ApiError({ ...envelope, status })
    }
    if (error.code === 'ECONNABORTED') {
      return new ApiError({
        code: 'UPSTREAM_TIMEOUT',
        message: 'The request timed out.',
        status: 504,
      })
    }
    if (!error.response) {
      return new ApiError({
        code: 'NETWORK_ERROR',
        message: 'Could not reach the VETO API.',
        status: 0,
      })
    }
    return new ApiError({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong.',
      status,
    })
  }
}
