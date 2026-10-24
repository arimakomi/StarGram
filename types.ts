import { DEFAULT_LOCAL_AVATAR } from './services/avatarGenerator';

export const DEFAULT_AVATAR = DEFAULT_LOCAL_AVATAR;

export interface Reaction {
  emoji: string;
  count: number;
  users: string[];
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // User IDs
}

export interface Poll {
  question: string;
  options: PollOption[];
  isMultipleChoice: boolean;
  totalVotes: number;
}

export interface MessageSeenInfo {
  userId: string;
  seenAt: number;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  isAi?: boolean;
  replyToId?: string;
  isEdited?: boolean;
  reactions?: Reaction[];
  imageUrl?: string;
  audioUrl?: string;
  poll?: Poll;
  isRead?: boolean;
  forwardedFrom?: string;
  isEncrypted?: boolean;
  encryptedIv?: string;
  encryptedPayload?: string;
  seenBy?: MessageSeenInfo[];
  viewsCount?: number;
  viewers?: string[];
}

export interface AdminPermissions {
  canChangeInfo: boolean;
  canDeleteMessages: boolean;
  canBanUsers: boolean;
  canInviteUsers: boolean;
  canPinMessages: boolean;
  canAddAdmins: boolean;
  canPostMessages?: boolean;
  canEditMessages?: boolean;
  canManageStories?: boolean;
  customTitle?: string;
}

export interface Permissions {
  canSendMessages: boolean;
  canSendMedia: boolean;
  canSendVoice?: boolean;
  canSendPolls?: boolean;
  canEmbedLinks?: boolean;
  canAddUsers: boolean;
  canPinMessages: boolean;
  canChangeInfo: boolean;
}

export interface InviteLinkItem {
  id: string;
  link: string;
  title?: string;
  createdAt: number;
  creatorId?: string;
  creatorName?: string;
  expiresAt?: number;
  usageLimit?: number;
  usageCount?: number;
  isRevoked?: boolean;
}

export interface RemovedUserItem {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  removedAt: number;
  removedByName?: string;
  reason?: string;
}

export interface RecentActionItem {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  title: string;
  details?: string;
  timestamp: number;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  password?: string;
  avatar: string;
  status: 'online' | 'offline' | 'typing...';
  lastSeen?: number;
  bio?: string;
  phone?: string;
  birthday?: string;
  telegramId?: string;
  instagramId?: string;
  role?: 'superadmin' | 'admin' | 'user';
  isBanned?: boolean;
  bannedUntil?: number; // timestamp for temporary ban
  banReason?: string;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  passcode?: string;
  theme: 'day' | 'night' | 'oled' | 'arctic';
  wallpaper: string;
  contacts?: string[];
  privacy: {
    showStatus: 'all' | 'contacts' | 'none';
    showAvatar: 'all' | 'contacts' | 'none';
  };
}

export interface Chat {
  id: string;
  type: 'private' | 'group' | 'channel' | 'saved' | 'bot';
  participants: User[];
  messages: Message[];
  lastMessage?: Message;
  pinnedMessageIds: string[];
  isPinnedInSidebar?: boolean;
  isArchived?: boolean;
  isMuted?: boolean;
  isSecret?: boolean; // E2EE secret chat
  isLockedByAdmin?: boolean; // Locked by super admin
  deletedForUserIds?: string[];
  clearedAt?: Record<string, number>; // Timestamps per user when history was cleared/deleted
  unreadCount: number;
  groupName?: string;
  groupAvatar?: string;
  description?: string;
  adminId?: string;
  admins?: Record<string, AdminPermissions>;
  permissions?: Permissions;
  inviteLink?: string;
  isPublic?: boolean;
  publicHandle?: string;
  slowMode?: number;
  participantIds?: string[];
  wallpaper?: string;
  reactionsSetting?: 'all' | 'some' | 'off';
  allowedReactions?: string[];
  inviteLinksList?: InviteLinkItem[];
  recentActions?: RecentActionItem[];
  signMessages?: boolean;
  showAuthorsProfiles?: boolean;
  removedUsersList?: RemovedUserItem[];
}

export type FolderType = 'all' | 'private' | 'groups' | 'channels' | 'saved';

export interface Story {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  mediaUrl: string; // Base64 data URL
  mediaType?: 'image' | 'video' | 'text';
  durationSeconds?: number;
  caption?: string;
  timestamp: number;
  expiresAt: number;
  viewers: string[]; // User IDs who viewed
}

export interface MessageReport {
  id: string;
  reporterId: string;
  reporterName: string;
  reportedUserId: string;
  reportedUserName: string;
  chatId: string;
  messageId: string;
  messageText: string;
  reason: string;
  timestamp: number;
  status: 'pending' | 'resolved' | 'dismissed';
}

export interface ApiToken {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: number;
  lastUsedAt?: number;
  expiresAt?: number;
  scopes?: string[];
  createdBy?: string;
  createdByName?: string;
  token?: string; // Only present on creation for user copy
}

export interface SystemConfig {
  allowRegistration?: boolean;
  allowGroupCreation?: boolean;
  allowChannelCreation?: boolean;
  allowPublicChannels?: boolean;
  allowStories?: boolean;
  defaultUserRole?: 'user' | string;
  geminiApiKey?: string;
  geminiEnabled?: boolean;
  geminiProxyUrl?: string;
  geminiModel?: string;

  // Branding & Identity Customization
  appName?: string;
  appSlogan?: string;
  welcomeMessage?: string;
  loginBannerUrl?: string;
  customLogoUrl?: string;
  customSymbolUrl?: string;
  accentColor?: string;
}

export interface SessionNotificationSettings {
  enabled: boolean;          // دریافت اعلان دسکتاپ/وب روی این نشست
  previewText: boolean;      // نمایش متن پیام در اعلان
  sound: boolean;            // پخش صدای زنگ روی این نشست
  muteUntil?: number;        // زمان پایان بی‌صدا بودن موقت (میلی‌ثانیه)
}

export interface UserSession {
  id: string;                // شناسه یکتای نشست
  authSessionId?: string;    // شناسه لغو نشست احراز هویت سرور
  userId: string;            // شناسه کاربر مالک
  deviceName: string;        // نام کامل دستگاه (مثال: Chrome روی Windows 11)
  browser: string;           // نام مرورگر
  os: string;                // سیستم‌عامل
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'web';
  createdAt: number;         // زمان ورود اولیه
  lastActiveAt: number;      // آخرین فعالیت
  isCurrent?: boolean;       // آیا کلاینت کنونی است؟
  notifications: SessionNotificationSettings; // تنظیمات اعلان مستقل این نشست
}
