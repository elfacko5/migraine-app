import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The design system package is linked with `file:`, so its own node_modules
  // holds a second copy of React. Two copies break hooks. Dedupe makes every
  // import resolve to this app's copy.
  resolve: { dedupe: ['react', 'react-dom'] },
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
