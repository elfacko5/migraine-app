import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'

// About's "build N": the commit count at build time — real, and it rises with
// every build that ships something new. Null when git isn't there (a tarball
// build), and About then shows the version alone rather than a made-up number.
function buildNumber(): string | null {
  try {
    return execSync('git rev-list --count HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null
  } catch {
    return null
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __APP_BUILD__: JSON.stringify(buildNumber()) },
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
