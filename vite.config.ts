import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envPrefix: ['VITE_', 'SUPABASE_'],
  server: {
    host: '0.0.0.0',
    port: 3000,
    hmr: false,
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
});
