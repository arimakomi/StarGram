import { getToken } from './auth';

export interface DocumentReference<T = any> {
  id: string;
  path: string;
  collectionName: string;
}

export type QueryOp = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'array-contains' | 'in' | 'array-contains-any';

export interface QueryConstraint {
  type: 'where';
  field: string;
  op: QueryOp;
  value: any;
}

export interface Query<T = any> {
  collectionName: string;
  constraints: QueryConstraint[];
}

export interface DocumentSnapshot<T = any> {
  id: string;
  exists: () => boolean;
  data: () => T;
}

export interface QuerySnapshot<T = any> {
  docs: DocumentSnapshot<T>[];
  size: number;
  empty: boolean;
  forEach: (callback: (doc: DocumentSnapshot<T>) => void) => void;
}

// Database instance
export const db = {
  name: 'stargram-sql-db',
  version: 2
};

// In-memory active listeners
type SnapshotCallback = (snapshot: any) => void;
const listeners = new Map<string, Set<{ target: Query | DocumentReference; callback: SnapshotCallback }>>();

function notifyCollectionListeners(collectionName: string) {
  const collectionListeners = listeners.get(collectionName);
  if (!collectionListeners || collectionListeners.size === 0) return;

  collectionListeners.forEach(({ target, callback }) => {
    try {
      if ('constraints' in target) {
        // Query snapshot
        const snapshot = getQuerySnapshotSync(target);
        callback(snapshot);
      } else {
        // Doc snapshot
        const snapshot = getDocSnapshotSync(target);
        callback(snapshot);
      }
    } catch (err) {
      console.error('Error notifying listener:', err);
    }
  });
}

// ───────────── ذخیره‌سازی: حافظه محلی + همگام‌سازی با دیتابیس سرور (PostgreSQL / MySQL / Local) ─────────────
const memoryStore = new Map<string, Record<string, any>>();
const SYNC_COLLECTIONS = ['users', 'chats', 'stories', 'system_config', 'reports', 'user_sessions'];
const POLL_MS = 2500;
const CONNECTED_POLL_MS = 10000;

// آخرین نسخه‌ی همگام‌شده با سرور (JSON هر سند) برای تشخیص تغییرات
const synced = new Map<string, Record<string, string>>();
const sinceMap = new Map<string, number>();
const pushTimers = new Map<string, any>();
let pollTimer: any = null;
let syncActive = false;
let eventStreamController: AbortController | null = null;
let eventReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let eventReconnectAttempts = 0;
let eventStreamConnected = false;
let chatPullInProgress = false;
let chatPullAgain = false;

function getCollectionStore(collectionName: string): Record<string, any> {
  let s = memoryStore.get(collectionName);
  if (!s) { s = {}; memoryStore.set(collectionName, s); }
  return s;
}

function emitChange(collectionName: string, _broadcast: boolean) {
  notifyCollectionListeners(collectionName);
}

function setCollectionStore(collectionName: string, data: Record<string, any>) {
  memoryStore.set(collectionName, data);
  emitChange(collectionName, true);
  schedulePush(collectionName);
}

async function api(path: string, init?: RequestInit) {
  const token = getToken();
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  if (!res.ok) {
    let serverMessage = '';
    try {
      const errBody = await res.json();
      if (errBody && typeof errBody.message === 'string') {
        serverMessage = errBody.message;
      }
    } catch {}
    const err: any = new Error(serverMessage || `HTTP ${res.status}`);
    err.status = res.status;
    err.serverMessage = serverMessage;
    throw err;
  }
  return res.json();
}

function schedulePush(collectionName: string) {
  if (!syncActive) return;
  clearTimeout(pushTimers.get(collectionName));
  pushTimers.set(collectionName, setTimeout(() => pushCollection(collectionName), 80));
}

async function pushCollection(collectionName: string) {
  if (!syncActive) return;
  const store = getCollectionStore(collectionName);
  const base = synced.get(collectionName) || {};
  const upserts: Record<string, any> = {};
  const nextSynced: Record<string, string> = { ...base };
  for (const [id, d] of Object.entries(store)) {
    const j = JSON.stringify(d);
    if (base[id] !== j) { upserts[id] = d; nextSynced[id] = j; }
  }
  const deletes = Object.keys(base).filter(id => !(id in store));
  deletes.forEach(id => delete nextSynced[id]);
  if (!Object.keys(upserts).length && !deletes.length) return;
  try {
    await api(`/api/db/${collectionName}/batch`, { method: 'POST', body: JSON.stringify({ upserts, deletes }) });
    synced.set(collectionName, nextSynced);
  } catch (e: any) {
    if (e && e.status === 413) {
      // Revert rejected oversized upserts so they do not block future sync pushes
      let reverted = false;
      for (const id of Object.keys(upserts)) {
        if (base[id]) {
          try {
            store[id] = JSON.parse(base[id]);
            reverted = true;
          } catch {}
        } else {
          delete store[id];
          reverted = true;
        }
      }
      if (reverted) emitChange(collectionName, false);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('starly:upload-error', {
          detail: {
            message: e.serverMessage || 'حجم فایل ارسالی فراتر از سقف مجاز سرور است.'
          }
        }));
      }
      return;
    }
    console.warn(`Sync push failed for ${collectionName}, retrying…`, e);
    pushTimers.set(collectionName, setTimeout(() => pushCollection(collectionName), 4000));
  }
}

async function pullCollection(collectionName: string, full: boolean) {
  const since = full ? 0 : (sinceMap.get(collectionName) || 0);
  const r = await api(`/api/db/${collectionName}?since=${since}`);
  const store = getCollectionStore(collectionName);
  const base = synced.get(collectionName) || {};
  let changed = false;

  if (full) {
    // جایگزینی کامل، به‌جز تغییرات محلیِ هنوز ارسال‌نشده
    for (const id of Object.keys(store)) {
      if (!(id in r.docs) && JSON.stringify(store[id]) === base[id]) { delete store[id]; delete base[id]; changed = true; }
    }
  }
  for (const [id, d] of Object.entries<any>(r.docs || {})) {
    const j = JSON.stringify(d);
    const dirty = id in store && base[id] !== undefined && JSON.stringify(store[id]) !== base[id];
    if (dirty) continue; // تغییر محلی در انتظار ارسال است
    if (base[id] !== j || !(id in store)) { store[id] = d; changed = true; }
    base[id] = j;
  }
  for (const id of r.deleted || []) {
    const dirty = id in store && base[id] !== undefined && JSON.stringify(store[id]) !== base[id];
    if (!dirty && id in store) { delete store[id]; changed = true; }
    delete base[id];
  }
  synced.set(collectionName, base);
  sinceMap.set(collectionName, r.now);
  if (changed) emitChange(collectionName, false);
}

async function refreshChatsFromEvent() {
  if (chatPullInProgress) {
    chatPullAgain = true;
    return;
  }
  chatPullInProgress = true;
  try {
    do {
      chatPullAgain = false;
      await pullCollection('chats', false);
    } while (chatPullAgain && syncActive);
  } catch (e) {
    console.warn('Chat event sync failed; polling will retry.', e);
  } finally {
    chatPullInProgress = false;
  }
}

function scheduleEventReconnect(delayMs: number) {
  if (!syncActive || eventReconnectTimer) return;
  eventReconnectTimer = setTimeout(() => {
    eventReconnectTimer = null;
    void connectEventStream();
  }, delayMs);
}

async function connectEventStream() {
  if (!syncActive || eventStreamController) return;
  const token = getToken();
  if (!token) return;

  const controller = new AbortController();
  eventStreamController = controller;
  try {
    const response = await fetch('/api/sync/events', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
      signal: controller.signal,
      cache: 'no-store'
    });
    if (!response.ok || !response.body) throw new Error(`Event stream HTTP ${response.status}`);

    eventReconnectAttempts = 0;
    eventStreamConnected = true;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (syncActive && !controller.signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() || '';
      for (const frame of frames) {
        const dataLine = frame.split(/\r?\n/).find(line => line.startsWith('data:'));
        if (!dataLine) continue;
        try {
          const event = JSON.parse(dataLine.slice(5).trim());
          if (event.type === 'chat_changed') void refreshChatsFromEvent();
        } catch {
          // Ignore malformed event frames and let the next event or fallback poll recover.
        }
      }
    }
    reader.releaseLock();
  } catch (e) {
    if (syncActive && !controller.signal.aborted) {
      console.warn('Realtime sync disconnected; reconnecting.', e);
    }
  } finally {
    if (eventStreamController === controller) eventStreamController = null;
    eventStreamConnected = false;
    if (syncActive) {
      clearTimeout(pollTimer);
      pollTimer = setTimeout(pollAll, POLL_MS);
      const delay = Math.min(1000 * (2 ** eventReconnectAttempts), 15000);
      eventReconnectAttempts += 1;
      scheduleEventReconnect(delay);
    }
  }
}

async function pollAll() {
  if (!syncActive) return;
  try {
    await Promise.all(SYNC_COLLECTIONS.map(c => pullCollection(c, false)));
  } catch (e) {
    console.warn('Sync poll failed', e);
  }
  if (syncActive) pollTimer = setTimeout(pollAll, eventStreamConnected ? CONNECTED_POLL_MS : POLL_MS);
}

/** بعد از ورود صدا زده می‌شود: دریافت کامل داده‌ها از دیتابیس و شروع همگام‌سازی */
export async function startSync(): Promise<void> {
  stopSync();
  memoryStore.clear(); synced.clear(); sinceMap.clear();
  await Promise.all(SYNC_COLLECTIONS.map(c => pullCollection(c, true)));
  syncActive = true;
  void connectEventStream();
  pollTimer = setTimeout(pollAll, POLL_MS);
}

export function stopSync() {
  syncActive = false;
  clearTimeout(pollTimer);
  if (eventReconnectTimer) clearTimeout(eventReconnectTimer);
  eventReconnectTimer = null;
  eventReconnectAttempts = 0;
  eventStreamConnected = false;
  eventStreamController?.abort();
  eventStreamController = null;
  pushTimers.forEach(t => clearTimeout(t));
  pushTimers.clear();
  memoryStore.clear(); synced.clear(); sinceMap.clear();
}

// Synchronous snapshot generators
function getDocSnapshotSync<T = any>(ref: DocumentReference<T>): DocumentSnapshot<T> {
  const store = getCollectionStore(ref.collectionName);
  const data = store[ref.id];
  return {
    id: ref.id,
    exists: () => data !== undefined && data !== null,
    data: () => data as T
  };
}

function getQuerySnapshotSync<T = any>(queryObj: Query<T>): QuerySnapshot<T> {
  const store = getCollectionStore(queryObj.collectionName);
  const allDocs = Object.keys(store).map(id => ({ id, data: store[id] }));

  // Filter based on constraints
  const filtered = allDocs.filter(item => {
    for (const c of queryObj.constraints) {
      const val = item.data?.[c.field];
      switch (c.op) {
        case '==':
          if (val !== c.value) return false;
          break;
        case '!=':
          if (val === c.value) return false;
          break;
        case 'array-contains':
          if (!Array.isArray(val) || !val.includes(c.value)) return false;
          break;
        case 'in':
          if (!Array.isArray(c.value) || !c.value.includes(val)) return false;
          break;
        case 'array-contains-any':
          if (!Array.isArray(val) || !Array.isArray(c.value) || !c.value.some(v => val.includes(v))) return false;
          break;
        case '>':
          if (val <= c.value) return false;
          break;
        case '>=':
          if (val < c.value) return false;
          break;
        case '<':
          if (val >= c.value) return false;
          break;
        case '<=':
          if (val > c.value) return false;
          break;
      }
    }
    return true;
  });

  const docSnapshots: DocumentSnapshot<T>[] = filtered.map(item => ({
    id: item.id,
    exists: () => true,
    data: () => item.data as T
  }));

  return {
    docs: docSnapshots,
    size: docSnapshots.length,
    empty: docSnapshots.length === 0,
    forEach: (cb: (doc: DocumentSnapshot<T>) => void) => {
      docSnapshots.forEach(cb);
    }
  };
}

export function collection(_db: any, collectionName: string): Query {
  return { collectionName, constraints: [] };
}

export function doc(_db: any, collectionName: string, id: string): DocumentReference {
  return { id, path: `${collectionName}/${id}`, collectionName };
}

export function where(field: string, op: QueryOp, value: any): QueryConstraint {
  return { type: 'where', field, op, value };
}

export function query(source: Query, ...constraints: QueryConstraint[]): Query {
  return {
    collectionName: source.collectionName,
    constraints: [...source.constraints, ...constraints]
  };
}

export async function getDoc<T = any>(ref: DocumentReference<T>): Promise<DocumentSnapshot<T>> {
  return getDocSnapshotSync(ref);
}

export async function getDocs<T = any>(queryObj: Query<T>): Promise<QuerySnapshot<T>> {
  return getQuerySnapshotSync(queryObj);
}

export async function setDoc<T = any>(ref: DocumentReference<T>, data: any, options?: { merge?: boolean }): Promise<void> {
  const store = getCollectionStore(ref.collectionName);
  if (options?.merge && store[ref.id]) {
    store[ref.id] = { ...store[ref.id], ...data };
  } else {
    store[ref.id] = data;
  }
  setCollectionStore(ref.collectionName, store);
}

export async function deleteDoc<T = any>(ref: DocumentReference<T>): Promise<void> {
  const store = getCollectionStore(ref.collectionName);
  delete store[ref.id];
  setCollectionStore(ref.collectionName, store);
}

export async function updateDoc<T = any>(ref: DocumentReference<T>, updates: Record<string, any>): Promise<void> {
  const store = getCollectionStore(ref.collectionName);
  const current = store[ref.id] || {};

  const updated = { ...current };

  for (const [key, value] of Object.entries(updates)) {
    if (value && typeof value === 'object' && value._op === 'arrayUnion') {
      const existingArray: any[] = Array.isArray(updated[key]) ? updated[key] : [];
      const newItems = value.items as any[];
      const combined = [...existingArray];
      for (const item of newItems) {
        const exists = combined.some(existing => {
          if (typeof existing === 'object' && existing?.id && typeof item === 'object' && item?.id) {
            return existing.id === item.id;
          }
          return existing === item;
        });
        if (!exists) combined.push(item);
      }
      updated[key] = combined;
    } else if (value && typeof value === 'object' && value._op === 'arrayRemove') {
      const existingArray: any[] = Array.isArray(updated[key]) ? updated[key] : [];
      const removeItems = value.items as any[];
      updated[key] = existingArray.filter(existing => {
        return !removeItems.some(remove => {
          if (typeof existing === 'object' && existing?.id && typeof remove === 'object' && remove?.id) {
            return existing.id === remove.id;
          }
          return existing === remove;
        });
      });
    } else {
      updated[key] = value;
    }
  }

  store[ref.id] = updated;
  setCollectionStore(ref.collectionName, store);
}

export function arrayUnion(...items: any[]) {
  return { _op: 'arrayUnion', items };
}

export function arrayRemove(...items: any[]) {
  return { _op: 'arrayRemove', items };
}

export function onSnapshot<T = any>(
  target: Query<T> | DocumentReference<T>,
  callback: (snapshot: any) => void,
  _errorCallback?: (error: any) => void
): () => void {
  const collectionName = target.collectionName;

  if (!listeners.has(collectionName)) {
    listeners.set(collectionName, new Set());
  }

  const listenerEntry = { target, callback };
  listeners.get(collectionName)!.add(listenerEntry);

  try {
    if ('constraints' in target) {
      callback(getQuerySnapshotSync(target));
    } else {
      callback(getDocSnapshotSync(target));
    }
  } catch (e) {
    console.error('Error invoking onSnapshot initial callback:', e);
  }

  return () => {
    const set = listeners.get(collectionName);
    if (set) {
      set.delete(listenerEntry);
      if (set.size === 0) listeners.delete(collectionName);
    }
  };
}

export function getAllDatabaseCollectionsData(): Record<string, Record<string, any>> {
  const result: Record<string, Record<string, any>> = {};
  for (const cName of SYNC_COLLECTIONS) {
    result[cName] = { ...getCollectionStore(cName) };
  }
  return result;
}

export function restoreAllDatabaseCollectionsData(data: Record<string, Record<string, any>>) {
  for (const cName of SYNC_COLLECTIONS) {
    if (data[cName] && typeof data[cName] === 'object') {
      setCollectionStore(cName, data[cName]);
    }
  }
}

export function getRawCollectionStore(collectionName: string): Record<string, any> {
  return { ...getCollectionStore(collectionName) };
}

export function clearAllDatabaseData() {
  stopSync();
  memoryStore.clear();
  synced.clear();
  sinceMap.clear();
  for (const cName of SYNC_COLLECTIONS) {
    notifyCollectionListeners(cName);
  }
}
