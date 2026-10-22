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
}

export interface AdminPermissions {
  canChangeInfo: boolean;
  canDeleteMessages: boolean;
  canBanUsers: boolean;
  canInviteUsers: boolean;
  canPinMessages: boolean;
  canAddAdmins: boolean;
}

export interface Permissions {
  canSendMessages: boolean;
  canSendMedia: boolean;
  canAddUsers: boolean;
  canPinMessages: boolean;
  canChangeInfo: boolean;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  password?: string;
  avatar: string;
  status: 'online' | 'offline' | 'typing...';
  bio?: string;
  phone?: string;
  role?: 'superadmin' | 'admin' | 'user';
  isBanned?: boolean;
  bannedUntil?: number; // timestamp for temporary ban
  banReason?: string;
  twoFactorEnabled?: boolean;
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

export interface SystemConfig {
  allowGroupCreation: boolean;
  allowChannelCreation: boolean;
  allowStories: boolean;
}
