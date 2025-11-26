import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env vars, including those without VITE_ prefix (like API_KEY)
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Expose process.env.API_KEY to the client-side code
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
  };
});