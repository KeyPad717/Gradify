const SESSION_MARKER = 'gradify_logged_in'

// In-memory token store — never persisted to localStorage (XSS-safe).
// The access token and refresh token live only for the lifetime of the
// page session. On a hard refresh they are lost and the user must re-login.
// Known limitation: silent re-authentication on page reload requires an
// httpOnly cookie-based refresh token flow, which is out of scope here.
let _accessToken = null
let _refreshToken = null
let _expiresAt = null
let _user = null
let _role = null

/** ~1 min before JWT expiry we treat session as ended (clock skew / margin). */
const EXPIRY_MARGIN_MS = 60_000

export function saveSession(body) {
  if (!body || typeof body !== 'object') return

  const { access_token, refresh_token, expires_in, user, role } = body

  if (access_token) {
    _accessToken = access_token
    const seconds = typeof expires_in === 'number' ? expires_in : 3600
    _expiresAt = Date.now() + seconds * 1000
  }
  if (refresh_token) _refreshToken = refresh_token

  if (user !== undefined && user !== null) {
    _user = user
  }
  if (role) {
    _role = role
  }

  localStorage.setItem(SESSION_MARKER, 'true')
}

export function getUserRole() {
  return _role
}

/** Clears everything written by `saveSession` (tokens + expiry + user). */
export function clearSession() {
  _accessToken = null
  _refreshToken = null
  _expiresAt = null
  _user = null
  _role = null
  localStorage.removeItem(SESSION_MARKER)
}

export function getAccessToken() {
  return _accessToken
}

export function getStoredUser() {
  return _user
}

export function isAuthenticated() {
  if (!_accessToken || !_expiresAt) return false
  return Date.now() < _expiresAt - EXPIRY_MARGIN_MS
}
