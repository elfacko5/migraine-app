import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Respect an assigned PORT (e.g. when another session already holds 5173)
  // instead of Vite's own silent increment-and-retry, so tooling that proxies
  // to a specific reassigned port can actually reach the server.
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    // Lets the phone reach the dev server via the Mac's stable mDNS hostname
    // instead of its LAN IP, which DHCP can reassign at any time.
    allowedHosts: ['.local'],
  },
})
