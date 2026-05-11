import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../../api/client'

const ROLES = ['STUDENT', 'PROFESSOR']

function CreateUserDetails() {
  const location = useLocation()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [role, setRole] = useState('STUDENT')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const credentials = useMemo(
    () => ({
      email: location.state?.email || '',
      userId: location.state?.userId || '',
    }),
    [location.state]
  )

  const hasCredentials = credentials.email

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!hasCredentials) {
      setMessage('Missing created user details. Please start from step 1.')
      return
    }

    setLoading(true)
    setMessage('')
    try {
      await api.post('/api/admin/users/profile', {
        email: credentials.email,
        userId: credentials.userId,
        name,
        role,
      })
      setMessage('User created successfully')
      setTimeout(() => navigate('/admin-service', { replace: true }), 600)
    } catch (error) {
      const details = error.response?.data?.details
      let parsedDetails = details
      if (typeof details === 'string') {
        try {
          const json = JSON.parse(details)
          parsedDetails = json?.msg || json?.message || details
        } catch {
          parsedDetails = details
        }
      }
      setMessage(
        parsedDetails ||
          error.response?.data?.message ||
          error.response?.data?.error ||
          'Unable to create user'
      )
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mb-6 w-full max-w-md">
        <Link
          to="/admin-service/create-user"
          className="text-sm text-zinc-400 transition hover:text-zinc-200"
        >
          ← Back to step 1
        </Link>
      </div>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl shadow-black/40"
      >
        <h1 className="mb-2 text-center text-2xl font-semibold tracking-tight">
          Create user
        </h1>
        <p className="mb-6 text-center text-sm text-zinc-400">
          Step 2 of 2: Set profile details
        </p>

        <div className="mb-4 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-300">
          <p className="truncate">Email: {credentials.email || 'Not provided'}</p>
        </div>

        <div className="mb-4">
          <label htmlFor="admin-create-name" className="mb-2 block text-sm text-zinc-300">
            Name
          </label>
          <input
            id="admin-create-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30"
            placeholder="Full name"
          />
        </div>

        <div className="mb-6">
          <label htmlFor="admin-create-role" className="mb-2 block text-sm text-zinc-300">
            Role
          </label>
          <select
            id="admin-create-role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30"
          >
            {ROLES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading || !hasCredentials}
          className="w-full rounded-lg bg-zinc-200 px-4 py-2.5 font-medium text-zinc-900 transition hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? 'Creating…' : 'Create user'}
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

export default CreateUserDetails
