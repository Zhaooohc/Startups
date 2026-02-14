
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Cloud Run and other platforms set the PORT environment variable.
    // We default to 8080 if not set.
    port: parseInt(process.env.PORT || '8080'),
    host: true, // Listen on all addresses (0.0.0.0), required for Docker/Cloud Run
  },
  preview: {
    port: parseInt(process.env.PORT || '8080'),
    host: true,
  }
});
