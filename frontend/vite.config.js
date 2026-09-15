import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // ponytail: dev ยิง /api/v1 ผ่าน proxy ไป production ตรงๆ ไม่ต้องรัน backend เอง
    proxy: {
      '/api': {
        target: 'https://vtuberthai-ranking.pages.dev',
        changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', proxyReq => {
            proxyReq.setHeader('Origin', 'https://vtuberthai-ranking.pages.dev')
            const cookie = proxyReq.getHeader('cookie')
            if (typeof cookie === 'string') proxyReq.setHeader('cookie', cookie.replace(/\bvt_admin=/g, '__Host-vt_admin='))
          })
          proxy.on('proxyRes', proxyRes => {
            const cookies = proxyRes.headers['set-cookie']
            if (!cookies) return
            proxyRes.headers['set-cookie'] = cookies.map(cookie =>
              cookie.replace(/^__Host-vt_admin=/, 'vt_admin=').replace(/;\s*Secure/gi, ''),
            )
          })
        },
      },
    },
  },
})
