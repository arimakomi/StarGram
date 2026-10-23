export const APP_PREFERENCES_CHANGED = 'stargram:preferences-changed';

export const PREFERENCE_KEYS = {
  fontSize: 'starchat_font_size',
  bubbleRoundness: 'starchat_bubble_style',
  soundEnabled: 'starly_sound_enabled',
  previewTextEnabled: 'starly_notif_preview',
  autoDownloadPhotos: 'starchat_auto_photos',
  autoDownloadVoice: 'starchat_auto_voice',
  sendOnEnter: 'starchat_send_on_enter',
  autoScroll: 'starchat_auto_scroll'
} as const;

export function readPreference(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function readBooleanPreference(key: string, fallback = true): boolean {
  return readPreference(key, fallback ? 'true' : 'false') !== 'false';
}

export function writePreference(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preferences are best-effort when browser storage is disabled or full.
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(APP_PREFERENCES_CHANGED));
  }
}

export function applyAppearancePreferences(): void {
  if (typeof document === 'undefined') return;
  const fontSize = readPreference(PREFERENCE_KEYS.fontSize, '15px');
  const bubbleRoundness = readPreference(PREFERENCE_KEYS.bubbleRoundness, '1rem');
  document.documentElement.style.setProperty('--chat-font-size', fontSize);
  document.documentElement.style.setProperty('--message-bubble-radius', bubbleRoundness);
}
