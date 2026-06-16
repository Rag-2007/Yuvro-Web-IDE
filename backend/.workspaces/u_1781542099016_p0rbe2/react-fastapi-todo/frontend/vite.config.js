import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,       // Use 5174 — 5173 is the Yuvro IDE itself
    host: true,       // Expose to localhost so iframe loads it
    strictPort: false,
  },
});
