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
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'

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

/** Simulates network latency so mocked loading states look real. */
export const delay = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms))
