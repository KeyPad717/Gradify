import axios from 'axios'

const baseURL = (import.meta.env.VITE_API_GATEWAY_URL || '').replace(/\/$/, '')

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach auth token from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gradify_access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
