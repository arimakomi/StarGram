import { User, UserSession, SessionNotificationSettings } from '../types';
import { db, doc, setDoc, getDoc, getDocs, collection, deleteDoc, onSnapshot } from './database';
import { authApi } from './auth';

const CURRENT_SESSION_KEY = 'starly_current_session_id';
const LOCAL_SESSION_NOTIFS_KEY = 'starly_session_notif_prefs';

/**
 * Detects device hardware, OS, and browser from userAgent and client capabilities
 */
export function detectDeviceInfo(): {
  browser: string;
  os: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'web';
  deviceName: string;
} {
  if (typeof window === 'undefined') {
    return {
      browser: 'مرورگر وب',
      os: 'سیستم‌عامل نامشخص',
      deviceType: 'web',
      deviceName: 'وب کلاینت استارلی'
    };
  }

  const ua = navigator.userAgent;
  let browser = 'مرورگر مدرن';
  let os = 'سیستم‌عامل';
  let deviceType: 'desktop' | 'mobile' | 'tablet' | 'web' = 'desktop';

  // Browser detection
  if (ua.includes('SamsungBrowser')) {
    browser = 'سامسونگ اینترنت';
  } else if (ua.includes('Edg')) {
    browser = 'مایکروسافت اج';
  } else if (ua.includes('OPR') || ua.includes('Opera')) {
    browser = 'اوپرا';
  } else if (ua.includes('Firefox')) {
    browser = 'فایرفاکس';
  } else if (ua.includes('Chrome') && !ua.includes('Chromium')) {
    browser = 'گوگل کروم';
  } else if (ua.includes('Safari')) {
    browser = 'سافاری';
  }

  // OS detection
  if (ua.includes('Windows NT 10.0')) {
    os = 'ویندوز ۱۰ / ۱۱';
  } else if (ua.includes('Windows')) {
    os = 'ویندوز';
  } else if (ua.includes('Android')) {
    os = 'اندروید';
    deviceType = ua.includes('Tablet') ? 'tablet' : 'mobile';
  } else if (ua.includes('iPhone')) {
    os = 'iOS (آیفون)';
    deviceType = 'mobile';
  } else if (ua.includes('iPad')) {
    os = 'iPadOS (آیپد)';
    deviceType = 'tablet';
  } else if (ua.includes('Macintosh') || ua.includes('Mac OS X')) {
    os = 'macOS';
    deviceType = 'desktop';
  } else if (ua.includes('Linux')) {
    os = 'لینوکس';
    deviceType = 'desktop';
  }

  // Screen-size fallback heuristic
  if (deviceType === 'desktop' && window.innerWidth < 640) {
    deviceType = 'mobile';
  }

  const deviceName = `${browser} روی ${os}`;

  return { browser, os, deviceType, deviceName };
/**
 * Returns the stable ID for this browser tab / device session
 */
export function getCurrentSessionId(): string {
  let id = localStorage.getItem(CURRENT_SESSION_KEY);
  if (!id) {
    id = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(CURRENT_SESSION_KEY, id);
  }
  return id;
}

/**
 * Default notification settings for new sessions
 */
export const DEFAULT_SESSION_NOTIFICATIONS: SessionNotificationSettings = {
  enabled: true,
  previewText: true,
  sound: true
};

/**
 * Cache current session's notification preferences locally for zero-latency retrieval
 */
export function cacheLocalSessionNotifs(notifs: SessionNotificationSettings): void {
  try {
    localStorage.setItem(LOCAL_SESSION_NOTIFS_KEY, JSON.stringify(notifs));
  } catch {}
}

export function getCachedLocalSessionNotifs(): SessionNotificationSettings {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_NOTIFS_KEY);
    if (raw) return { ...DEFAULT_SESSION_NOTIFICATIONS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SESSION_NOTIFICATIONS;
}

/**
 * Initializes or updates current session in the database
 */
export async function initOrUpdateCurrentSession(user: User): Promise<UserSession> {
  const sessionId = getCurrentSessionId();
  const info = detectDeviceInfo();
  const cachedNotifs = getCachedLocalSessionNotifs();

  let existingSession: UserSession | null = null;
  try {
    const snap = await getDoc(doc(db, 'user_sessions', sessionId));
    if (snap.exists()) {
      existingSession = snap.data() as UserSession;
    }
  } catch (err) {
    console.warn('Could not check existing session:', err);
  }

  const now = Date.now();
  const notifications: SessionNotificationSettings = existingSession?.notifications
    ? { ...DEFAULT_SESSION_NOTIFICATIONS, ...existingSession.notifications }
    : cachedNotifs;

  let authSessionId = existingSession?.authSessionId;
  try {
    const result = await authApi.sessions();
    if (result.ok && result.success && Array.isArray(result.sessions)) {
      authSessionId = result.sessions.find((session: any) => session.current)?.id || authSessionId;
    }
  } catch (err) {
    console.warn('Could not link the device to its authenticated session:', err);
  }

  const sessionData: UserSession = {
    id: sessionId,
    ...(authSessionId ? { authSessionId } : {}),
    userId: user.id,
    deviceName: info.deviceName,
    browser: info.browser,
    os: info.os,
    deviceType: info.deviceType,
    createdAt: existingSession?.createdAt || now,
    lastActiveAt: now,
    notifications
  };

  try {
    await setDoc(doc(db, 'user_sessions', sessionId), sessionData);
    cacheLocalSessionNotifs(notifications);
  } catch (err) {
    console.error('Failed to register session to database:', err);
  }

  return { ...sessionData, isCurrent: true };
}

/**
 * Real-time subscription to all active sessions for a user
 */
export function subscribeUserSessions(
  userId: string,
  callback: (sessions: UserSession[], isCurrentTerminated: boolean) => void
): () => void {
  const currentId = getCurrentSessionId();

  const unsub = onSnapshot(collection(db, 'user_sessions'), (snapshot: any) => {
    const list: UserSession[] = [];
    let currentFound = false;

    snapshot.forEach((d: any) => {
      const data = d.data() as UserSession;
      if (data && data.userId === userId && data.id?.startsWith('sess_demo_')) {
        void deleteDoc(doc(db, 'user_sessions', data.id)).catch((err) => {
          console.warn('Could not remove an old demo session:', err);
        });
        return;
      }
      if (data && data.userId === userId) {
        const safeData = { ...data } as UserSession & { ipAddress?: string; location?: string };
        delete safeData.ipAddress;
        delete safeData.location;
        const isCurrent = data.id === currentId;
        if (isCurrent) {
          currentFound = true;
          // Synchronize cached notification settings
          if (data.notifications) {
            cacheLocalSessionNotifs(data.notifications);
          }
        }
        list.push({ ...safeData, isCurrent });
      }
    });

    // Sort: Current session first, then by last active timestamp descending
    list.sort((a, b) => {
      if (a.id === currentId) return -1;
      if (b.id === currentId) return 1;
      return (b.lastActiveAt || 0) - (a.lastActiveAt || 0);
    });

    callback(list, list.length > 0 && !currentFound);
  });

  return unsub;
}

/**
 * Updates notification configuration for a specific session
 */
export async function updateSessionNotifications(
  sessionId: string,
  notifs: Partial<SessionNotificationSettings>
): Promise<void> {
  const currentId = getCurrentSessionId();
  try {
    const snap = await getDoc(doc(db, 'user_sessions', sessionId));
    if (!snap.exists()) return;
    const existing = snap.data() as UserSession;
    const updatedNotifs: SessionNotificationSettings = {
      ...DEFAULT_SESSION_NOTIFICATIONS,
      ...(existing.notifications || {}),
      ...notifs
    };

    await setDoc(doc(db, 'user_sessions', sessionId), {
      ...existing,
      notifications: updatedNotifs,
      lastActiveAt: Date.now()
    });

    if (sessionId === currentId) {
      cacheLocalSessionNotifs(updatedNotifs);
    }
  } catch (err) {
    console.error('Error updating session notifications:', err);
    throw err;
  }
}

/**
 * Terminates (logs out) a specific session
 */
export async function terminateSession(sessionId: string): Promise<void> {
  try {
    const snapshot = await getDoc(doc(db, 'user_sessions', sessionId));
    if (snapshot.exists()) {
      const session = snapshot.data() as UserSession;
      if (session.authSessionId) {
        const result = await authApi.revokeSession(session.authSessionId);
        if (!result.ok || !result.success) throw new Error(result.message || 'Could not revoke the authenticated session.');
      }
    }
    await deleteDoc(doc(db, 'user_sessions', sessionId));
  } catch (err) {
    console.error('Failed to terminate session:', err);
    throw err;
  }
}

/**
 * Terminates all sessions for a user EXCEPT the current session
 */
export async function terminateOtherSessions(userId: string): Promise<number> {
  const currentId = getCurrentSessionId();
  try {
    const revokeResult = await authApi.revokeOtherSessions();
    if (!revokeResult.ok || !revokeResult.success) {
      throw new Error(revokeResult.message || 'Could not revoke other authenticated sessions.');
    }
    const snap = await getDocs(collection(db, 'user_sessions'));
    let terminatedCount = 0;
    const promises: Promise<any>[] = [];

    snap.forEach((d: any) => {
      const s = d.data() as UserSession;
      if (s && s.userId === userId && s.id !== currentId) {
        terminatedCount++;
        promises.push(deleteDoc(doc(db, 'user_sessions', s.id)));
      }
    });

    await Promise.all(promises);
    return terminatedCount;
  } catch (err) {
    console.error('Failed to terminate other sessions:', err);
    throw err;
  }
}
