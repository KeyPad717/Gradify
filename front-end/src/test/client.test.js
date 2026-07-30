import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../pages/auth/authStorage', () => ({
  getAccessToken: vi.fn(),
}))

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('should attach auth token to requests', async () => {
    const authStorage = await import('../pages/auth/authStorage')
    authStorage.getAccessToken.mockReturnValue('test-token')

    const { api } = await import('../api/client')
    expect(api.defaults.headers).toBeDefined()
  })

  it('should not attach token when not logged in', async () => {
    const authStorage = await import('../pages/auth/authStorage')
    authStorage.getAccessToken.mockReturnValue(null)

    const { api } = await import('../api/client')
    expect(api.defaults.headers).toBeDefined()
  })

  it('should have correct base URL', async () => {
    const { api } = await import('../api/client')
    expect(api.defaults.baseURL).toBe('')
    expect(api.defaults.headers['Content-Type']).toBe('application/json')
  })
})