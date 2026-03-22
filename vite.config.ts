import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  // loadEnv reads from BOTH .env files AND process.env
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  // Debug: log what loadEnv found (visible in Cloudflare build log)
  console.log('[vite.config] VITE_SUPABASE_URL:', env.VITE_SUPABASE_URL ? 'found (' + env.VITE_SUPABASE_URL.substring(0, 15) + '...)' : 'MISSING')
  console.log('[vite.config] VITE_SUPABASE_ANON_KEY:', env.VITE_SUPABASE_ANON_KEY ? 'found' : 'MISSING')

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // Explicitly inject env vars — ensures they work on any host
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || ''),
    },
    server: {
      port: 5173,
      open: true,
    },
  }
})
