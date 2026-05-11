import { Navigate } from 'react-router-dom'
import { getUserRole, isAuthenticated } from '../pages/auth/authStorage'

export function GuestOnly({ children }) {
  // Only redirect to dashboard if they are authenticated AND have a role
  if (isAuthenticated() && getUserRole()) return <Navigate to="/" replace />
  return children
}
