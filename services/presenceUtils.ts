import { User } from '../types';

/**
 * Calculates user presence status and friendly Persian label based on heartbeat / lastSeen
 */
export function getUserPresence(user?: Partial<User> | null, viewerIsContact: boolean = true): {
  isOnline: boolean;
  label: string;
} {
  if (!user) {
    return { isOnline: false, label: 'آفلاین' };
  }

  // If user has explicitly logged out
  if (user.status === 'offline') {
    if (!user.lastSeen) {
      return { isOnline: false, label: 'آفلاین' };
    }
  }

  // Check privacy settings
  const privacy = user.privacy?.showStatus || 'all';
  if (privacy === 'none' || (privacy === 'contacts' && !viewerIsContact)) {
    return { isOnline: false, label: 'آخرین بازدید به تازگی' };
  }

  const lastSeen = user.lastSeen;
  if (!lastSeen) {
    return { isOnline: false, label: 'آخرین بازدید به تازگی' };
  }

  const now = Date.now();
  const diffMs = now - lastSeen;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);

  // Online threshold: active within the last 60 seconds and NOT explicitly offline
  if (user.status !== 'offline' && diffSec <= 60) {
    return { isOnline: true, label: 'آنلاین' };
  }

  if (diffMin < 60) {
    const mins = Math.max(1, diffMin);
    return { isOnline: false, label: `آخرین بازدید ${mins} دقیقه پیش` };
  }

  const lastSeenDate = new Date(lastSeen);
  const nowDate = new Date(now);
  const isToday =
    lastSeenDate.getDate() === nowDate.getDate() &&
    lastSeenDate.getMonth() === nowDate.getMonth() &&
    lastSeenDate.getFullYear() === nowDate.getFullYear();

  const timeStr = lastSeenDate.toLocaleTimeString('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  if (isToday) {
    return { isOnline: false, label: `آخرین بازدید امروز در ${timeStr}` };
  }

  const yesterday = new Date(now);
  yesterday.setDate(nowDate.getDate() - 1);
  const isYesterday =
    lastSeenDate.getDate() === yesterday.getDate() &&
    lastSeenDate.getMonth() === yesterday.getMonth() &&
    lastSeenDate.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return { isOnline: false, label: `آخرین بازدید دیروز در ${timeStr}` };
  }

  if (diffHours < 24 * 7) {
    const days = Math.floor(diffHours / 24);
    return { isOnline: false, label: `آخرین بازدید ${days} روز پیش` };
  }

  return { isOnline: false, label: 'آخرین بازدید خیلی وقت پیش' };
}

/**
 * Formats timestamp for group "seen by" member row
 */
export function formatSeenTime(timestamp: number): string {
  if (!timestamp) return '';
  const now = Date.now();
  const diffSec = Math.floor((now - timestamp) / 1000);
  if (diffSec < 60) return 'همین الان';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} دقیقه پیش`;
  const date = new Date(timestamp);
  return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false });
}
