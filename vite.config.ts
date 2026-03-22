import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: (id) => {
                // Excluir TypeORM y todos sus drivers
                return id === 'typeorm' || 
                       id.startsWith('typeorm/') ||
                       id === '@google-cloud/spanner' ||
                       id.startsWith('@google-cloud/') ||
                       ['better-sqlite3', 'mysql2', 'pg', 'mongodb'].includes(id)
              }
            }
          }
        }
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
      },
      renderer: process.env.NODE_ENV === 'test' ? undefined : {},
    }),
  ]
})