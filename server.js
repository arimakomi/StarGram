// StarGram server — Express + MySQL/MariaDB
// اجرا:  node server.js          (سرویس)
//        node server.js --init   (ساخت جدول‌ها + ساخت/ریست ادمین و خروج)
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ───────────── بارگذاری .env (بدون وابستگی اضافه) ─────────────
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

const PORT = parseInt(process.env.PORT || '3000', 10);
const DIST_DIR = path.join(__dirname, 'dist');
const INIT_ONLY = process.argv.includes('--init');
const SESSION_TTL = 30 * 24 * 3600 * 1000;
const PROTECTED_USER_FIELDS = ['role', 'isBanned', 'bannedUntil', 'banReason'];

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'stargram',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'stargram',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4'
});

// ───────────── رمز عبور / توکن ─────────────
const hashPassword = (pw) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(pw, salt, 32).toString('hex')}`;
};
const verifyPassword = (pw, stored) => {
  if (typeof stored !== 'string') return false;
  const [kind, salt, hash] = stored.split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const a = crypto.scryptSync(pw, salt, 32);
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ───────────── دیتابیس ─────────────
async function initSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS documents (
    collection VARCHAR(64) NOT NULL,
    doc_id VARCHAR(191) NOT NULL,
    data LONGTEXT NOT NULL,
    updated_at BIGINT NOT NULL,
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (collection, doc_id),
    KEY idx_updated (collection, updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
  await pool.query(`CREATE TABLE IF NOT EXISTS sessions (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    user_id VARCHAR(191) NOT NULL,
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    KEY idx_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
}

async function getDocRow(collection, id) {
  const [rows] = await pool.query('SELECT data FROM documents WHERE collection=? AND doc_id=? AND deleted=0', [collection, id]);
  return rows.length ? JSON.parse(rows[0].data) : null;
}
async function putDocRow(conn, collection, id, data, now) {
  await conn.query(
    `INSERT INTO documents (collection, doc_id, data, updated_at, deleted) VALUES (?,?,?,?,0)
     ON DUPLICATE KEY UPDATE data=VALUES(data), updated_at=VALUES(updated_at), deleted=0`,
    [collection, id, JSON.stringify(data), now]
  );
}

const publicUser = (u) => {
  if (!u) return u;
  const { password, passwordHash, ...rest } = u;
  return rest;
};
const isAdmin = (u) => !!u && (u.role === 'superadmin' || u.role === 'admin');

async function ensureAdmin({ reset }) {
  const username = (process.env.ADMIN_USER || '').trim().toLowerCase();
  const pass = process.env.ADMIN_PASS || '';
  if (!username) return;
  const existing = await getDocRow('users', username);
  const now = Date.now();
  if (!existing) {
    if (!pass) { console.warn('⚠️  ADMIN_PASS تنظیم نشده؛ ادمین ساخته نشد.'); return; }
    await putDocRow(pool, 'users', username, {
      id: username, username, displayName: 'مدیر سیستم', passwordHash: hashPassword(pass),
      status: 'online', role: 'superadmin', phone: '', theme: 'night', wallpaper: 'default',
      contacts: [], privacy: { showStatus: 'all', showAvatar: 'all' }
    }, now);
    console.log(`✅ ادمین «${username}» ساخته شد.`);
  } else if (reset && pass) {
    existing.passwordHash = hashPassword(pass);
    existing.role = 'superadmin';
    existing.isBanned = false;
    delete existing.password;
    await putDocRow(pool, 'users', username, existing, now);
    console.log(`✅ رمز و نقش ادمین «${username}» به‌روزرسانی شد.`);
  }
  if (!(await getDocRow('system_config', 'main'))) {
    await putDocRow(pool, 'system_config', 'main', {
      id: 'main', allowGroupCreation: true, allowChannelCreation: true, allowStories: true
    }, now);
  }
}

// ───────────── محدودیت تلاش ورود ─────────────
const attempts = new Map();
const tooMany = (key) => {
  const a = attempts.get(key);
  return a && a.count >= 8 && Date.now() - a.first < 10 * 60 * 1000;
};
const noteFail = (key) => {
  const a = attempts.get(key);
  if (!a || Date.now() - a.first > 10 * 60 * 1000) attempts.set(key, { count: 1, first: Date.now() });
  else a.count++;
};

// ───────────── اپ ─────────────
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '50mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ success: false, message: 'خطای داخلی سرور' });
});

app.get('/api/health', wrap(async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', app: 'StarGram', db: 'connected', uptime: Math.round(process.uptime()), timestamp: Date.now() });
}));

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  await pool.query('INSERT INTO sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)',
    [sha256(token), userId, now, now + SESSION_TTL]);
  if (Math.random() < 0.05) pool.query('DELETE FROM sessions WHERE expires_at < ?', [now]).catch(() => {});
  return token;
}

const normUser = (s) => String(s || '').trim().toLowerCase();
const validUsername = (u) => /^[^\s/\\]{3,32}$/.test(u);

app.get('/api/auth/exists', wrap(async (req, res) => {
  const u = normUser(req.query.username);
  if (!validUsername(u)) return res.json({ exists: false });
  res.json({ exists: !!(await getDocRow('users', u)) });
}));

app.post('/api/auth/register', wrap(async (req, res) => {
  const username = normUser(req.body?.username);
  const password = String(req.body?.password || '');
  const displayName = String(req.body?.displayName || username).trim().slice(0, 60);
  if (!validUsername(username)) return res.status(400).json({ success: false, message: 'نام کاربری نامعتبر است (۳ تا ۳۲ کاراکتر بدون فاصله).' });
  if (password.length < 6) return res.status(400).json({ success: false, message: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' });
  if (await getDocRow('users', username)) return res.status(409).json({ success: false, message: 'این نام کاربری قبلاً ثبت شده است.' });
  const user = {
    id: username, username, displayName, passwordHash: hashPassword(password),
    avatar: typeof req.body?.avatar === 'string' && req.body.avatar.length < 20000 ? req.body.avatar : undefined,
    status: 'online', role: 'user', phone: `+98 912 ${Math.floor(1000000 + Math.random() * 9000000)}`,
    theme: 'night', wallpaper: 'default', contacts: [], privacy: { showStatus: 'all', showAvatar: 'all' }
  };
  await putDocRow(pool, 'users', username, user, Date.now());
  res.json({ success: true, token: await createSession(username), user: publicUser(user) });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const username = normUser(req.body?.username);
  const password = String(req.body?.password || '');
  const key = `${req.ip}|${username}`;
  if (tooMany(key)) return res.status(429).json({ success: false, message: 'تلاش‌های زیاد؛ چند دقیقه بعد دوباره امتحان کنید.' });
  const user = validUsername(username) ? await getDocRow('users', username) : null;
  if (!user || !verifyPassword(password, user.passwordHash)) {
    noteFail(key);
    return res.status(401).json({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' });
  }
  if (user.isBanned) {
    if (user.bannedUntil && user.bannedUntil < Date.now()) {
      user.isBanned = false; delete user.bannedUntil; delete user.banReason;
      await putDocRow(pool, 'users', username, user, Date.now());
    } else {
      return res.status(403).json({ success: false, message: user.banReason ? `حساب شما مسدود شده است: ${user.banReason}` : 'حساب شما مسدود شده است.' });
    }
  }
  attempts.delete(key);
  res.json({ success: true, token: await createSession(username), user: publicUser(user) });
}));

// احراز هویت برای مسیرهای محافظت‌شده
async function auth(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (!token) return res.status(401).json({ success: false, message: 'نیاز به ورود' });
    const [rows] = await pool.query(
      `SELECT d.data FROM sessions s JOIN documents d ON d.collection='users' AND d.doc_id=s.user_id AND d.deleted=0
       WHERE s.token_hash=? AND s.expires_at>?`, [sha256(token), Date.now()]);
    if (!rows.length) return res.status(401).json({ success: false, message: 'نشست منقضی شده است' });
    const user = JSON.parse(rows[0].data);
    if (user.isBanned && !(user.bannedUntil && user.bannedUntil < Date.now())) {
      return res.status(403).json({ success: false, message: 'حساب شما مسدود شده است.' });
    }
    req.user = user; req.tokenHash = sha256(token);
    next();
  } catch (e) { console.error(e); res.status(500).json({ success: false, message: 'خطای داخلی سرور' }); }
}

app.get('/api/auth/me', auth, (req, res) => res.json({ success: true, user: publicUser(req.user) }));
app.post('/api/auth/logout', auth, wrap(async (req, res) => {
  await pool.query('DELETE FROM sessions WHERE token_hash=?', [req.tokenHash]);
  res.json({ success: true });
}));

const COLLECTION_RE = /^[a-z_]{1,64}$/;

app.get('/api/db/:collection', auth, wrap(async (req, res) => {
  const c = req.params.collection;
  if (!COLLECTION_RE.test(c)) return res.status(400).json({ success: false });
  const since = parseInt(req.query.since || '0', 10) || 0;
  const [rows] = await pool.query(
    'SELECT doc_id, data, deleted FROM documents WHERE collection=? AND updated_at>?' + (since ? '' : ' AND deleted=0'),
    [c, since]);
  const docs = {}; const deleted = [];
  const admin = isAdmin(req.user);
  for (const r of rows) {
    if (r.deleted) { deleted.push(r.doc_id); continue; }
    const d = JSON.parse(r.data);
    // حریم خصوصی: هر کاربر فقط چت‌هایی را می‌بیند که عضو آن‌هاست؛ گزارش‌ها فقط برای مدیر
    if (c === 'chats' && !(Array.isArray(d.participantIds) && d.participantIds.includes(req.user.id))) continue;
    if (c === 'reports' && !admin) continue;
    docs[r.doc_id] = c === 'users' ? publicUser(d) : d;
  }
  res.json({ success: true, docs, deleted, now: Date.now() - 1 });
}));

app.post('/api/db/:collection/batch', auth, wrap(async (req, res) => {
  const c = req.params.collection;
  if (!COLLECTION_RE.test(c)) return res.status(400).json({ success: false });
  const admin = isAdmin(req.user);
  if (c === 'system_config' && !admin) return res.status(403).json({ success: false, message: 'فقط مدیر' });
  const upserts = req.body?.upserts && typeof req.body.upserts === 'object' ? req.body.upserts : {};
  const deletes = Array.isArray(req.body?.deletes) ? req.body.deletes : [];
  const now = Date.now();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const [id, incoming] of Object.entries(upserts)) {
      if (id.length > 191 || !incoming || typeof incoming !== 'object') continue;
      let data = incoming;
      if (c === 'chats') {
        const [r] = await conn.query('SELECT data FROM documents WHERE collection=? AND doc_id=? AND deleted=0 FOR UPDATE', ['chats', id]);
        const was = r.length ? JSON.parse(r[0].data).participantIds : null;
        const member = (arr) => Array.isArray(arr) && arr.includes(req.user.id);
        if (!(member(incoming.participantIds) && (!was || member(was))) && !(was && member(was))) continue;
      }
      if (c === 'users') {
        const [r] = await conn.query('SELECT data FROM documents WHERE collection=? AND doc_id=? AND deleted=0 FOR UPDATE', ['users', id]);
        const existing = r.length ? JSON.parse(r[0].data) : null;
        data = { ...incoming };
        const plain = typeof data.password === 'string' ? data.password : null;
        delete data.password; delete data.passwordHash;
        if (existing) {
          data.passwordHash = existing.passwordHash;
          if (plain && plain.length >= 6 && (admin || req.user.id === id)) data.passwordHash = hashPassword(plain);
          if (!admin) {
            for (const f of PROTECTED_USER_FIELDS) {
              if (existing[f] === undefined) delete data[f]; else data[f] = existing[f];
            }
          }
        } else {
          if (!admin) continue; // ساخت کاربر جدید فقط از مسیر /api/auth/register
          if (plain && plain.length >= 6) data.passwordHash = hashPassword(plain);
        }
      }
      await putDocRow(conn, c, id, data, now);
    }
    for (const id of deletes) {
      if (typeof id !== 'string') continue;
      if (c === 'users' && !admin && id !== req.user.id) continue;
      if (c === 'users' && id === req.user.id && admin) continue; // ادمین نمی‌تواند خودش را حذف کند
      if (c === 'chats') {
        const cur = await getDocRow('chats', id);
        if (!cur || !(Array.isArray(cur.participantIds) && cur.participantIds.includes(req.user.id))) continue;
      }
      await conn.query('UPDATE documents SET deleted=1, data=?, updated_at=? WHERE collection=? AND doc_id=?', ['{}', now, c, id]);
    }
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  res.json({ success: true, now });
}));

// فایل‌های استاتیک
app.use('/assets', express.static(path.join(DIST_DIR, 'assets'), { maxAge: '1y', immutable: true }));
app.use(express.static(DIST_DIR));
app.use((req, res) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return res.status(404).json({ success: false, message: 'Not found' });
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(503).send('پوشه dist یافت نشد. ابتدا دستور npm run build را اجرا کنید.');
});

// ───────────── راه‌اندازی ─────────────
try {
  await initSchema();
  await ensureAdmin({ reset: INIT_ONLY });
} catch (e) {
  console.error('❌ اتصال/آماده‌سازی دیتابیس ناموفق بود:', e.message);
  process.exit(1);
}
if (INIT_ONLY) { await pool.end(); process.exit(0); }

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 StarGram روی پورت ${PORT} فعال شد — http://localhost:${PORT}`);
});
