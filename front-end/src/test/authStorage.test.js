import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock localStorage before importing auth modules
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = String(value) }),
    removeItem: vi.fn((key) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('authStorage', () => {
  beforeEach(() => {
    localStorageMock.clear()
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
})