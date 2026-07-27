import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// Mock the api/client module
vi.mock('../api/client', () => ({
  api: {
    post: vi.fn(),
  },
}))

// Mock authStorage
vi.mock('../pages/auth/authStorage', () => ({
  saveSession: vi.fn(),
  isAuthenticated: vi.fn(() => false),
  getStoredUser: vi.fn(() => null),
  clearSession: vi.fn(),
}))

describe('Login Page', () => {
  it('should render login form', async () => {
    const Login = (await import('../pages/auth/login')).default

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
  })

  it('should show error on failed login', async () => {
    const { api } = await import('../api/client')
    api.post.mockRejectedValueOnce({
      response: { data: { error: 'Invalid credentials' } },
    })

    const Login = (await import('../pages/auth/login')).default
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    await user.type(screen.getByLabelText('Email'), 'test@test.com')
    await user.type(screen.getByLabelText('Password'), 'wrongpass')
    await user.click(screen.getByRole('button', { name: /submit/i }))

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument()
  })

  it('should handle network error', async () => {
    const { api } = await import('../api/client')
    api.post.mockRejectedValueOnce(new Error('Network Error'))

    const Login = (await import('../pages/auth/login')).default
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    await user.type(screen.getByLabelText('Email'), 'test@test.com')
    await user.type(screen.getByLabelText('Password'), 'pass123')
    await user.click(screen.getByRole('button', { name: /submit/i }))

    expect(await screen.findByText('Unable to reach server')).toBeInTheDocument()
  })
})