import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// En GitHub Pages la web vive en /magical-athlete/
export default defineConfig(({ mode }) => ({
  base: mode === 'development' ? '/' : '/magical-athlete/',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1500 },
}));
