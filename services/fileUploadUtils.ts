export const DEFAULT_MAX_UPLOAD_MB = 50;
export const MIN_MAX_UPLOAD_MB = 1;
export const MAX_MAX_UPLOAD_MB = 500;
export const UPLOAD_SLIDER_MIN_MB = MIN_MAX_UPLOAD_MB;
export const UPLOAD_SLIDER_MAX_MB = MAX_MAX_UPLOAD_MB;
export const UPLOAD_SLIDER_TICKS_MB = [1, 50, 100, 200, 300, 400, 500] as const;

export function normalizeMaxUploadMb(value: unknown, fallback: number = DEFAULT_MAX_UPLOAD_MB): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return fallback;
  }
  return Math.max(MIN_MAX_UPLOAD_MB, Math.min(MAX_MAX_UPLOAD_MB, Math.round(num * 10) / 10));
}

export function getUploadSliderPercentage(
  valueMb: unknown,
  minMb: number = UPLOAD_SLIDER_MIN_MB,
  maxMb: number = UPLOAD_SLIDER_MAX_MB
): number {
  const normalized = normalizeMaxUploadMb(valueMb, DEFAULT_MAX_UPLOAD_MB);
  const clamped = Math.max(minMb, Math.min(maxMb, normalized));
  if (maxMb <= minMb) return 0;
  return Math.round(((clamped - minMb) / (maxMb - minMb)) * 10000) / 100;
}

export function formatFileSize(bytes?: number | null): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export function estimateDataUrlDecodedBytes(dataUrlOrBase64?: string | null): number {
  if (!dataUrlOrBase64 || typeof dataUrlOrBase64 !== 'string') {
    return 0;
  }
  const trimmed = dataUrlOrBase64.trim();
  if (!trimmed) return 0;

  // If it's an SVG utf8 data URL or plain URL, return UTF-8 byte length if data:, else 0 for short URLs
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
    return 0;
  }

  const commaIndex = trimmed.indexOf(',');
  const base64Part = commaIndex !== -1 ? trimmed.slice(commaIndex + 1) : trimmed;
  if (commaIndex !== -1 && !trimmed.slice(0, commaIndex).includes(';base64')) {
    try {
      return new Blob([decodeURIComponent(base64Part)]).size;
    } catch {
      return base64Part.length;
    }
  }

  const cleanLen = base64Part.replace(/\s+/g, '').length;
  if (cleanLen === 0) return 0;
  let padding = 0;
  if (base64Part.endsWith('==')) padding = 2;
  else if (base64Part.endsWith('=')) padding = 1;

  return Math.max(0, Math.floor((cleanLen * 3) / 4) - padding);
}

export interface FileSizeValidationResult {
  valid: boolean;
  maxMb: number;
  maxBytes: number;
  fileSizeBytes: number;
  fileSizeMb: string;
  message?: string;
}

export function validateFileSize(
  fileSizeBytes: number,
  maxUploadSizeMb?: number | null
): FileSizeValidationResult {
  const maxMb = normalizeMaxUploadMb(maxUploadSizeMb, DEFAULT_MAX_UPLOAD_MB);
  const maxBytes = Math.floor(maxMb * 1024 * 1024);
  const safeBytes = Number.isFinite(fileSizeBytes) && fileSizeBytes > 0 ? fileSizeBytes : 0;
  const fileSizeMb = (safeBytes / (1024 * 1024)).toFixed(1);

  if (safeBytes > maxBytes) {
    return {
      valid: false,
      maxMb,
      maxBytes,
      fileSizeBytes: safeBytes,
      fileSizeMb,
      message: `حجم فایل انتخابی (${fileSizeMb} مگابایت) بیشتر از سقف مجاز تعیین‌شده توسط مدیر (${maxMb} مگابایت) است.`
    };
  }

  return {
    valid: true,
    maxMb,
    maxBytes,
    fileSizeBytes: safeBytes,
    fileSizeMb
  };
}

export type StorageCategoryKey = 'files' | 'images' | 'audio' | 'stories' | 'avatars';

export interface StorageCategoryStat {
  key: StorageCategoryKey;
  label: string;
  bytes: number;
  formattedSize: string;
  fileCount: number;
  percentageOfTotal: number;
  barHeightPercent: number;
}

export interface UserStorageStat {
  userId: string;
  username: string;
  displayName: string;
  avatar?: string;
  totalBytes: number;
  formattedSize: string;
  fileCount: number;
  percentageOfTotal: number;
  breakdown: {
    filesBytes: number;
    imagesBytes: number;
    audioBytes: number;
    storiesBytes: number;
    avatarsBytes: number;
  };
}

export interface StorageAnalyticsSummary {
  totalBytes: number;
  formattedTotalSize: string;
  totalFilesCount: number;
  uploadingUsersCount: number;
  categories: StorageCategoryStat[];
  topUsers: UserStorageStat[];
}

export interface StorageAnalyticsInput {
  users?: Record<string, any> | any[];
  chats?: Record<string, any> | any[];
  stories?: Record<string, any> | any[];
}

function normalizeCollectionToArray(col?: Record<string, any> | any[]): any[] {
  if (!col) return [];
  if (Array.isArray(col)) return col.filter(Boolean);
  if (typeof col === 'object') {
    return Object.entries(col)
      .filter(([, val]) => val && typeof val === 'object')
      .map(([key, val]) => ({ id: val.id || key, ...val }));
  }
  return [];
}

export function isCustomUploadedAvatar(dataUrl?: string | null): boolean {
  if (!dataUrl || typeof dataUrl !== 'string') return false;
  const trimmed = dataUrl.trim();
  if (!trimmed) return false;
  // Auto-generated local SVG avatars use data:image/svg+xml;utf8,
  if (trimmed.startsWith('data:image/svg+xml;utf8,')) return false;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) return false;
  return estimateDataUrlDecodedBytes(trimmed) > 0;
}

export function calculateStorageAnalytics(input: StorageAnalyticsInput): StorageAnalyticsSummary {
  const usersArr = normalizeCollectionToArray(input.users);
  const chatsArr = normalizeCollectionToArray(input.chats);
  const storiesArr = normalizeCollectionToArray(input.stories);

  const userLookup = new Map<string, { id: string; username: string; displayName: string; avatar?: string }>();
  for (const u of usersArr) {
    if (!u || !u.id) continue;
    userLookup.set(String(u.id), {
      id: String(u.id),
      username: typeof u.username === 'string' && u.username ? u.username : String(u.id),
      displayName: typeof u.displayName === 'string' && u.displayName ? u.displayName : (u.username || String(u.id)),
      avatar: typeof u.avatar === 'string' ? u.avatar : undefined
    });
  }

  const userStatsMap = new Map<
    string,
    {
      userId: string;
      username: string;
      displayName: string;
      avatar?: string;
      totalBytes: number;
      fileCount: number;
      breakdown: {
        filesBytes: number;
        imagesBytes: number;
        audioBytes: number;
        storiesBytes: number;
        avatarsBytes: number;
      };
    }
  >();

  const ensureUserStat = (userId: string, fallbackName?: string, fallbackAvatar?: string) => {
    const cleanId = String(userId || 'unknown').trim() || 'unknown';
    let entry = userStatsMap.get(cleanId);
    if (!entry) {
      const known = userLookup.get(cleanId);
      entry = {
        userId: cleanId,
        username: known?.username || cleanId,
        displayName: known?.displayName || fallbackName || cleanId,
        avatar: known?.avatar || fallbackAvatar,
        totalBytes: 0,
        fileCount: 0,
        breakdown: {
          filesBytes: 0,
          imagesBytes: 0,
          audioBytes: 0,
          storiesBytes: 0,
          avatarsBytes: 0
        }
      };
      userStatsMap.set(cleanId, entry);
    } else {
      if (fallbackName && entry.displayName === entry.userId) {
        entry.displayName = fallbackName;
      }
      if (fallbackAvatar && !entry.avatar) {
        entry.avatar = fallbackAvatar;
      }
    }
    return entry;
  };

  const categoryTotals: Record<StorageCategoryKey, { bytes: number; count: number; label: string }> = {
    files: { bytes: 0, count: 0, label: 'فایل‌ها و اسناد' },
    images: { bytes: 0, count: 0, label: 'تصاویر گفتگو' },
    audio: { bytes: 0, count: 0, label: 'پیام‌های صوتی' },
    stories: { bytes: 0, count: 0, label: 'استوری‌ها' },
    avatars: { bytes: 0, count: 0, label: 'آواتارها و پروفایل' }
  };

  // 1. User Custom Avatars
  for (const u of usersArr) {
    if (!u || !u.id) continue;
    if (isCustomUploadedAvatar(u.avatar)) {
      const bytes = estimateDataUrlDecodedBytes(u.avatar);
      if (bytes > 0) {
        categoryTotals.avatars.bytes += bytes;
        categoryTotals.avatars.count += 1;
        const st = ensureUserStat(String(u.id), u.displayName, u.avatar);
        st.totalBytes += bytes;
        st.fileCount += 1;
        st.breakdown.avatarsBytes += bytes;
      }
    }
  }

  // 2. Chats: Group/Channel Avatars + Messages (Files, Images, Audio)
  const seenMessageKeys = new Set<string>();
  for (const chat of chatsArr) {
    if (!chat) continue;
    const chatId = String(chat.id || '');

    // Also populate userLookup from chat.participants if available
    if (Array.isArray(chat.participants)) {
      for (const p of chat.participants) {
        if (p && p.id && !userLookup.has(String(p.id))) {
          userLookup.set(String(p.id), {
            id: String(p.id),
            username: p.username || String(p.id),
            displayName: p.displayName || p.username || String(p.id),
            avatar: p.avatar
          });
        }
      }
    }

    if (isCustomUploadedAvatar(chat.groupAvatar)) {
      const avatarBytes = estimateDataUrlDecodedBytes(chat.groupAvatar);
      if (avatarBytes > 0) {
        categoryTotals.avatars.bytes += avatarBytes;
        categoryTotals.avatars.count += 1;
        if (chat.adminId) {
          const st = ensureUserStat(String(chat.adminId));
          st.totalBytes += avatarBytes;
          st.fileCount += 1;
          st.breakdown.avatarsBytes += avatarBytes;
        }
      }
    }

    const messages = Array.isArray(chat.messages) ? chat.messages : [];
    for (const msg of messages) {
      if (!msg) continue;
      const msgKey = `${chatId}:${msg.id || ''}`;
      if (msg.id && seenMessageKeys.has(msgKey)) continue;
      if (msg.id) seenMessageKeys.add(msgKey);

      const senderId = String(msg.senderId || 'unknown');
      const explicitFileSize =
        typeof msg.fileSize === 'number' && Number.isFinite(msg.fileSize) && msg.fileSize > 0
          ? msg.fileSize
          : 0;
      const hasExplicitDocument = Boolean(msg.fileUrl || msg.fileName);

      // File / Document attachment (do NOT double-count when fileSize is set on a voice/image-only message)
      if (hasExplicitDocument || (!msg.imageUrl && !msg.audioUrl && explicitFileSize > 0)) {
        const decodedFileBytes = msg.fileUrl ? estimateDataUrlDecodedBytes(msg.fileUrl) : 0;
        const fileBytes = explicitFileSize > 0 ? explicitFileSize : decodedFileBytes;
        if (fileBytes > 0) {
          categoryTotals.files.bytes += fileBytes;
          categoryTotals.files.count += 1;
          const st = ensureUserStat(senderId);
          st.totalBytes += fileBytes;
          st.fileCount += 1;
          st.breakdown.filesBytes += fileBytes;
        }
      }

      // Image attachment
      if (msg.imageUrl) {
        const decodedImageBytes = estimateDataUrlDecodedBytes(msg.imageUrl);
        const imageBytes =
          decodedImageBytes > 0
            ? decodedImageBytes
            : !hasExplicitDocument && !msg.audioUrl
              ? explicitFileSize
              : 0;
        if (imageBytes > 0) {
          categoryTotals.images.bytes += imageBytes;
          categoryTotals.images.count += 1;
          const st = ensureUserStat(senderId);
          st.totalBytes += imageBytes;
          st.fileCount += 1;
          st.breakdown.imagesBytes += imageBytes;
        }
      }

      // Audio / Voice attachment
      if (msg.audioUrl) {
        const decodedAudioBytes = estimateDataUrlDecodedBytes(msg.audioUrl);
        const audioBytes =
          decodedAudioBytes > 0
            ? decodedAudioBytes
            : !hasExplicitDocument
              ? explicitFileSize
              : 0;
        if (audioBytes > 0) {
          categoryTotals.audio.bytes += audioBytes;
          categoryTotals.audio.count += 1;
          const st = ensureUserStat(senderId);
          st.totalBytes += audioBytes;
          st.fileCount += 1;
          st.breakdown.audioBytes += audioBytes;
        }
      }
    }
  }

  // 3. Stories
  const seenStoryIds = new Set<string>();
  for (const story of storiesArr) {
    if (!story) continue;
    if (story.id && seenStoryIds.has(String(story.id))) continue;
    if (story.id) seenStoryIds.add(String(story.id));

    const mediaUrl = story.mediaUrl || story.imageUrl;
    const storyBytes = estimateDataUrlDecodedBytes(mediaUrl);
    if (storyBytes > 0) {
      categoryTotals.stories.bytes += storyBytes;
      categoryTotals.stories.count += 1;
      const st = ensureUserStat(String(story.userId || 'unknown'), story.userName, story.userAvatar);
      st.totalBytes += storyBytes;
      st.fileCount += 1;
      st.breakdown.storiesBytes += storyBytes;
    }
  }

  const categoryOrder: StorageCategoryKey[] = ['files', 'images', 'audio', 'stories', 'avatars'];
  const totalBytes = categoryOrder.reduce((sum, key) => sum + categoryTotals[key].bytes, 0);
  const totalFilesCount = categoryOrder.reduce((sum, key) => sum + categoryTotals[key].count, 0);
  const maxCategoryBytes = Math.max(...categoryOrder.map((k) => categoryTotals[k].bytes), 0);

  const categories: StorageCategoryStat[] = categoryOrder.map((key) => {
    const item = categoryTotals[key];
    const percentageOfTotal = totalBytes > 0 ? Math.round((item.bytes / totalBytes) * 1000) / 10 : 0;
    const barHeightPercent =
      maxCategoryBytes > 0 && item.bytes > 0
        ? Math.max(8, Math.round((item.bytes / maxCategoryBytes) * 100))
        : 0;
    return {
      key,
      label: item.label,
      bytes: item.bytes,
      formattedSize: formatFileSize(item.bytes),
      fileCount: item.count,
      percentageOfTotal,
      barHeightPercent
    };
  });

  const activeUsers = Array.from(userStatsMap.values()).filter((u) => u.totalBytes > 0);
  activeUsers.sort((a, b) => {
    if (b.totalBytes !== a.totalBytes) return b.totalBytes - a.totalBytes;
    if (b.fileCount !== a.fileCount) return b.fileCount - a.fileCount;
    return a.userId.localeCompare(b.userId);
  });

  const topUsers: UserStorageStat[] = activeUsers.slice(0, 5).map((u) => {
    const known = userLookup.get(u.userId);
    const percentageOfTotal = totalBytes > 0 ? Math.round((u.totalBytes / totalBytes) * 1000) / 10 : 0;
    return {
      userId: u.userId,
      username: known?.username || u.username,
      displayName: known?.displayName || u.displayName,
      avatar: known?.avatar || u.avatar,
      totalBytes: u.totalBytes,
      formattedSize: formatFileSize(u.totalBytes),
      fileCount: u.fileCount,
      percentageOfTotal,
      breakdown: u.breakdown
    };
  });

  return {
    totalBytes,
    formattedTotalSize: formatFileSize(totalBytes),
    totalFilesCount,
    uploadingUsersCount: activeUsers.length,
    categories,
    topUsers
  };
}

