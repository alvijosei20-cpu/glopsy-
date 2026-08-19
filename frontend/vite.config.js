import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    https: {
      key: './certs/localhost-key.pem',
      cert: './certs/localhost-cert.pem',
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)/,
              priority: 20,
            },
            {
              name: 'charts',
              test: /node_modules[\\/](recharts|d3-|d3|victory|tremor)/,
              priority: 10,
            },
            {
              name: 'model-viewer',
              test: /node_modules[\\/](@google[\\/]model-viewer|three)/,
              priority: 10,
            },
            {
              name: 'icons',
              test: /node_modules[\\/](lucide-react|@remixicon)/,
              priority: 9,
            },
            {
              name: 'http',
              test: /node_modules[\\/](axios)/,
              priority: 8,
            },
            {
              name: 'vendor',
              test: /node_modules[\\/]/,
              priority: 1,
            },
          ],
        },
      },
    },
  },
})
