import { Chat, Message, User } from '../types';
import { normalizeDigits } from './otpUtils';

export interface MatchedMessageResult {
  chat: Chat;
  message: Message;
  chatTitle: string;
  chatAvatar?: string;
  senderName: string;
  snippet: string;
  matchIndex: number;
}

export interface SidebarSearchResults {
  matchedChats: Chat[];
  matchedMessages: MatchedMessageResult[];
}

export function getChatDisplayTitle(chat: Chat, currentUserId: string): string {
  if (chat.type === 'saved') return 'پیام‌های ذخیره شده';
  if (chat.type === 'private') {
    const other = (chat.participants || []).find(p => p.id !== currentUserId);
    return other?.displayName || other?.username || 'کاربر';
  }
  return chat.groupName || 'گفتگو';
}

export function getChatDisplayAvatar(chat: Chat, currentUserId: string): string | undefined {
  if (chat.type === 'private') {
    const other = (chat.participants || []).find(p => p.id !== currentUserId);
    return other?.avatar;
  }
  return chat.groupAvatar;
}

/**
 * Builds a concise snippet around the matched query inside a message text.
 */
export function buildMessageSnippet(text: string, query: string, maxLen: number = 90): { snippet: string; matchIndex: number } {
  const cleanText = (text || '').replace(/\s+/g, ' ').trim();
  const normText = normalizeDigits(cleanText).toLowerCase();
  const normQuery = normalizeDigits(query.trim()).toLowerCase();
  const idx = normText.indexOf(normQuery);

  if (idx === -1 || cleanText.length <= maxLen) {
    return { snippet: cleanText, matchIndex: idx };
  }

  const contextBefore = Math.floor((maxLen - normQuery.length) / 2);
  const start = Math.max(0, idx - contextBefore);
  const end = Math.min(cleanText.length, start + maxLen);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < cleanText.length ? '…' : '';
  const snippet = `${prefix}${cleanText.slice(start, end)}${suffix}`;
  const newMatchIdx = idx - start + prefix.length;

  return { snippet, matchIndex: newMatchIdx };
}

/**
 * Filters a user's conversations and searches message contents in real-time.
 */
export function filterChatsAndMessages(
  chats: Chat[],
  rawQuery: string,
  currentUser: User
): SidebarSearchResults {
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return { matchedChats: [], matchedMessages: [] };
  }

  const qNorm = normalizeDigits(trimmed).toLowerCase();
  const qHandle = qNorm.replace(/^@/, '');

  const validChats = (chats || []).filter(
    c => !c.deletedForUserIds?.includes(currentUser.id)
  );

  const matchedChats: Chat[] = [];
  const matchedMessages: MatchedMessageResult[] = [];

  for (const chat of validChats) {
    const title = getChatDisplayTitle(chat, currentUser.id);
    const titleNorm = normalizeDigits(title).toLowerCase();
    let isChatMatch = titleNorm.includes(qNorm);

    if (!isChatMatch && chat.type === 'saved') {
      isChatMatch = 'saved messages'.includes(qNorm) || 'ذخیره'.includes(qNorm);
    }

    if (!isChatMatch && chat.type === 'private') {
      const other = (chat.participants || []).find(p => p.id !== currentUser.id);
      if (other) {
        const usernameMatch = Boolean(other.username && normalizeDigits(other.username).toLowerCase().includes(qHandle));
        const bioMatch = Boolean(other.bio && normalizeDigits(other.bio).toLowerCase().includes(qNorm));
        const phoneMatch = Boolean(other.phone && normalizeDigits(other.phone).includes(qNorm));
        isChatMatch = usernameMatch || bioMatch || phoneMatch;
      }
    }

    if (!isChatMatch && (chat.type === 'group' || chat.type === 'channel')) {
      const handleMatch = Boolean(chat.publicHandle && normalizeDigits(chat.publicHandle).toLowerCase().includes(qHandle));
      const descMatch = Boolean(chat.description && normalizeDigits(chat.description).toLowerCase().includes(qNorm));
      isChatMatch = handleMatch || descMatch;
    }

    if (isChatMatch) {
      matchedChats.push(chat);
    }

    // Search messages inside this chat (respecting clear history timestamp)
    const clearTime = chat.clearedAt?.[currentUser.id] || 0;
    const messages = chat.messages || [];
    for (const msg of messages) {
      if (msg.timestamp <= clearTime) continue;

      const searchableText = [
        msg.text || '',
        msg.poll?.question || '',
        ...(msg.poll?.options?.map(o => o.text) || []),
      ]
        .filter(Boolean)
        .join(' — ');

      if (!searchableText) continue;

      const normMsgText = normalizeDigits(searchableText).toLowerCase();
      if (normMsgText.includes(qNorm)) {
        const sender =
          msg.senderId === currentUser.id
            ? currentUser
            : (chat.participants || []).find(p => p.id === msg.senderId);
        const senderName =
          msg.senderId === currentUser.id
            ? 'شما'
            : sender?.displayName || sender?.username || (chat.type === 'channel' ? title : 'کاربر');
        const { snippet, matchIndex } = buildMessageSnippet(searchableText, trimmed);
        matchedMessages.push({
          chat,
          message: msg,
          chatTitle: title,
          chatAvatar: getChatDisplayAvatar(chat, currentUser.id),
          senderName,
          snippet,
          matchIndex,
        });
      }
    }
  }

  matchedChats.sort((a, b) => {
    if (a.isPinnedInSidebar && !b.isPinnedInSidebar) return -1;
    if (!a.isPinnedInSidebar && b.isPinnedInSidebar) return 1;
    return (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0);
  });

  matchedMessages.sort((a, b) => b.message.timestamp - a.message.timestamp);

  return { matchedChats, matchedMessages };
}
