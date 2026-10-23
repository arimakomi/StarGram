// ورود/ثبت‌نام روی سرور + نگهداری توکن نشست
const TOKEN_KEY = 'starly_token';

export const getToken = (): string | null => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t: string | null) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
};

async function call(path: string, init?: RequestInit & { json?: any }) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  try {
    const res = await fetch(path, {
      ...init,
      headers,
      body: init?.json !== undefined ? JSON.stringify(init.json) : undefined
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...data };
  } catch {
    return { ok: false, status: 0, success: false, message: 'ارتباط با سرور برقرار نشد.' };
  }
}

export const authApi = {
  exists: async (username: string): Promise<boolean> => !!(await call(`/api/auth/exists?username=${encodeURIComponent(username)}`)).exists,
  login: async (username: string, password: string) => {
    const r = await call('/api/auth/login', { method: 'POST', json: { username, password } });
    if (r.success) setToken(r.token);
    return r;
  },
  register: async (username: string, password: string, displayName: string, avatar: string) => {
    const r = await call('/api/auth/register', { method: 'POST', json: { username, password, displayName, avatar } });
    if (r.success) setToken(r.token);
    return r;
  },
  me: () => call('/api/auth/me'),
  logout: async () => { await call('/api/auth/logout', { method: 'POST' }); setToken(null); }
};
