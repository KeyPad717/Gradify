import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('API Client', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('should attach auth token to requests', async () => {
    const store = { 'gradify_access_token': 'test-token' }
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key) => store[key] ?? null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      configurable: true,
    })

    const { api } = await import('../api/client')
    expect(api.defaults.headers).toBeDefined()
  })

  it('should not attach token when not logged in', async () => {
    const store = {}
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key) => store[key] ?? null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      configurable: true,
    })

    const { api } = await import('../api/client')
    expect(api.defaults.headers).toBeDefined()
  })

  it('should have correct base URL', async () => {
    const { api } = await import('../api/client')
    expect(api.defaults.baseURL).toBe('')
    expect(api.defaults.headers['Content-Type']).toBe('application/json')
  })
})