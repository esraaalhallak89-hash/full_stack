// ─── Validated environment access ────────────────────────────────────────────
// All import.meta.env reads go through this module only.
//
//   VITE_API_BASE_URL  Laravel API root, e.g. http://localhost:8000/api
//   VITE_USE_MOCK      'true' (default) → services use local in-memory demo data
//                      'false'          → services call the real backend
//
// To connect the backend: set VITE_USE_MOCK=false in .env. Nothing else changes.

const apiBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000/api'

export const env = {
  apiBaseUrl,
  useMock: (import.meta.env.VITE_USE_MOCK as string | undefined) !== 'false',
} as const

export type Env = typeof env
