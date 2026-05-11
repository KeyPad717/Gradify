import { Navigate } from 'react-router-dom'
import { getUserRole, isAuthenticated } from '../pages/auth/authStorage'

export function RequireAuth({ children, allowedRole }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />

  const role = (getUserRole() || '').toUpperCase()
  const required = (allowedRole || '').toUpperCase()

  if (required && role !== required) {
    if (role === 'ADMIN') return <Navigate to="/admin-service" replace />
    if (role === 'PROFESSOR') return <Navigate to="/professor" replace />
    if (role === 'STUDENT') return <Navigate to="/student" replace />
    // If authenticated but unknown/missing role, logout to clear state
    return <Navigate to="/login" replace />
  }

  return children
}
