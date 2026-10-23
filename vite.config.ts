
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    server: { proxy: { '/api': 'http://localhost:3000' } },
    base: '/', // تنظیم روی / برای اجرا در دامنه اصلی (مثلا chat.site.com)
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false, // غیرفعال کردن سورس‌مپ برای امنیت بیشتر در پروداکشن
    },
    define: {
      'process.env': {
        API_KEY: env.API_KEY || env.GEMINI_API_KEY || ''
      }
    }
  };
});
