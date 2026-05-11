import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { isAuthenticated, saveSession } from './authStorage'

function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const response = await api.post('/api/auth/login', { email, password })

      const body = response.data
      console.log('Login — full response:', body)
      if (body && typeof body === 'object') {
        console.log('Login — access_token:', body.access_token)
        console.log('Login — refresh_token:', body.refresh_token)
        console.log('Login — expires_in:', body.expires_in)
        console.log('Login — token_type:', body.token_type)
        console.log('Login — user:', body.user)
        console.log('Login — role:', body.role)
        console.log('Login — debug_version:', body.debug_version)
      }

      saveSession(body)
      if (!isAuthenticated()) {
        setMessage(
          body?.error ||
            body?.message ||
            'Login failed: no access token from server. Is the API gateway running?'
        )
        return
      }

      const role = (body.role || '').toUpperCase()
      if (role === 'ADMIN') {
        navigate('/admin-service')
      } else if (role === 'PROFESSOR') {
        navigate('/professor')
      } else if (role === 'STUDENT') {
        navigate('/student')
      } else {
        navigate('/')
      }
    } catch (error) {
      setMessage(
        error.response?.data?.error ||
          error.response?.data?.message ||
          'Unable to reach server'
      )
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <div className="mb-6 text-center">
        <div className="mx-auto inline-flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/40 px-5 py-2.5 shadow-2xl shadow-black/30">
          <span className="bg-gradient-to-r from-white via-zinc-200 to-white bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
            Gradify
          </span>
        </div>
      </div>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl shadow-black/40"
      >
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Sign In</h1>
        </div>

        <div className="mb-4">
          <label htmlFor="email" className="mb-2 block text-sm text-zinc-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30"
            placeholder="you@example.com"
          />
        </div>

        <div className="mb-6">
          <label htmlFor="password" className="mb-2 block text-sm text-zinc-300">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30"
            placeholder="Enter your password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-zinc-200 px-4 py-2.5 font-medium text-zinc-900 transition hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? 'Submitting...' : 'Submit'}
        </button>

        {message && (
          <p className="mt-4 text-sm text-zinc-300" role="status">
            {message}
          </p>
        )}
      </form>
    </div>
  )
}

export default Login
