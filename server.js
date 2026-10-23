// StarGram server — Express + PostgreSQL / MySQL / Local Storage
// اجرا:  node server.js          (سرویس)
//        node server.js --init   (ساخت جدول‌ها + ساخت/ریست ادمین و خروج)
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import pg from 'pg';
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
const DATA_DIR = path.join(__dirname, 'data');
const LOCAL_DB_FILE = path.join(DATA_DIR, 'stargram_db.json');
const INIT_ONLY = process.argv.includes('--init');
const SESSION_TTL = 30 * 24 * 3600 * 1000;
const PROTECTED_USER_FIELDS = ['role', 'isBanned', 'bannedUntil', 'banReason'];

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

// ───────────── لایه تجرید دیتابیس (PostgreSQL / MySQL / Local) ─────────────
let dbAdapter = null;

class LocalAdapter {
  constructor() {
    this.type = 'local';
    this.docs = new Map(); // key: `${col}::${id}` -> { collection, doc_id, data, updated_at, deleted }
    this.sessions = new Map(); // token_hash -> { token_hash, user_id, created_at, expires_at }
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    this.load();
  }

  load() {
    if (fs.existsSync(LOCAL_DB_FILE)) {
      try {
        const raw = JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf8'));
        if (Array.isArray(raw.docs)) {
          for (const d of raw.docs) this.docs.set(`${d.collection}::${d.doc_id}`, d);
        }
        if (Array.isArray(raw.sessions)) {
          for (const s of raw.sessions) this.sessions.set(s.token_hash, s);
        }
      } catch (e) {
        console.warn('⚠️ Error reading local storage database; initializing new database:', e.message);
      }
    }
  }

  save() {
    try {
      const data = {
        docs: Array.from(this.docs.values()),
        sessions: Array.from(this.sessions.values())
      };
      const tmp = `${LOCAL_DB_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(data), 'utf8');
      fs.renameSync(tmp, LOCAL_DB_FILE);
    } catch (e) {
      console.error('❌ Failed to save local storage database:', e);
    }
  }

  async initSchema() {
    return Promise.resolve();
  }

  async ping() {
    return true;
  }

  async getDoc(col, id) {
    const item = this.docs.get(`${col}::${id}`);
    if (!item || item.deleted) return null;
    return typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
  }

  async putDoc(col, id, data, now) {
    this.docs.set(`${col}::${id}`, {
      collection: col,
      doc_id: id,
      data: typeof data === 'string' ? data : JSON.stringify(data),
      updated_at: now,
      deleted: 0
    });
    this.save();
  }

  async deleteDoc(col, id, now) {
    const item = this.docs.get(`${col}::${id}`);
    if (item) {
      item.deleted = 1;
      item.data = '{}';
      item.updated_at = now;
      this.save();
    }
  }

  async getCollectionDocs(col, since) {
    const rows = [];
    for (const item of this.docs.values()) {
      if (item.collection === col) {
        if (since ? item.updated_at > since : item.deleted === 0) {
          rows.push({
            doc_id: item.doc_id,
            data: item.data,
            deleted: item.deleted
          });
        }
      }
    }
    return rows;
  }

  async createSession(tokenHash, userId, now, expiresAt) {
    this.sessions.set(tokenHash, { token_hash: tokenHash, user_id: userId, created_at: now, expires_at: expiresAt });
    this.save();
  }

  async getSessionUser(tokenHash, now) {
    const sess = this.sessions.get(tokenHash);
    if (!sess || sess.expires_at <= now) return null;
    return this.getDoc('users', sess.user_id);
  }

  async deleteSession(tokenHash) {
    this.sessions.delete(tokenHash);
    this.save();
  }

  async cleanExpiredSessions(now) {
    for (const [th, s] of this.sessions.entries()) {
      if (s.expires_at < now) this.sessions.delete(th);
    }
    this.save();
  }

  async close() {}
}

class PostgresAdapter {
  constructor(pool) {
    this.type = 'postgres';
    this.pool = pool;
  }

  async ping() {
    await this.pool.query('SELECT 1');
    return true;
  }

  async initSchema() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        collection VARCHAR(64) NOT NULL,
        doc_id VARCHAR(191) NOT NULL,
        data TEXT NOT NULL,
        updated_at BIGINT NOT NULL,
        deleted SMALLINT NOT NULL DEFAULT 0,
        PRIMARY KEY (collection, doc_id)
      );
      CREATE INDEX IF NOT EXISTS idx_documents_updated ON documents (collection, updated_at);

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash VARCHAR(64) NOT NULL PRIMARY KEY,
        user_id VARCHAR(191) NOT NULL,
        created_at BIGINT NOT NULL,
        expires_at BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
    `);
  }

  async getDoc(col, id) {
    const res = await this.pool.query(
      'SELECT data FROM documents WHERE collection = $1 AND doc_id = $2 AND deleted = 0',
      [col, id]
    );
    return res.rows.length ? JSON.parse(res.rows[0].data) : null;
  }

  async putDoc(col, id, data, now) {
    const strData = typeof data === 'string' ? data : JSON.stringify(data);
    await this.pool.query(
      `INSERT INTO documents (collection, doc_id, data, updated_at, deleted)
       VALUES ($1, $2, $3, $4, 0)
       ON CONFLICT (collection, doc_id) DO UPDATE SET
         data = EXCLUDED.data,
         updated_at = EXCLUDED.updated_at,
         deleted = 0`,
      [col, id, strData, now]
    );
  }

  async deleteDoc(col, id, now) {
    await this.pool.query(
      'UPDATE documents SET deleted = 1, data = $1, updated_at = $2 WHERE collection = $3 AND doc_id = $4',
      ['{}', now, col, id]
    );
  }

  async getCollectionDocs(col, since) {
    const query = since
      ? 'SELECT doc_id, data, deleted FROM documents WHERE collection = $1 AND updated_at > $2'
      : 'SELECT doc_id, data, deleted FROM documents WHERE collection = $1 AND deleted = 0';
    const params = since ? [col, since] : [col];
    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async createSession(tokenHash, userId, now, expiresAt) {
    await this.pool.query(
      'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)',
      [tokenHash, userId, now, expiresAt]
    );
  }

  async getSessionUser(tokenHash, now) {
    const res = await this.pool.query(
      `SELECT d.data FROM sessions s
       JOIN documents d ON d.collection = 'users' AND d.doc_id = s.user_id AND d.deleted = 0
       WHERE s.token_hash = $1 AND s.expires_at > $2`,
      [tokenHash, now]
    );
    return res.rows.length ? JSON.parse(res.rows[0].data) : null;
  }

  async deleteSession(tokenHash) {
    await this.pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
  }

  async cleanExpiredSessions(now) {
    await this.pool.query('DELETE FROM sessions WHERE expires_at < $1', [now]);
  }

  async close() {
    await this.pool.end();
  }
}

class MysqlAdapter {
  constructor(pool) {
    this.type = 'mysql';
    this.pool = pool;
  }

  async ping() {
    await this.pool.query('SELECT 1');
    return true;
  }

  async initSchema() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS documents (
      collection VARCHAR(64) NOT NULL,
      doc_id VARCHAR(191) NOT NULL,
      data LONGTEXT NOT NULL,
      updated_at BIGINT NOT NULL,
      deleted TINYINT(1) NOT NULL DEFAULT 0,
      PRIMARY KEY (collection, doc_id),
      KEY idx_updated (collection, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);

    await this.pool.query(`CREATE TABLE IF NOT EXISTS sessions (
      token_hash CHAR(64) NOT NULL PRIMARY KEY,
      user_id VARCHAR(191) NOT NULL,
      created_at BIGINT NOT NULL,
      expires_at BIGINT NOT NULL,
      KEY idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
  }

  async getDoc(col, id) {
    const [rows] = await this.pool.query(
      'SELECT data FROM documents WHERE collection=? AND doc_id=? AND deleted=0',
      [col, id]
    );
    return rows.length ? JSON.parse(rows[0].data) : null;
  }

  async putDoc(col, id, data, now) {
    const strData = typeof data === 'string' ? data : JSON.stringify(data);
    await this.pool.query(
      `INSERT INTO documents (collection, doc_id, data, updated_at, deleted) VALUES (?,?,?,?,0)
       ON DUPLICATE KEY UPDATE data=VALUES(data), updated_at=VALUES(updated_at), deleted=0`,
      [col, id, strData, now]
    );
  }

  async deleteDoc(col, id, now) {
    await this.pool.query(
      'UPDATE documents SET deleted=1, data=?, updated_at=? WHERE collection=? AND doc_id=?',
      ['{}', now, col, id]
    );
  }

  async getCollectionDocs(col, since) {
    const query = since
      ? 'SELECT doc_id, data, deleted FROM documents WHERE collection=? AND updated_at>?'
      : 'SELECT doc_id, data, deleted FROM documents WHERE collection=? AND deleted=0';
    const params = since ? [col, since] : [col];
    const [rows] = await this.pool.query(query, params);
    return rows;
  }

  async createSession(tokenHash, userId, now, expiresAt) {
    await this.pool.query(
      'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)',
      [tokenHash, userId, now, expiresAt]
    );
  }

  async getSessionUser(tokenHash, now) {
    const [rows] = await this.pool.query(
      `SELECT d.data FROM sessions s
       JOIN documents d ON d.collection='users' AND d.doc_id=s.user_id AND d.deleted=0
       WHERE s.token_hash=? AND s.expires_at>?`,
      [tokenHash, now]
    );
    return rows.length ? JSON.parse(rows[0].data) : null;
  }

  async deleteSession(tokenHash) {
    await this.pool.query('DELETE FROM sessions WHERE token_hash=?', [tokenHash]);
  }

  async cleanExpiredSessions(now) {
    await this.pool.query('DELETE FROM sessions WHERE expires_at < ?', [now]);
  }

  async close() {
    await this.pool.end();
  }
}

// ایجاد و اتصال به دیتابیس با فال‌بک خودکار
async function setupDatabase() {
  const dbType = (process.env.DB_TYPE || '').toLowerCase();
  const dbUrl = process.env.DATABASE_URL || '';

  // ۱) بررسی PostgreSQL
  if (dbType === 'postgres' || dbType === 'pgsql' || dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://') || process.env.PGHOST) {
    try {
      console.log('🔄 Connecting to PostgreSQL database...');
      const pgConfig = dbUrl ? { connectionString: dbUrl } : {
        host: process.env.PGHOST || process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.PGPORT || process.env.DB_PORT || '5432', 10),
        user: process.env.PGUSER || process.env.DB_USER || 'postgres',
        password: process.env.PGPASSWORD || process.env.DB_PASS || '',
        database: process.env.PGDATABASE || process.env.DB_NAME || 'stargram',
        connectionTimeoutMillis: 3000
      };
      const pool = new pg.Pool(pgConfig);
      const adapter = new PostgresAdapter(pool);
      await adapter.ping();
      await adapter.initSchema();
      console.log('✅ Successfully connected to PostgreSQL.');
      return adapter;
    } catch (e) {
      console.warn('⚠️ Connection to PostgreSQL failed:', e.message);
    }
  }

  // ۲) بررسی MySQL / MariaDB
  if (dbType === 'mysql' || process.env.DB_HOST || dbUrl.startsWith('mysql://')) {
    try {
      console.log('🔄 Connecting to MySQL / MariaDB database...');
      const mysqlConfig = dbUrl ? { uri: dbUrl } : {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'stargram',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'stargram',
        waitForConnections: true,
        connectionLimit: 10,
        connectTimeout: 3000,
        charset: 'utf8mb4'
      };
      const pool = mysql.createPool(mysqlConfig);
      const adapter = new MysqlAdapter(pool);
      await adapter.ping();
      await adapter.initSchema();
      console.log('✅ Successfully connected to MySQL / MariaDB.');
      return adapter;
    } catch (e) {
      console.warn('⚠️ Connection to MySQL / MariaDB failed:', e.message);
    }
  }

  // ۳) فال‌بک امن به ذخیره‌سازی محلی (Local File Storage)
  console.log('ℹ️ External database not configured or unavailable; using Local Storage engine.');
  const local = new LocalAdapter();
  await local.initSchema();
  return local;
}

const publicUser = (u) => {
  if (!u) return u;
  const { password, passwordHash, ...rest } = u;
  return rest;
};
const isAdmin = (u) => !!u && (u.role === 'superadmin' || u.role === 'admin');

async function ensureAdmin({ reset }) {
  const username = (process.env.ADMIN_USER || 'admin').trim().toLowerCase();
  const pass = process.env.ADMIN_PASS || 'admin123456';
  if (!username) return;
  const existing = await dbAdapter.getDoc('users', username);
  const now = Date.now();
  if (!existing) {
    await dbAdapter.putDoc('users', username, {
      id: username, username, displayName: 'مدیر ارشد', passwordHash: hashPassword(pass),
      status: 'online', role: 'superadmin', phone: '', theme: 'night', wallpaper: 'default',
      contacts: [], privacy: { showStatus: 'all', showAvatar: 'all' }
    }, now);
    console.log(`✅ Admin account "${username}" initialized.`);
  } else if (reset && pass) {
    existing.passwordHash = hashPassword(pass);
    existing.role = 'superadmin';
    existing.isBanned = false;
    delete existing.password;
    await dbAdapter.putDoc('users', username, existing, now);
    console.log(`✅ Admin account "${username}" credentials updated.`);
  }
  if (!(await dbAdapter.getDoc('system_config', 'main'))) {
    await dbAdapter.putDoc('system_config', 'main', {
      id: 'main',
      allowGroupCreation: true,
      allowChannelCreation: true,
      allowStories: true,
      geminiEnabled: false,
      geminiApiKey: '',
      geminiProxyUrl: '',
      geminiModel: 'gemini-2.5-flash'
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

// ───────────── اپ Express ─────────────
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
  await dbAdapter.ping();
  res.json({
    status: 'ok',
    app: 'StarGram',
    db: 'connected',
    dbType: dbAdapter.type,
    uptime: Math.round(process.uptime()),
    timestamp: Date.now()
  });
}));

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  await dbAdapter.createSession(sha256(token), userId, now, now + SESSION_TTL);
  if (Math.random() < 0.05) dbAdapter.cleanExpiredSessions(now).catch(() => {});
  return token;
}

const normUser = (s) => String(s || '').trim().toLowerCase();
const validUsername = (u) => /^[^\s/\\]{3,32}$/.test(u);

app.get('/api/auth/exists', wrap(async (req, res) => {
  const u = normUser(req.query.username);
  if (!validUsername(u)) return res.json({ exists: false });
  res.json({ exists: !!(await dbAdapter.getDoc('users', u)) });
}));

app.post('/api/auth/register', wrap(async (req, res) => {
  const username = normUser(req.body?.username);
  const password = String(req.body?.password || '');
  const displayName = String(req.body?.displayName || username).trim().slice(0, 60);
  if (!validUsername(username)) return res.status(400).json({ success: false, message: 'نام کاربری نامعتبر است (۳ تا ۳۲ کاراکتر بدون فاصله).' });
  if (password.length < 6) return res.status(400).json({ success: false, message: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' });
  if (await dbAdapter.getDoc('users', username)) return res.status(409).json({ success: false, message: 'این نام کاربری قبلاً ثبت شده است.' });
  const now = Date.now();
  const user = {
    id: username, username, displayName, passwordHash: hashPassword(password),
    avatar: typeof req.body?.avatar === 'string' && req.body.avatar.length < 20000 ? req.body.avatar : undefined,
    status: 'online', lastSeen: now, role: 'user', phone: '',
    theme: 'night', wallpaper: 'default', contacts: [], privacy: { showStatus: 'all', showAvatar: 'all' }
  };
  await dbAdapter.putDoc('users', username, user, now);
  res.json({ success: true, token: await createSession(username), user: publicUser(user) });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const username = normUser(req.body?.username);
  const password = String(req.body?.password || '');
  const key = `${req.ip}|${username}`;
  if (tooMany(key)) return res.status(429).json({ success: false, message: 'تلاش‌های زیاد؛ چند دقیقه بعد دوباره امتحان کنید.' });
  const user = validUsername(username) ? await dbAdapter.getDoc('users', username) : null;
  if (!user || !verifyPassword(password, user.passwordHash)) {
    noteFail(key);
    return res.status(401).json({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' });
  }
  const now = Date.now();
  if (user.isBanned) {
    if (user.bannedUntil && user.bannedUntil < now) {
      user.isBanned = false; delete user.bannedUntil; delete user.banReason;
    } else {
      return res.status(403).json({ success: false, message: user.banReason ? `حساب شما مسدود شده است: ${user.banReason}` : 'حساب شما مسدود شده است.' });
    }
  }
  user.lastSeen = now;
  user.status = 'online';
  await dbAdapter.putDoc('users', username, user, now);
  attempts.delete(key);
  res.json({ success: true, token: await createSession(username), user: publicUser(user) });
}));

// احراز هویت برای مسیرهای محافظت‌شده
async function auth(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (!token) return res.status(401).json({ success: false, message: 'نیاز به ورود' });
    const user = await dbAdapter.getSessionUser(sha256(token), Date.now());
    if (!user) return res.status(401).json({ success: false, message: 'نشست منقضی شده است' });
    if (user.isBanned && !(user.bannedUntil && user.bannedUntil < Date.now())) {
      return res.status(403).json({ success: false, message: 'حساب شما مسدود شده است.' });
    }
    req.user = user;
    req.tokenHash = sha256(token);
    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'خطای داخلی سرور' });
  }
}

app.get('/api/auth/me', auth, (req, res) => res.json({ success: true, user: publicUser(req.user) }));
app.post('/api/auth/logout', auth, wrap(async (req, res) => {
  const user = await dbAdapter.getDoc('users', req.user.id);
  if (user) {
    user.lastSeen = Date.now();
    user.status = 'offline';
    await dbAdapter.putDoc('users', req.user.id, user, Date.now());
  }
  await dbAdapter.deleteSession(req.tokenHash);
  res.json({ success: true });
}));

app.post('/api/users/heartbeat', auth, wrap(async (req, res) => {
  const now = Date.now();
  const user = await dbAdapter.getDoc('users', req.user.id);
  if (user) {
    user.lastSeen = now;
    user.status = 'online';
    await dbAdapter.putDoc('users', req.user.id, user, now);
  }
  res.json({ success: true, timestamp: now });
}));

const COLLECTION_RE = /^[a-z_]{1,64}$/;

app.get('/api/db/:collection', auth, wrap(async (req, res) => {
  const c = req.params.collection;
  if (!COLLECTION_RE.test(c)) return res.status(400).json({ success: false });
  const since = parseInt(req.query.since || '0', 10) || 0;
  const rows = await dbAdapter.getCollectionDocs(c, since);
  const docs = {};
  const deleted = [];
  const admin = isAdmin(req.user);
  for (const r of rows) {
    if (r.deleted) { deleted.push(r.doc_id); continue; }
    const d = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
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

  for (const [id, incoming] of Object.entries(upserts)) {
    if (id.length > 191 || !incoming || typeof incoming !== 'object') continue;
    let data = incoming;
    if (c === 'chats') {
      const existingChat = await dbAdapter.getDoc('chats', id);
      const was = existingChat ? existingChat.participantIds : null;
      const member = (arr) => Array.isArray(arr) && arr.includes(req.user.id);
      if (!(member(incoming.participantIds) && (!was || member(was))) && !(was && member(was))) continue;
    }
    if (c === 'users') {
      const existing = await dbAdapter.getDoc('users', id);
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
        if (!admin) continue;
        if (plain && plain.length >= 6) data.passwordHash = hashPassword(plain);
      }
    }
    await dbAdapter.putDoc(c, id, data, now);
  }

  for (const id of deletes) {
    if (typeof id !== 'string') continue;
    if (c === 'users' && !admin && id !== req.user.id) continue;
    if (c === 'users' && id === req.user.id && admin) continue;
    if (c === 'chats') {
      const cur = await dbAdapter.getDoc('chats', id);
      if (!cur || !(Array.isArray(cur.participantIds) && cur.participantIds.includes(req.user.id))) continue;
    }
    await dbAdapter.deleteDoc(c, id, now);
  }

  res.json({ success: true, now });
}));

// ───────────── پروکسی سرور هوش مصنوعی Gemini ─────────────
async function getGeminiConfig() {
  const cfg = await dbAdapter.getDoc('system_config', 'main');
  const apiKey = (cfg?.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
  const proxyUrl = (cfg?.geminiProxyUrl || process.env.GEMINI_PROXY_URL || '').trim().replace(/\/$/, '');
  const model = (cfg?.geminiModel || 'gemini-2.5-flash').trim();
  const enabled = cfg?.geminiEnabled ?? (!!apiKey);
  return { apiKey, proxyUrl, model, enabled };
}

// تست اتصال کلید API و پروکسی جمنای (مخصوص مدیر)
app.post('/api/ai/test', auth, wrap(async (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ success: false, message: 'فقط مدیر به این بخش دسترسی دارد.' });
  const { apiKey: customKey, proxyUrl: customProxy, model: customModel } = req.body || {};
  const current = await getGeminiConfig();
  const key = (customKey !== undefined ? customKey : current.apiKey).trim();
  const proxy = (customProxy !== undefined ? customProxy : current.proxyUrl).trim().replace(/\/$/, '');
  const model = customModel || current.model || 'gemini-2.5-flash';

  if (!key) return res.status(400).json({ success: false, message: 'کلید API جمنای وارد نشده است.' });

  try {
    const baseUrl = proxy || 'https://generativelanguage.googleapis.com';
    const targetUrl = `${baseUrl}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    const resp = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'پاسخ کوتاه بده: آیا فعالی؟' }] }]
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(resp.status).json({ success: false, message: `پاسخ ناموفق از سرور واسط (${resp.status}): ${errText.slice(0, 200)}` });
    }
    const data = await resp.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'تست موفقیت‌آمیز بود!';
    res.json({ success: true, message: 'اتصال با موفقیت برقرار شد!', reply });
  } catch (e) {
    res.status(500).json({ success: false, message: `خطا در اتصال به پروکسی/جمنای: ${e.message}` });
  }
}));

// گفتگوی هوش مصنوعی برای کاربران (بدون افشای کلید در فرانت‌اند)
app.post('/api/ai/chat', auth, wrap(async (req, res) => {
  const { prompt, history } = req.body || {};
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ success: false, message: 'متن پیام ارسال نشده است.' });

  const { apiKey, proxyUrl, model, enabled } = await getGeminiConfig();
  if (!enabled || !apiKey) {
    return res.status(400).json({
      success: false,
      message: 'دستیار هوش مصنوعی در حال حاضر غیرفعال است یا توسط مدیر در پنل ادمین تنظیم نشده است.'
    });
  }

  const baseUrl = proxyUrl || 'https://generativelanguage.googleapis.com';
  const targetUrl = `${baseUrl}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const formattedContents = [
    ...(Array.isArray(history) ? history.map(h => ({
      role: h.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(h.text || '') }]
    })) : []),
    { role: 'user', parts: [{ text: prompt }] }
  ];

  try {
    const resp = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: formattedContents,
        systemInstruction: {
          parts: [{ text: 'You are a helpful, friendly AI assistant in StarGram. Respond in Persian. Keep it conversational and brief. Use emojis.' }]
        },
        generationConfig: { temperature: 0.8 }
      }),
      signal: AbortSignal.timeout(20000)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Gemini API Error:', resp.status, errText);
      return res.status(resp.status).json({ success: false, message: 'خطا در دریافت پاسخ از هوش مصنوعی.' });
    }

    const data = await resp.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'پاسخی دریافت نشد.';
    res.json({ success: true, reply });
  } catch (e) {
    console.error('AI Proxy Error:', e);
    res.status(500).json({ success: false, message: `خطا در ارتباط با سرور هوش مصنوعی: ${e.message}` });
  }
}));

// فایل‌های استاتیک
app.use('/assets', express.static(path.join(DIST_DIR, 'assets'), { maxAge: '1y', immutable: true }));
app.use(express.static(DIST_DIR));
app.use((req, res) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return res.status(404).json({ success: false, message: 'Not found' });
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(503).send('Production dist directory not found. Please run "npm run build" first.');
});

// ───────────── راه‌اندازی سرور ─────────────
try {
  dbAdapter = await setupDatabase();
  await ensureAdmin({ reset: INIT_ONLY });
} catch (e) {
  console.error('❌ Server initialization failed:', e.message);
  process.exit(1);
}

if (INIT_ONLY) {
  await dbAdapter.close();
  process.exit(0);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 StarGram running with [${dbAdapter.type}] database on port ${PORT} — http://localhost:${PORT}`);
});
