import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// API calls use VITE_API_GATEWAY_URL (see src/api/client.js) so the browser hits the Go gateway
// directly — no dev-server proxy that could mask a stopped gateway.
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
