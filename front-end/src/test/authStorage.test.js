import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('authStorage', () => {
  beforeEach(async () => {
    const { clearSession } = await import('../pages/auth/authStorage')
    clearSession()
  })

  it('should save and retrieve session', async () => {
    const { saveSession, getAccessToken, getUserRole, isAuthenticated } = await import('../pages/auth/authStorage')

    const now = Date.now()
    vi.setSystemTime(now)

    saveSession({
      access_token: 'token123',
      refresh_token: 'refresh123',
      expires_in: 3600,
      user: { id: 'u1', email: 'test@test.com' },
      role: 'STUDENT',
    })

    expect(getAccessToken()).toBe('token123')
    expect(getUserRole()).toBe('STUDENT')
    expect(isAuthenticated()).toBe(true)
  })

  it('should not be authenticated if expired', async () => {
    const { saveSession, isAuthenticated } = await import('../pages/auth/authStorage')

    const now = Date.now()
    vi.setSystemTime(now)

    saveSession({
      access_token: 'token123',
      expires_in: 0.001,
      role: 'STUDENT',
    })

    // Advance time past expiry
    vi.setSystemTime(now + 2000)

    expect(isAuthenticated()).toBe(false)
  })

  it('should clear session on logout', async () => {
    const { saveSession, clearSession, getAccessToken, getUserRole } = await import('../pages/auth/authStorage')

    saveSession({
      access_token: 'token123',
      role: 'ADMIN',
    })

    clearSession()

    expect(getAccessToken()).toBeNull()
    expect(getUserRole()).toBeNull()
  })

  it('should persist only a session marker in localStorage', async () => {
    const { saveSession, clearSession } = await import('../pages/auth/authStorage')

    saveSession({
      access_token: 'token123',
      refresh_token: 'refresh123',
      expires_in: 3600,
      user: { id: 'u1' },
      role: 'STUDENT',
    })

    expect(localStorage.getItem('gradify_logged_in')).toBe('true')
    expect(localStorage.getItem('gradify_access_token')).toBeNull()
    expect(localStorage.getItem('gradify_refresh_token')).toBeNull()
    expect(localStorage.getItem('gradify_token_expires_at')).toBeNull()

    clearSession()
    expect(localStorage.getItem('gradify_logged_in')).toBeNull()
  })
})