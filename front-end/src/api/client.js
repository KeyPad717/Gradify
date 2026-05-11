import axios from 'axios'

/**
 * All API traffic must go to the Go API gateway (not user-service directly).
 * Do not use relative `/api` URLs — Vite's dev proxy can hide a dead gateway by forwarding elsewhere.
 */
const baseURL = (import.meta.env.VITE_API_GATEWAY_URL || '').replace(/\/$/, '')

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})
