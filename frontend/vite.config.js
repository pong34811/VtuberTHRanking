import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // ponytail: dev ยิง /api/v1 ผ่าน proxy ไป production ตรงๆ ไม่ต้องรัน backend เอง
    proxy: { '/api': 'https://vtuberthai-ranking.pages.dev' },
  },
})
