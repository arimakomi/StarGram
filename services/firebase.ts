import { DEFAULT_AVATAR } from '../types';
import { generateLocalAvatarSvg } from './avatarGenerator';

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
  name: 'starly-chat-db',
  version: 1
};

// Broadcast channel for multi-tab synchronization
const channel = typeof window !== 'undefined' && 'BroadcastChannel' in window 
  ? new BroadcastChannel('starly_chat_sync_channel')
  : null;

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

// Listen to other browser tabs
if (channel) {
  channel.onmessage = (event) => {
    if (event.data?.type === 'SYNC_COLLECTION' && event.data?.collectionName) {
      notifyCollectionListeners(event.data.collectionName);
    }
  };
}

// In-memory cache for ultra-fast access and quota fallback
const memoryStore = new Map<string, Record<string, any>>();

// LocalStorage helpers
function getCollectionStore(collectionName: string): Record<string, any> {
  if (memoryStore.has(collectionName)) {
    return memoryStore.get(collectionName)!;
  }
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`starly_db_${collectionName}`);
    if (!raw) {
      memoryStore.set(collectionName, {});
      return {};
    }
    const parsed = JSON.parse(raw);
    memoryStore.set(collectionName, parsed);
    return parsed;
  } catch (e) {
    console.error(`Error parsing collection ${collectionName}:`, e);
    const fallback = {};
    memoryStore.set(collectionName, fallback);
    return fallback;
  }
}

function setCollectionStore(collectionName: string, data: Record<string, any>) {
  // Always update memory store first so the app works instantaneously without lag
  memoryStore.set(collectionName, data);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`starly_db_${collectionName}`, JSON.stringify(data));
    } catch (e) {
      console.warn(`Storage quota exceeded for ${collectionName}. Data preserved in memory.`, e);
      // Attempt safe optimization if quota exceeded: remove heavy audio/base64 from older items
      try {
        const lightweightCopy: Record<string, any> = {};
        for (const [k, v] of Object.entries(data)) {
          if (v && v.messages && Array.isArray(v.messages)) {
            // Keep recent 30 messages in localStorage to fit within limits
            lightweightCopy[k] = {
              ...v,
              messages: v.messages.slice(-30)
            };
          } else {
            lightweightCopy[k] = v;
          }
        }
        localStorage.setItem(`starly_db_${collectionName}`, JSON.stringify(lightweightCopy));
      } catch (err) {
        // Safe silent fallback - memoryStore holds the true state
      }
    }
    notifyCollectionListeners(collectionName);
    channel?.postMessage({ type: 'SYNC_COLLECTION', collectionName });
  }
}

// Seed initial data if not present
function initSeedData() {
  if (typeof window === 'undefined') return;
  
  // Seed Users
  const users = getCollectionStore('users');
  let usersModified = false;

  // Scrub any external URLs (ui-avatars, unsplash, etc.) from existing stored users
  for (const k of Object.keys(users)) {
    const u = users[k];
    if (!u.avatar || u.avatar.includes('http://') || u.avatar.includes('https://')) {
      u.avatar = generateLocalAvatarSvg(u.displayName || u.username, u.id);
      usersModified = true;
    }
    if (k === 'support' && u.role !== 'superadmin') {
      u.role = 'superadmin';
      usersModified = true;
    }
    if (!u.phone) {
      u.phone = k === 'support' ? '+98 912 000 0001' : `+98 912 ${Math.floor(1000000 + Math.random() * 9000000)}`;
      usersModified = true;
    }
  }

  if (Object.keys(users).length === 0) {
    const defaultUsers: Record<string, any> = {
      'starly_ai': {
        id: 'ai-assistant',
        username: 'starly_ai',
        displayName: 'هوش مصنوعی استارلی',
        password: '123',
        avatar: generateLocalAvatarSvg('هوش مصنوعی استارلی', 'ai-assistant'),
        status: 'online',
        role: 'user',
        phone: '+98 900 111 2233',
        bio: 'دستیار هوشمند چت استارلی با هوش مصنوعی',
        theme: 'night',
        wallpaper: 'default',
        contacts: ['u_support', 'u_ali', 'u_sara'],
        privacy: { showStatus: 'all', showAvatar: 'all' }
      },
      'support': {
        id: 'u_support',
        username: 'support',
        displayName: 'پشتیبانی استارلی',
        password: '123',
        avatar: generateLocalAvatarSvg('پشتیبانی استارلی', 'u_support'),
        status: 'online',
        role: 'superadmin',
        phone: '+98 912 000 0001',
        bio: 'پشتیبانی رسمی استارلی چت',
        theme: 'night',
        wallpaper: 'default',
        contacts: ['u_ali', 'u_sara'],
        privacy: { showStatus: 'all', showAvatar: 'all' }
      },
      'ali': {
        id: 'u_ali',
        username: 'ali',
        displayName: 'علی رضایی',
        password: '123',
        avatar: generateLocalAvatarSvg('علی رضایی', 'u_ali'),
        status: 'online',
        role: 'user',
        phone: '+98 912 345 6789',
        bio: 'برنامه‌نویس وب و علاقه‌مند به تکنولوژی',
        theme: 'night',
        wallpaper: 'default',
        contacts: ['u_support', 'u_sara'],
        privacy: { showStatus: 'all', showAvatar: 'all' }
      },
      'sara': {
        id: 'u_sara',
        username: 'sara',
        displayName: 'سارا تهرانی',
        password: '123',
        avatar: generateLocalAvatarSvg('سارا تهرانی', 'u_sara'),
        status: 'online',
        role: 'user',
        phone: '+98 935 987 6543',
        bio: 'طراح رابط کاربری (UI/UX)',
        theme: 'night',
        wallpaper: 'default',
        contacts: ['u_support', 'u_ali'],
        privacy: { showStatus: 'all', showAvatar: 'all' }
      }
    };
    setCollectionStore('users', defaultUsers);
  } else if (usersModified) {
    setCollectionStore('users', users);
  }

  // Seed system configuration
  const sysConfig = getCollectionStore('system_config');
  if (!sysConfig['main']) {
    setCollectionStore('system_config', {
      main: {
        id: 'main',
        allowGroupCreation: true,
        allowChannelCreation: true,
        allowStories: true
      }
    });
  }

  // Seed sample stories (100% local SVG artwork)
  const stories = getCollectionStore('stories');
  if (Object.keys(stories).length === 0) {
    const sampleStorySvg = `data:image/svg+xml;utf8,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1e3c72"/><stop offset="100%" stop-color="#2a5298"/></linearGradient></defs><rect width="600" height="900" fill="url(#g)"/><circle cx="300" cy="400" r="120" fill="rgba(255,255,255,0.1)"/><text x="300" y="420" font-family="sans-serif" font-size="32" font-weight="bold" fill="#ffffff" text-anchor="middle">استارلی چت</text><text x="300" y="470" font-family="sans-serif" font-size="20" fill="rgba(255,255,255,0.8)" text-anchor="middle">سریع، امن و کاملاً آفلاین</text></svg>'
    )}`;

    setCollectionStore('stories', {
      'story_welcome': {
        id: 'story_welcome',
        userId: 'u_support',
        userName: 'پشتیبانی استارلی',
        userAvatar: generateLocalAvatarSvg('پشتیبانی استارلی', 'u_support'),
        mediaUrl: sampleStorySvg,
        caption: 'نسخه ارتقا یافته استارلی با رمزنگاری سرتاسری و پنل مدیریت فعال شد! ✨',
        timestamp: Date.now() - 3600000,
        expiresAt: Date.now() + 86400000,
        viewers: []
      }
    });
  }

  // Seed default chats (e.g. Official News Channel and Public Group)
  const chats = getCollectionStore('chats');
  let chatsModified = false;

  // Scrub external URLs from stored chats
  for (const cId of Object.keys(chats)) {
    const c = chats[cId];
    if (c.groupAvatar && (c.groupAvatar.includes('http://') || c.groupAvatar.includes('https://'))) {
      c.groupAvatar = generateLocalAvatarSvg(c.groupName || 'گروه', c.id);
      chatsModified = true;
    }
    if (Array.isArray(c.participants)) {
      c.participants.forEach((p: any) => {
        if (!p.avatar || p.avatar.includes('http://') || p.avatar.includes('https://')) {
          p.avatar = generateLocalAvatarSvg(p.displayName || p.username, p.id);
          chatsModified = true;
        }
      });
    }
  }

  if (Object.keys(chats).length === 0) {
    const newsChannelId = 'ch_starly_news';
    const publicGroupId = 'g_starly_general';
    const initialChats: Record<string, any> = {
      [newsChannelId]: {
        id: newsChannelId,
        type: 'channel',
        groupName: 'کانال رسمی استارلی',
        groupAvatar: generateLocalAvatarSvg('کانال رسمی استارلی', 'news'),
        description: 'کانال رسمی اخبار و بروزرسانی‌های پیام‌رسان استارلی',
        adminId: 'u_support',
        participants: [
          { id: 'u_support', username: 'support', displayName: 'پشتیبانی استارلی', avatar: generateLocalAvatarSvg('پشتیبانی استارلی', 'u_support'), status: 'online' }
        ],
        participantIds: ['ai-assistant', 'u_support', 'u_ali', 'u_sara'],
        messages: [
          {
            id: 'm_welcome_1',
            senderId: 'u_support',
            text: 'سلام به استارلی چت خوش آمدید! 🌟\nپیام‌رسان پرسرعت و مدرن با رمزنگاری سرتاسری E2EE.',
            timestamp: Date.now() - 3600000,
            isRead: true
          },
          {
            id: 'm_welcome_2',
            senderId: 'u_support',
            text: 'قابلیت‌های کلیدی:\n🔒 رمزنگاری سرتاسری (E2EE) با کلید AES-256\n📱 استوری‌های سبک تلگرام با نوار اختصاصی\n🛡️ پنل مدیریت ارشد کل پیام‌رسان\n👥 گزارش پیام‌ها و مدیریت تخلفات',
            timestamp: Date.now() - 1800000,
            isRead: true
          }
        ],
        lastMessage: {
          id: 'm_welcome_2',
          senderId: 'u_support',
          text: 'قابلیت‌های کلیدی:\n🔒 رمزنگاری سرتاسری (E2EE) با کلید AES-256...',
          timestamp: Date.now() - 1800000,
          isRead: true
        },
        pinnedMessageIds: ['m_welcome_1'],
        unreadCount: 0
      },
      [publicGroupId]: {
        id: publicGroupId,
        type: 'group',
        groupName: 'گروه گفتگوی عمومی',
        groupAvatar: generateLocalAvatarSvg('گروه گفتگوی عمومی', 'general'),
        description: 'محیطی برای گفتگو و تبادل نظر کاربران استارلی',
        adminId: 'u_support',
        participants: [
          { id: 'u_support', username: 'support', displayName: 'پشتیبانی استارلی', avatar: generateLocalAvatarSvg('پشتیبانی استارلی', 'u_support'), status: 'online' },
          { id: 'u_ali', username: 'ali', displayName: 'علی رضایی', avatar: generateLocalAvatarSvg('علی رضایی', 'u_ali'), status: 'online' }
        ],
        participantIds: ['ai-assistant', 'u_support', 'u_ali', 'u_sara'],
        messages: [
          {
            id: 'm_grp_1',
            senderId: 'u_ali',
            text: 'درود به همگی! سرعت و طراحی قالب تلگرام وب فوق‌العاده‌ست 👌',
            timestamp: Date.now() - 900000,
            isRead: true
          }
        ],
        lastMessage: {
          id: 'm_grp_1',
          senderId: 'u_ali',
          text: 'درود به همگی! سرعت و طراحی قالب تلگرام وب فوق‌العاده‌ست 👌',
          timestamp: Date.now() - 900000,
          isRead: true
        },
        pinnedMessageIds: [],
        unreadCount: 0
      }
    };
    setCollectionStore('chats', initialChats);
  } else if (chatsModified) {
    setCollectionStore('chats', chats);
  }
}

initSeedData();

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

// Exported Firestore-compatible functions
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
        // Prevent duplicate IDs or primitive duplicates
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

  // Immediate invoke
  try {
    if ('constraints' in target) {
      callback(getQuerySnapshotSync(target));
    } else {
      callback(getDocSnapshotSync(target));
    }
  } catch (e) {
    console.error('Error invoking onSnapshot initial callback:', e);
  }

  // Return unsubscribe
  return () => {
    const set = listeners.get(collectionName);
    if (set) {
      set.delete(listenerEntry);
      if (set.size === 0) listeners.delete(collectionName);
    }
  };
}
