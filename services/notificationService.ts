/**
 * High-fidelity notification service for StarGram
 * Uses Web Audio API for zero-dependency synthesized audio chime
 * Uses Web Notifications API for mobile/desktop browser background alerts
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Play a sleek, pleasant dual-tone chime (Telegram style)
 */
export function playNotificationSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Tone 1: 880Hz (A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1175, now + 0.12);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.28);

    // Tone 2: 1320Hz (E6) harmony chime
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, now + 0.07);

    gain2.gain.setValueAtTime(0.001, now + 0.07);
    gain2.gain.linearRampToValueAtTime(0.16, now + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.07);
    osc2.stop(now + 0.38);
  } catch (err) {
    console.warn('Could not play synthesized notification chime:', err);
  }
}

/**
 * Request desktop/mobile notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  if (Notification.permission === 'default') {
    try {
      return await Notification.requestPermission();
    } catch {
      return Notification.permission;
    }
  }
  return Notification.permission;
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function isNotificationGranted(): boolean {
  return isNotificationSupported() && Notification.permission === 'granted';
}

export function getNotificationPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Dispatch desktop / mobile web notification
 */
export function sendDesktopNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: any;
    onClick?: () => void;
  }
): void {
  if (!isNotificationGranted()) return;

  try {
    const notif = new Notification(title, {
      body: options?.body || '',
      icon: options?.icon || '/assets/icon-192.png',
      badge: options?.badge,
      tag: options?.tag,
      dir: 'rtl',
      lang: 'fa',
      silent: true // We play our own synchronized synthesized chime
    });

    if (options?.onClick) {
      notif.onclick = () => {
        window.focus();
        options.onClick?.();
        notif.close();
      };
    }

    setTimeout(() => notif.close(), 5000);
  } catch (e) {
    console.warn('Notification display failed:', e);
  }
}

/**
 * Updates document title unread counter
 */
export function updateTabTitle(unreadCount: number): void {
  if (typeof document === 'undefined') return;
  const baseTitle = 'استارلی چت | StarGram';
  if (unreadCount > 0) {
    document.title = `(${unreadCount}) ${baseTitle}`;
  } else {
    document.title = baseTitle;
  }
}
