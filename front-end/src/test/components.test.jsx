import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Mock the authStorage module at the top level
vi.mock('../pages/auth/authStorage', () => ({
  isAuthenticated: vi.fn(),
  getUserRole: vi.fn(),
}))

describe('GuestOnly', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render children when not authenticated', async () => {
    const authStorage = await import('../pages/auth/authStorage')
    authStorage.isAuthenticated.mockReturnValue(false)
    authStorage.getUserRole.mockReturnValue(null)

    const { GuestOnly } = await import('../components/GuestOnly')

    render(
      <MemoryRouter>
        <GuestOnly>
          <div>Public Content</div>
        </GuestOnly>
      </MemoryRouter>
    )

    expect(screen.getByText('Public Content')).toBeInTheDocument()
  })

  it('should redirect when authenticated with role', async () => {
    const authStorage = await import('../pages/auth/authStorage')
    authStorage.isAuthenticated.mockReturnValue(true)
    authStorage.getUserRole.mockReturnValue('ADMIN')

    const { GuestOnly } = await import('../components/GuestOnly')

    render(
      <MemoryRouter>
        <GuestOnly>
          <div>Public Content</div>
        </GuestOnly>
      </MemoryRouter>
    )

    expect(screen.queryByText('Public Content')).not.toBeInTheDocument()
  })
})

describe('RequireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should redirect to login when not authenticated', async () => {
    const authStorage = await import('../pages/auth/authStorage')
    authStorage.isAuthenticated.mockReturnValue(false)

    const { RequireAuth } = await import('../components/RequireAuth')

    render(
      <MemoryRouter>
        <RequireAuth allowedRole="STUDENT">
          <div>Protected Content</div>
        </RequireAuth>
      </MemoryRouter>
    )

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('should render children when authenticated with correct role', async () => {
    const authStorage = await import('../pages/auth/authStorage')
    authStorage.isAuthenticated.mockReturnValue(true)
    authStorage.getUserRole.mockReturnValue('STUDENT')

    const { RequireAuth } = await import('../components/RequireAuth')

    render(
      <MemoryRouter>
        <RequireAuth allowedRole="STUDENT">
          <div>Protected Content</div>
        </RequireAuth>
      </MemoryRouter>
    )

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('should redirect to role page when wrong role', async () => {
    const authStorage = await import('../pages/auth/authStorage')
    authStorage.isAuthenticated.mockReturnValue(true)
    authStorage.getUserRole.mockReturnValue('STUDENT')

    const { RequireAuth } = await import('../components/RequireAuth')

    render(
      <MemoryRouter>
        <RequireAuth allowedRole="PROFESSOR">
          <div>Protected Content</div>
        </RequireAuth>
      </MemoryRouter>
    )

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})