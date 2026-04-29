import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/proxy-club': {
        target: 'https://tmssl.akamaized.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy-club/, '/images/wappen/head'),
      },
      '/proxy-player': {
        target: 'https://img.a.transfermarkt.technology',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy-player/, '/portrait/header'),
      },
      '/proxy-flag': {
        target: 'https://flagcdn.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy-flag/, ''),
      },
    },
  },
})
