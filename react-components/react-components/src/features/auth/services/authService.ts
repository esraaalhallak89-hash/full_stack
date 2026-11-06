/**
 * authService
 *
 * Authentication requests against the real Laravel backend.
 *
 * Endpoints used:
 *   POST /auth/login     { email, password }
 *   POST /auth/register  { name, email, password }
 *   GET  /users/me       (Bearer token required)
 *
 * API response envelope:
 *   login / register → { data: { access_token, token_type, user: { id, name, email, role } } }
 *   /users/me        → { data: { id, name, email, role } }
 *
 * Laravel 422 validation errors are surfaced through ApiError.errors so
 * pages can display per-field messages.
 */

import { apiClient } from '@/shared/lib/apiClient'
import type {
  AuthTokenResponse,
  ApiAuthResponse,
  ApiMeResponse,
  ApiUserData,
  LoginPayload,
  RegisterPayload,
} from '../types/auth.types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toAuthTokenResponse(data: ApiAuthResponse['data']): AuthTokenResponse {
  return {
    token: data.access_token,
    token_type: 'Bearer',
    user: toAuthUser(data.user),
  }
}

function toAuthUser(u: ApiUserData) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * POST /auth/login
 * Throws an ApiError on failure (401 = invalid credentials, 422 = validation).
 */
async function login(payload: LoginPayload): Promise<AuthTokenResponse> {
  const response = await apiClient.post<ApiAuthResponse>('/auth/login', {
    email: payload.email,
    password: payload.password,
  })
  return toAuthTokenResponse(response.data)
}

/**
 * POST /auth/register
 * Sends { name, email, password }.
 * Throws an ApiError on failure (422 = validation errors).
 */
async function register(payload: RegisterPayload): Promise<AuthTokenResponse> {
  const response = await apiClient.post<ApiAuthResponse>('/auth/register', {
    name: payload.username,
    email: payload.email,
    password: payload.password,
  })
  return toAuthTokenResponse(response.data)
}

/**
 * GET /users/me
 * Fetches the authenticated user from the backend using the stored Bearer token.
 * Called during app startup (token rehydration) and after login/register.
 * Throws ApiError with status 401 if the token is missing or expired.
 */
async function fetchMe(): Promise<AuthTokenResponse['user']> {
  const response = await apiClient.get<ApiMeResponse>('/users/me')
  return toAuthUser(response.data)
}

/**
 * Best-effort server-side logout. Client session is cleared regardless.
 */
async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout')
  } catch {
    /* ignore — client-side session is cleared regardless */
  }
}

export const authService = { login, register, fetchMe, logout } as const
