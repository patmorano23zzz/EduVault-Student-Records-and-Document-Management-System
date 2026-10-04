import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite' 

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash]-deploy2.js',
        chunkFileNames: 'assets/[name]-[hash]-deploy2.js',
        assetFileNames: 'assets/[name]-[hash]-deploy2[extname]',
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost',
        changeOrigin: true,
        rewrite: path => path.replace(
          /^\/api/,
          '/file%20storage%20inventory%20management/api',
        ),
      },
    },
  },
})
