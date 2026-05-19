import { useNavigate } from 'react-router-dom'
import { clearSession, getStoredUser } from '../auth/authStorage'

function AdminHomePage() {
  const navigate = useNavigate()
  const user = getStoredUser()

  const handleLogout = () => {
    clearSession()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 px-4 text-zinc-100">
      <h1 className="text-3xl font-semibold">Homepage</h1>
      {user?.email && (
        <p className="text-sm text-zinc-400">Signed in as {user.email}</p>
      )}
      <button
        type="button"
        onClick={handleLogout}
        className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900"
      >
        Log out
      </button>
    </div>
  )
}

export default AdminHomePage
