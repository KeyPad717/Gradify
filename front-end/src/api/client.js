import axios from 'axios'
import { getAccessToken } from '../pages/auth/authStorage'

const baseURL = (import.meta.env.VITE_API_GATEWAY_URL || '').replace(/\/$/, '')

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach auth token from in-memory store to every request
api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
