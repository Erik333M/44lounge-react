import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { adminApi } from './scripts/admin-api.mjs';
import { bookingApi } from './scripts/booking-api.mjs';

export default defineConfig(({ mode }) => {
  // server-only settings (TELEGRAM_*) from .env.local — never sent to the browser
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), adminApi(), bookingApi(env)],
  };
});
