import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, 'dist');

// Middleware for JSON parsing and basic security headers
app.use(express.json({ limit: '50mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Starly Messenger',
    e2ee: 'AES-GCM 256-bit',
    isolation: '100% Offline / Zero External Network Calls',
    uptime: Math.round(process.uptime()),
    timestamp: Date.now()
  });
});

// Serve static assets with long cache lifetime
app.use(
  '/assets',
  express.static(path.join(DIST_DIR, 'assets'), {
    maxAge: '1y',
    immutable: true
  })
);

// Serve all other static files from dist
app.use(express.static(DIST_DIR));

// SPA fallback: any unmatched GET route returns index.html
app.get('*', (req, res) => {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(503).send(`
      <!DOCTYPE html>
      <html lang="fa" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <title>Starly Chat - در انتظار بیلد</title>
          <style>
            body { background: #0e1621; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #17212b; padding: 2rem; border-radius: 1rem; border: 1px solid #242f3d; text-align: center; }
            code { background: #0e1621; padding: 0.25rem 0.5rem; border-radius: 0.25rem; color: #3390ec; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>پروژه در حال آماده‌سازی است</h2>
            <p>پوشه <code>dist</code> یافت نشد. لطفاً ابتدا دستور زیر را در سرور اجرا کنید:</p>
            <p><code>npm run build</code></p>
          </div>
        </body>
      </html>
    `);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  =======================================================
   🚀 پیام‌رسان استارلی (Starly Messenger) روی سرور فعال شد
  =======================================================
   🌐 آدرس دسترسی: http://localhost:${PORT}
   🔒 امنیت سرتاسری: E2EE AES-256 (Web Crypto)
   🛡️ ایزولاسیون شبکه: ۱۰۰٪ محلی و مستقل از اینترنت خارجی
  =======================================================
  `);
});
