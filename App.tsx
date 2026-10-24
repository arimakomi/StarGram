import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { User, Message, Chat, FolderType, DEFAULT_AVATAR, Story, SystemConfig, MessageReport } from './types';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SettingsModal from './components/SettingsModal';
import { MyProfileModal } from './components/MyProfileModal';
import { CreateStoryModal } from './components/CreateStoryModal';
import { StoryViewerModal } from './components/StoryViewerModal';
import { ReportModal } from './components/ReportModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { generateLocalAvatarSvg } from './services/avatarGenerator';
import { gemini } from './services/geminiService';
import { Lock, Send, Bell, Sparkles, BellRing, X } from 'lucide-react';
import { db, collection, query, where, onSnapshot, doc, updateDoc, setDoc, getDoc, getDocs, deleteDoc, arrayUnion, startSync, stopSync } from './services/database';
import { authApi, getToken } from './services/auth';
import { 
  playNotificationSound, sendDesktopNotification, updateTabTitle,
  requestNotificationPermission, isNotificationSupported, getNotificationPermissionStatus 
} from './services/notificationService';
import { applyAppearancePreferences, PREFERENCE_KEYS, readBooleanPreference } from './services/appPreferences';

const AI_BOT: User = {
  id: 'ai-assistant',
  username: 'starly_ai',
  displayName: 'هوش مصنوعی استارلی',
  avatar: DEFAULT_AVATAR,
  status: 'online',
  role: 'user',
  bio: 'دستیار هوشمند chat.starly.ir',
  theme: 'night',
  wallpaper: 'default',
  privacy: { showStatus: 'all', showAvatar: 'all' }
};

const SAVED_MESSAGES_ID = 'saved-messages';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    applyAppearancePreferences();
  }, []);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [activeFolder, setActiveFolder] = useState<FolderType>('all');
  const [showSettings, setShowSettings] = useState(false);
  
  // Stories & System Config
  const [stories, setStories] = useState<Story[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({
    allowGroupCreation: true,
    allowChannelCreation: true,
    allowStories: true
  });

  // Modals
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [viewingStory, setViewingStory] = useState<Story | null>(null);
  const [reportingMessage, setReportingMessage] = useState<Message | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  
  // App Lock & Entrance Splash State
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [lockInput, setLockInput] = useState('');
  const [showEntranceSplash, setShowEntranceSplash] = useState(false);
  const [inAppToast, setInAppToast] = useState<{ title: string; body: string; chatId: string } | null>(null);
  const lastKnownMsgTimeRef = useRef<number>(Date.now());

  // Automatic Notification Permission & Browser Settings Prompt
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(() => getNotificationPermissionStatus());
  const [dismissNotifBanner, setDismissNotifBanner] = useState(false);

  useEffect(() => {
    if (isNotificationSupported()) {
      // Auto prompt on startup
      if (Notification.permission === 'default') {
        requestNotificationPermission().then(perm => {
          setNotifPermission(perm);
          if (perm === 'granted') {
            playNotificationSound();
          }
        });
      } else {
        setNotifPermission(Notification.permission);
      }
    }

    const handleFocus = () => {
      const cur = getNotificationPermissionStatus();
      setNotifPermission(cur);
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // 1. Load User Session (اعتبارسنجی توکن روی سرور و دریافت داده‌ها از دیتابیس)
  const [booting, setBooting] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        if (getToken()) {
          const r = await authApi.me();
          if (r.success && r.user) {
            const user = r.user;
            if (!user.avatar || user.avatar.includes('http://') || user.avatar.includes('https://')) {
              user.avatar = generateLocalAvatarSvg(user.displayName || user.username, user.id);
            }
            await startSync();
            localStorage.setItem('starly_session_cloud', JSON.stringify(user));
            setCurrentUser(user);
            document.body.className = `${user.theme || 'night'}-theme`;
            if (user.passcode) setIsAppLocked(true);
            setShowEntranceSplash(true);
            setTimeout(() => setShowEntranceSplash(false), 1300);
          } else if (r.status === 401 || r.status === 403) {
            localStorage.removeItem('starly_session_cloud');
            await authApi.logout();
          }
        }
      } catch (e) { console.error(e); }
      finally { setBooting(false); }
    })();
  }, []);

  // Real-time presence heartbeat (updates lastSeen every 25s)
  useEffect(() => {
    if (!currentUser) return;
    authApi.heartbeat().catch(() => {});
    const interval = setInterval(() => {
      authApi.heartbeat().catch(() => {});
    }, 25000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        authApi.heartbeat().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [currentUser]);

  // 1.5 Real-time Users Map Sync for live presence & profile hydration
  const [liveUsersMap, setLiveUsersMap] = useState<Record<string, User>>({});

  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(collection(db, "users"), (snapshot: any) => {
      const map: Record<string, User> = {};
      snapshot.forEach((d: any) => {
        const u = d.data() as User;
        map[u.id] = u;
      });
      setLiveUsersMap(map);
    });
    return () => unsub();
  }, [currentUser]);

  // 2. Real-time Chats Sync
  useEffect(() => {
    if (!currentUser) return;
    
    const q = query(
      collection(db, "chats"), 
      where("participantIds", "array-contains", currentUser.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const syncedChats: Chat[] = [];
      snapshot.forEach((doc: any) => {
        syncedChats.push(doc.data() as Chat);
      });
      setChats(syncedChats.sort((a,b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0)));
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Incoming Message Notifications & Audio Chime
  useEffect(() => {
    if (!currentUser || chats.length === 0) return;
    const incomingList: { msg: Message; chat: Chat }[] = [];

    chats.forEach(c => {
      if (!c.lastMessage) return;
      const lm = c.lastMessage;
      if (lm.senderId !== currentUser.id && lm.timestamp > lastKnownMsgTimeRef.current) {
        incomingList.push({ msg: lm, chat: c });
      }
    });

    if (incomingList.length > 0) {
      incomingList.sort((a, b) => b.msg.timestamp - a.msg.timestamp);
      const newestIncoming = incomingList[0];
      lastKnownMsgTimeRef.current = newestIncoming.msg.timestamp;
      const isMuted = newestIncoming.chat.isMuted;
      if (!isMuted) {
        if (readBooleanPreference(PREFERENCE_KEYS.soundEnabled)) playNotificationSound();
        const chatTitle = newestIncoming.chat.type === 'private'
          ? (newestIncoming.chat.participants.find((p: User) => p.id === newestIncoming.msg.senderId)?.displayName || 'پیام جدید')
          : (newestIncoming.chat.groupName || 'گروه');
        
        sendDesktopNotification(chatTitle, {
          body: readBooleanPreference(PREFERENCE_KEYS.previewTextEnabled)
            ? (newestIncoming.msg.text || (newestIncoming.msg.imageUrl ? 'تصویر' : 'رسانه جدید'))
            : 'پیام جدید',
          onClick: () => setActiveChatId(newestIncoming.chat.id)
        });

        if (activeChatId !== newestIncoming.chat.id) {
          setInAppToast({
            title: chatTitle,
            body: newestIncoming.msg.text || (newestIncoming.msg.imageUrl ? 'تصویر' : 'رسانه جدید'),
            chatId: newestIncoming.chat.id
          });
          setTimeout(() => setInAppToast(null), 4000);
        }
      }
    }

    // Unread tab badge
    const totalUnread = chats.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
    updateTabTitle(totalUnread);
  }, [chats, currentUser, activeChatId]);

  // Auto-clear unreadCount when activeChatId is viewed
  useEffect(() => {
    if (!activeChatId) return;
    const current = chats.find(c => c.id === activeChatId);
    if (current && (current.unreadCount || 0) > 0) {
      const chatRef = doc(db, "chats", activeChatId);
      updateDoc(chatRef, { unreadCount: 0 });
    }
  }, [activeChatId, chats]);

  // 3. Real-time Stories Sync
  useEffect(() => {
    const q = collection(db, "stories");
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const list: Story[] = [];
      snapshot.forEach((d: any) => {
        list.push({ id: d.id, ...d.data() });
      });
      setStories(list);
    });
    return () => unsubscribe();
  }, []);

  // 3.5 Join Link & Invite Token Resolver Hook
  const [joinTargetChat, setJoinTargetChat] = useState<Chat | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  // Account Deletion Handler
  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    try {
      await authApi.deleteAccount();
    } catch (e) {
      console.warn('Delete account error:', e);
    }

    try {
      await deleteDoc(doc(db, 'users', currentUser.id));
    } catch {}

    stopSync();
    try {
      localStorage.removeItem('starly_token');
      localStorage.removeItem('starly_current_user');
      localStorage.removeItem('starly_session_cloud');
      sessionStorage.clear();
    } catch {}

    setCurrentUser(null);
    setActiveChatId(null);
    setShowSettings(false);
    alert('حساب کاربری شما با موفقیت به طور کامل حذف شد.');
  };

  // Global ESC Key Listener: close open modals or return to main welcome view
  useEffect(() => {
    const handleGlobalEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSettings) { setShowSettings(false); return; }
        if (showMyProfile) { setShowMyProfile(false); return; }
        if (showAdminPanel) { setShowAdminPanel(false); return; }
        if (viewingStory) { setViewingStory(null); return; }
        if (showCreateStory) { setShowCreateStory(false); return; }
        if (reportingMessage) { setReportingMessage(null); return; }
        if (joinTargetChat) { setJoinTargetChat(null); return; }
        if (activeChatId) {
          setActiveChatId(null);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalEsc);
    return () => window.removeEventListener('keydown', handleGlobalEsc);
  }, [showSettings, showMyProfile, showAdminPanel, viewingStory, showCreateStory, reportingMessage, joinTargetChat, activeChatId]);


  const resolveJoinFromUrl = useCallback(async () => {
    if (!currentUser) return;
    const path = window.location.pathname;
    const hash = window.location.hash;
    const search = new URLSearchParams(window.location.search);

    let joinToken: string | null = null;
    let handle: string | null = null;

    if (path.startsWith('/join/')) {
      joinToken = decodeURIComponent(path.slice(6)).trim();
    } else if (path.startsWith('/@')) {
      handle = decodeURIComponent(path.slice(2)).trim();
    } else if (hash.includes('/join/')) {
      joinToken = decodeURIComponent(hash.split('/join/')[1]).trim();
    } else if (search.get('join')) {
      joinToken = search.get('join')!.trim();
    }

    if (!joinToken && !handle) return;

    try {
      const allChatsSnap = await getDocs(collection(db, "chats"));
      let target: Chat | null = null;
      allChatsSnap.forEach((docSnap: any) => {
        const c = docSnap.data() as Chat;
        if (handle && c.publicHandle && c.publicHandle.toLowerCase() === handle.toLowerCase()) {
          target = c;
        } else if (joinToken) {
          if (c.inviteLink && c.inviteLink.includes(joinToken)) {
            target = c;
          } else if (c.id.endsWith(joinToken) || c.id.includes(joinToken)) {
            target = c;
          }
        }
      });

      if (target) {
        setJoinTargetChat(target);
      }
    } catch (err) {
      console.error('Error resolving join link:', err);
    }
  }, [currentUser]);

  useEffect(() => {
    resolveJoinFromUrl();
    window.addEventListener('popstate', resolveJoinFromUrl);
    return () => window.removeEventListener('popstate', resolveJoinFromUrl);
  }, [resolveJoinFromUrl]);

    // 4. Real-time System Config Sync
  useEffect(() => {
    const q = collection(db, "system_config");
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      snapshot.forEach((d: any) => {
        if (d.id === 'main') {
          setSystemConfig(d.data() as SystemConfig);
        }
      });
    });
    return () => unsubscribe();
  }, []);

  const handleJoinChat = async (targetChat: Chat) => {
    if (!currentUser) return;
    setIsJoining(true);
    try {
      const chatRef = doc(db, "chats", targetChat.id);
      const isAlreadyMember = targetChat.participantIds?.includes(currentUser.id);
      if (!isAlreadyMember) {
        await updateDoc(chatRef, {
          participants: arrayUnion(currentUser),
          participantIds: arrayUnion(currentUser.id),
          deletedForUserIds: (targetChat.deletedForUserIds || []).filter(id => id !== currentUser.id)
        });
      }
      setActiveChatId(targetChat.id);
      setJoinTargetChat(null);
      window.history.replaceState({}, '', '/');
    } catch (e) {
      console.error('Failed to join chat:', e);
      alert('خطا در پیوستن به گفتگو. لطفاً دوباره تلاش کنید.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleAuth = async (user: User) => {
    setShowEntranceSplash(true);
    await startSync();
    setCurrentUser(user);
    document.body.className = `${user.theme}-theme`;
    setTimeout(() => {
      setShowEntranceSplash(false);
    }, 1500);
  };

  const handleUnlock = (code: string) => {
    if (code === currentUser?.passcode) {
      setIsAppLocked(false);
      setLockInput('');
    } else {
      setTimeout(() => setLockInput(''), 300);
    }
  };

  const createChatInFirestore = async (newChat: Chat) => {
     // Helper to ensure we can query it later
     const chatData = {
        ...newChat,
        participantIds: newChat.participants.map(p => p.id)
     };
     await setDoc(doc(db, "chats", newChat.id), chatData);
  };

  const handleUsernameClick = async (rawUsername: string) => {
    const cleanUsername = rawUsername.replace('@', '').trim().toLowerCase();
    if (!currentUser || cleanUsername === currentUser.username.toLowerCase()) return;
    try {
      const q = query(collection(db, "users"), where("username", "==", cleanUsername));
      const snap = await getDocs(q);
      let targetUser: User | null = null;
      snap.forEach((docSnap: any) => {
        targetUser = docSnap.data() as User;
      });
      if (targetUser) {
        const u = targetUser as User;
        const existing = chats.find(c => c.type === 'private' && c.participantIds?.includes(u.id));
        if (existing) {
          setActiveChatId(existing.id);
        } else {
          const newChat: Chat = { 
            id: `c_${Date.now()}`, type: 'private', 
            participants: [currentUser, u], 
            participantIds: [currentUser.id, u.id],
            messages: [], pinnedMessageIds: [], unreadCount: 0 
          };
          await createChatInFirestore(newChat);
          setActiveChatId(newChat.id);
        }
      } else {
        alert(`کاربر @${cleanUsername} یافت نشد.`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMessageAction = async (action: string, payload: any) => {
    if (!currentUser || !activeChatId) return;

    if (activeChatId === AI_BOT.id) {
       return handleAiMessage(payload);
    }

    const chatRef = doc(db, "chats", activeChatId);

    try {
      switch(action) {
        case 'send': {
          const activeChat = chats.find(c => c.id === activeChatId);
          const isChannel = activeChat?.type === 'channel';
          const msg: Message = {
            id: `m_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
            senderId: currentUser.id,
            text: payload.text || '',
            imageUrl: payload.imageUrl,
            audioUrl: payload.audioUrl,
            replyToId: payload.replyToId,
            poll: payload.poll,
            forwardedFrom: payload.forwardedFrom,
            timestamp: Date.now(),
            isRead: false,
            isEncrypted: payload.isEncrypted,
            encryptedIv: payload.encryptedIv,
            encryptedPayload: payload.encryptedPayload,
            seenBy: [{ userId: currentUser.id, seenAt: Date.now() }],
            viewsCount: isChannel ? 1 : undefined,
            viewers: isChannel ? [currentUser.id] : undefined
          };
          
          await updateDoc(chatRef, {
            messages: arrayUnion(msg),
            lastMessage: msg,
            deletedForUserIds: [], // Resets deleted status so chat returns to sidebar for everyone!
            unreadCount: 0
          });
          break;
        }

        case 'updateChatWallpaper':
          await updateDoc(chatRef, { wallpaper: payload.wallpaper || '' });
          break;

        case 'markSeen': {
          const chatDoc = await getDoc(chatRef);
          if (chatDoc.exists()) {
            const chatData = chatDoc.data() as Chat;
            const ids: string[] = payload.messageIds || [];
            if (ids.length === 0) break;
            const now = Date.now();
            let changed = false;
            const newMessages = (chatData.messages || []).map(m => {
              if (ids.includes(m.id)) {
                changed = true;
                const curSeen = m.seenBy || [];
                const already = curSeen.some(s => s.userId === currentUser.id);
                const updatedSeen = already ? curSeen : [...curSeen, { userId: currentUser.id, seenAt: now }];

                const viewers = m.viewers || [];
                const updatedViewers = viewers.includes(currentUser.id) ? viewers : [...viewers, currentUser.id];
                const viewsCount = Math.max(m.viewsCount || 1, updatedViewers.length);

                return {
                  ...m,
                  isRead: true,
                  seenBy: updatedSeen,
                  viewers: updatedViewers,
                  viewsCount
                };
              }
              return m;
            });
            if (changed) {
              await updateDoc(chatRef, { messages: newMessages, unreadCount: 0 });
            }
          }
          break;
        }

        case 'edit': {
          const chatDoc = await getDoc(chatRef);
          if (chatDoc.exists()) {
            const chatData = chatDoc.data() as Chat;
            const newMessages = chatData.messages.map(m => 
              m.id === payload.id ? { ...m, text: payload.text, isEdited: true } : m
            );
            await updateDoc(chatRef, { messages: newMessages });
          }
          break;
        }

        case 'pin': {
          const chatDoc = await getDoc(chatRef);
          if (chatDoc.exists()) {
            const chatData = chatDoc.data() as Chat;
            const currentPins = chatData.pinnedMessageIds || [];
            const newPins = currentPins.includes(payload.messageId)
              ? currentPins.filter(id => id !== payload.messageId)
              : [...currentPins, payload.messageId];
            await updateDoc(chatRef, { pinnedMessageIds: newPins });
          }
          break;
        }

        case 'react': {
          const chatDoc = await getDoc(chatRef);
          if (chatDoc.exists()) {
            const chatData = chatDoc.data() as Chat;
            const newMessages = chatData.messages.map(m => {
              if (m.id !== payload.messageId) return m;
              const currentReactions = m.reactions || [];
              const existingReact = currentReactions.find(r => r.emoji === payload.emoji);
              let updatedReactions;
              if (existingReact) {
                if (existingReact.users.includes(currentUser.id)) {
                  // Toggle off
                  updatedReactions = currentReactions.map(r => 
                    r.emoji === payload.emoji ? { ...r, count: r.count - 1, users: r.users.filter(u => u !== currentUser.id) } : r
                  ).filter(r => r.count > 0);
                } else {
                  // Add user
                  updatedReactions = currentReactions.map(r => 
                    r.emoji === payload.emoji ? { ...r, count: r.count + 1, users: [...r.users, currentUser.id] } : r
                  );
                }
              } else {
                updatedReactions = [...currentReactions, { emoji: payload.emoji, count: 1, users: [currentUser.id] }];
              }
              return { ...m, reactions: updatedReactions };
            });
            await updateDoc(chatRef, { messages: newMessages });
          }
          break;
        }

        case 'votePoll': {
          const chatDoc = await getDoc(chatRef);
          if (chatDoc.exists()) {
            const chatData = chatDoc.data() as Chat;
            const newMessages = chatData.messages.map(m => {
              if (m.id !== payload.messageId || !m.poll) return m;
              const poll = m.poll;
              const updatedOptions = poll.options.map(opt => {
                const hasVoted = opt.votes.includes(currentUser.id);
                if (opt.id === payload.optionId) {
                  return {
                    ...opt,
                    votes: hasVoted ? opt.votes.filter(u => u !== currentUser.id) : [...opt.votes, currentUser.id]
                  };
                } else if (!poll.isMultipleChoice) {
                  return { ...opt, votes: opt.votes.filter(u => u !== currentUser.id) };
                }
                return opt;
              });
              const totalVotes = updatedOptions.reduce((acc, o) => acc + o.votes.length, 0);
              return { ...m, poll: { ...poll, options: updatedOptions, totalVotes } };
            });
            await updateDoc(chatRef, { messages: newMessages });
          }
          break;
        }
          
        case 'delete': {
          const chatDoc = await getDoc(chatRef);
          if (chatDoc.exists()) {
            const chatData = chatDoc.data() as Chat;
            const newMessages = (chatData.messages || []).filter(m => m.id !== payload.id);
            const newLastMsg = newMessages.length > 0 ? newMessages[newMessages.length - 1] : null;
            await updateDoc(chatRef, { messages: newMessages, lastMessage: newLastMsg });
          }
          break;
        }

        case 'clearHistory':
          await updateDoc(chatRef, { messages: [], lastMessage: null });
          break;
           
        case 'addParticipant':
          await updateDoc(chatRef, {
            participants: arrayUnion(payload),
            participantIds: arrayUnion(payload.id)
          });
          break;

        case 'updateChatInfo': {
          const updateData: any = {
            groupName: payload.groupName,
            description: payload.description,
            groupAvatar: payload.groupAvatar,
            isPublic: payload.isPublic,
            publicHandle: payload.publicHandle,
            slowMode: payload.slowMode
          };
          if (payload.permissions !== undefined) updateData.permissions = payload.permissions;
          if (payload.reactionsSetting !== undefined) updateData.reactionsSetting = payload.reactionsSetting;
          if (payload.allowedReactions !== undefined) updateData.allowedReactions = payload.allowedReactions;
          if (payload.inviteLinksList !== undefined) updateData.inviteLinksList = payload.inviteLinksList;
          if (payload.recentActions !== undefined) updateData.recentActions = payload.recentActions;
          if (payload.admins !== undefined) updateData.admins = payload.admins;
          if (payload.signMessages !== undefined) updateData.signMessages = payload.signMessages;
          if (payload.showAuthorsProfiles !== undefined) updateData.showAuthorsProfiles = payload.showAuthorsProfiles;
          if (payload.removedUsersList !== undefined) updateData.removedUsersList = payload.removedUsersList;
          if (payload.participants !== undefined) updateData.participants = payload.participants;
          if (payload.participantIds !== undefined) updateData.participantIds = payload.participantIds;
          await updateDoc(chatRef, updateData);
          break;
        }

        case 'regenerateInviteLink': {
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          const prefix = chatRef.id.startsWith('ch_') ? 'ch' : 'g';
          const randomToken = Math.random().toString(36).substring(2, 9);
          const newLink = `${origin}/join/${prefix}_${randomToken}`;
          await updateDoc(chatRef, { inviteLink: newLink });
          break;
        }

        case 'setAdminPermissions': {
          const chatDoc = await getDoc(chatRef);
          if (chatDoc.exists()) {
            const cData = chatDoc.data() as Chat;
            const currentAdmins = cData.admins || {};
            const updatedAdmins = {
              ...currentAdmins,
              [payload.userId]: payload.permissions
            };
            await updateDoc(chatRef, { admins: updatedAdmins });
          }
          break;
        }

        case 'removeAdmin': {
          const chatDoc = await getDoc(chatRef);
          if (chatDoc.exists()) {
            const cData = chatDoc.data() as Chat;
            const currentAdmins = { ...(cData.admins || {}) };
            delete currentAdmins[payload.userId];
            await updateDoc(chatRef, { admins: currentAdmins });
          }
          break;
        }

        case 'kickMember': {
          const chatDoc = await getDoc(chatRef);
          if (chatDoc.exists()) {
            const cData = chatDoc.data() as Chat;
            const newParticipants = (cData.participants || []).filter(p => p.id !== payload.userId);
            const newParticipantIds = (cData.participantIds || []).filter(id => id !== payload.userId);
            const currentAdmins = { ...(cData.admins || {}) };
            delete currentAdmins[payload.userId];
            await updateDoc(chatRef, {
              participants: newParticipants,
              participantIds: newParticipantIds,
              admins: currentAdmins
            });
          }
          break;
        }

        case 'updateSettings':
          await updateDoc(chatRef, payload);
          break;

        case 'forwardMessage': {
          const { targetChatIds, message, senderDisplayName } = payload;
          const origSender = senderDisplayName || currentUser.displayName;
          for (const tId of targetChatIds) {
            let tChat = chats.find(c => c.id === tId);
            if (!tChat && tId === `saved_${currentUser.id}`) {
              tChat = {
                id: tId,
                type: 'saved',
                participants: [currentUser],
                participantIds: [currentUser.id],
                messages: [],
                pinnedMessageIds: [],
                unreadCount: 0,
                groupName: 'پیام‌های ذخیره شده'
              };
              await createChatInFirestore(tChat);
            }

            const tRef = doc(db, "chats", tId);
            const fwdMsg: Message = {
              id: `m_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
              senderId: currentUser.id,
              text: message.text || '',
              imageUrl: message.imageUrl,
              audioUrl: message.audioUrl,
              poll: message.poll,
              forwardedFrom: message.forwardedFrom || origSender,
              timestamp: Date.now(),
              isRead: false
            };
            await updateDoc(tRef, {
              messages: arrayUnion(fwdMsg),
              lastMessage: fwdMsg,
              deletedForUserIds: [], // Resets deleted status so chat returns to sidebar!
              unreadCount: 0
            });
          }
          break;
        }
      }
    } catch (e) {
      console.error("Firebase Error:", e);
      alert("خطا در اعمال تغییرات");
    }
  };

  const handleOpenSavedMessages = async () => {
    if (!currentUser) return;
    const savedId = `saved_${currentUser.id}`;
    const existing = chats.find(c => c.id === savedId || (c.type === 'saved' && c.participantIds?.includes(currentUser.id)));
    if (existing) {
      setActiveChatId(existing.id);
    } else {
      const newSavedChat: Chat = {
        id: savedId,
        type: 'saved',
        participants: [currentUser],
        participantIds: [currentUser.id],
        messages: [],
        pinnedMessageIds: [],
        unreadCount: 0,
        groupName: 'پیام‌های ذخیره شده'
      };
      await createChatInFirestore(newSavedChat);
      setActiveChatId(savedId);
    }
  };

  const handlePinChat = async (chatId: string) => {
    const c = chats.find(x => x.id === chatId);
    if (!c) return;
    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, { isPinnedInSidebar: !c.isPinnedInSidebar });
  };

  const handleArchiveChat = async (chatId: string) => {
    const c = chats.find(x => x.id === chatId);
    if (!c) return;
    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, { isArchived: !c.isArchived });
  };

  const handleMuteChat = async (chatId: string) => {
    const c = chats.find(x => x.id === chatId);
    if (!c) return;
    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, { isMuted: !c.isMuted });
  };

  const handleMarkReadChat = async (chatId: string) => {
    const c = chats.find(x => x.id === chatId);
    if (!c) return;
    const chatRef = doc(db, "chats", chatId);
    const newCount = (c.unreadCount && c.unreadCount > 0) ? 0 : 1;
    await updateDoc(chatRef, { unreadCount: newCount });
  };

  const handleClearChatHistory = async (chatId: string) => {
    if (!currentUser) return;
    const targetChat = chats.find(c => c.id === chatId);
    const chatRef = doc(db, "chats", chatId);
    const now = Date.now();
    const updatedClearedAt = { ...(targetChat?.clearedAt || {}), [currentUser.id]: now };
    await updateDoc(chatRef, { 
      clearedAt: updatedClearedAt
    });
  };

  const handleDeleteChat = async (chatId: string, deleteForBoth: boolean) => {
    if (!currentUser) return;
    const targetChat = chats.find(c => c.id === chatId);
    const chatRef = doc(db, "chats", chatId);
    const now = Date.now();
    if (deleteForBoth && targetChat) {
      // Clear all history completely for both sides and mark as deleted
      await updateDoc(chatRef, { 
        messages: [],
        lastMessage: null,
        pinnedMessageIds: [],
        unreadCount: 0,
        clearedAt: {},
        deletedForUserIds: arrayUnion(currentUser.id, ...(targetChat.participantIds || [])) 
      });
    } else {
      // Delete for current user only: record clearedAt so old history is permanently hidden for them
      const updatedClearedAt = { ...(targetChat?.clearedAt || {}), [currentUser.id]: now };
      await updateDoc(chatRef, { 
        clearedAt: updatedClearedAt,
        deletedForUserIds: arrayUnion(currentUser.id) 
      });
    }
    if (activeChatId === chatId) {
      setActiveChatId(null);
    }
  };

  const handleAiMessage = async (payload: any) => {
     // Local AI Logic
      const msg: Message = {
        id: `m_${Date.now()}`,
        senderId: currentUser!.id,
        text: payload.text,
        timestamp: Date.now()
      };
      
      // Update local state temporarily for AI chat
      const existingAiChat = chats.find(c => c.id === AI_BOT.id);
      let newChat: Chat;
      
      if (!existingAiChat) {
         newChat = {
           id: AI_BOT.id, type: 'bot', participants: [currentUser!, AI_BOT],
           messages: [msg], pinnedMessageIds: [], unreadCount: 0, participantIds: []
         };
         setChats(prev => [newChat, ...prev]);
      } else {
         setChats(prev => prev.map(c => c.id === AI_BOT.id ? {...c, messages: [...c.messages, msg]} : c));
      }

      setIsTyping(true);
      const history = (existingAiChat?.messages || []).map(m => ({
        role: m.senderId === currentUser!.id ? 'user' as const : 'model' as const,
        text: m.text
      }));

      try {
        const stream = gemini.getChatResponseStream(payload.text, history);
        let fullText = "";
        const aiMsgId = `ai_${Date.now()}`;
        
        // Add placeholder
        setChats(prev => prev.map(c => c.id === AI_BOT.id ? {
            ...c,
            messages: [...c.messages, { id: aiMsgId, senderId: AI_BOT.id, text: '...', timestamp: Date.now(), isAi: true }]
        } : c));

        for await (const chunk of stream) {
          fullText += chunk;
          setChats(prev => prev.map(c => c.id === AI_BOT.id ? {
            ...c,
            messages: c.messages.map(m => m.id === aiMsgId ? { ...m, text: fullText } : m)
          } : c));
        }
      } catch (e) { console.error(e); } 
      finally { setIsTyping(false); }
  };

  const hydratedChats: Chat[] = useMemo(() => {
    return chats.map((c: Chat) => ({
      ...c,
      participants: (c.participants || []).map((p: User) => liveUsersMap[p.id] ? { ...p, ...liveUsersMap[p.id] } : p)
    }));
  }, [chats, liveUsersMap]);

  const getActiveChat = () => {
    if (!activeChatId || !currentUser) return null;
    if (activeChatId === AI_BOT.id) {
       return hydratedChats.find((c: Chat) => c.id === AI_BOT.id) || { id: AI_BOT.id, type: 'bot', participants: [currentUser, AI_BOT], messages: [], pinnedMessageIds: [], unreadCount: 0 } as Chat;
    }
    return hydratedChats.find((c: Chat) => c.id === activeChatId) || null;
  };

  if (booting) return <div className="min-h-screen bg-[#0e1621] flex items-center justify-center text-[#8b98a5] font-['Vazirmatn']" dir="rtl">در حال بارگذاری…</div>;
  if (!currentUser) return <Login onLogin={handleAuth} />;

  // Lock Screen (UI Only - Same as before)
  if (isAppLocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0e1621] text-white animate-in zoom-in font-['Vazirmatn']">
         <div className="w-20 h-20 bg-[#3390ec]/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <Lock size={40} className="text-[#3390ec]"/>
         </div>
         <h2 className="text-xl font-bold mb-4">برنامه قفل است</h2>
         <div className="flex gap-4 mb-8">
            {[0,1,2,3].map(i => (
              <div key={i} className={`w-4 h-4 rounded-full transition-all ${lockInput.length > i ? 'bg-[#3390ec] scale-110' : 'bg-white/10'}`}/>
            ))}
         </div>
         <div className="grid grid-cols-3 gap-6">
            {[1,2,3,4,5,6,7,8,9,0].map(n => (
              <button key={n} onClick={() => {const next = lockInput + n; setLockInput(next); if (next.length === 4) handleUnlock(next);}} 
              className="w-16 h-16 rounded-full bg-[#17212b] hover:bg-[#242f3d] text-2xl font-bold transition-all border border-white/5">{n}</button>
            ))}
         </div>
      </div>
    );
  }

  const handleToggleContact = async (contactUser: User) => {
    if (!currentUser) return;
    const currentContacts = currentUser.contacts || [];
    const isContact = currentContacts.includes(contactUser.id);
    const updatedContacts = isContact
      ? currentContacts.filter(id => id !== contactUser.id)
      : [...currentContacts, contactUser.id];
    
    const updated = { ...currentUser, contacts: updatedContacts };
    setCurrentUser(updated);
    try {
      const userRef = doc(db, "users", currentUser.id);
      await updateDoc(userRef, { contacts: updatedContacts });
      localStorage.setItem('starly_session_cloud', JSON.stringify(updated));
    } catch (e) {
      console.error("Error updating contacts:", e);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#0e1621] text-white overflow-hidden font-['Vazirmatn'] relative" dir="rtl">
      {/* Floating Top Notification Permission Guidance Banner */}
      {isNotificationSupported() && notifPermission !== 'granted' && !dismissNotifBanner && (
        <div className="relative z-40 bg-gradient-to-r from-[#17212b] via-[#1e2c3a] to-[#17212b] border-b border-[#3390ec]/30 px-3 py-2 text-xs flex items-center justify-between gap-3 shadow-lg shrink-0 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#3390ec]/20 border border-[#3390ec]/40 flex items-center justify-center shrink-0 text-[#3390ec]">
              <BellRing size={16} className="animate-bounce" />
            </div>
            <div className="text-right truncate">
              {notifPermission === 'denied' ? (
                <div>
                  <span className="font-bold text-amber-400">اعلان‌ها در مرورگر مسدود شده‌اند: </span>
                  <span className="text-white/90">
                    برای دریافت پیام‌ها در پس‌زمینه، روی آیکون قفل 🔒 یا تنظیمات کنار آدرس سایت کلیک کرده و دسترسی Notifications را فعال نمایید.
                  </span>
                </div>
              ) : (
                <div>
                  <span className="font-bold text-[#3390ec]">فعال‌سازی اعلان‌های پیام‌رسان: </span>
                  <span className="text-white/90">
                    برای باخبر شدن فوری از پیام‌ها حتی در صورت بسته بودن تب، اعلان‌های مرورگر را فعال کنید.
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {notifPermission === 'denied' ? (
              <button
                type="button"
                onClick={() => {
                  const current = getNotificationPermissionStatus();
                  setNotifPermission(current);
                  if (current === 'granted') {
                    playNotificationSound();
                  } else if (current === 'default') {
                    requestNotificationPermission().then(p => {
                      setNotifPermission(p);
                      if (p === 'granted') playNotificationSound();
                    });
                  }
                }}
                className="px-3 py-1.5 bg-[#3390ec] hover:bg-[#2881d9] text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
              >
                بررسی مجدد مجوز
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  requestNotificationPermission().then(p => {
                    setNotifPermission(p);
                    if (p === 'granted') playNotificationSound();
                  });
                }}
                className="px-3 py-1.5 bg-[#3390ec] hover:bg-[#2881d9] text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
              >
                فعال‌سازی اعلان‌ها
              </button>
            )}

            <button
              type="button"
              onClick={() => setDismissNotifBanner(true)}
              className="p-1 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="بستن اعلان"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className={`flex-1 flex w-full h-full overflow-hidden ${activeChatId ? 'md:flex' : ''}`}>
        
        <div className={`w-full md:w-[380px] lg:w-[420px] flex-shrink-0 h-full border-l border-black/20 ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
          <Sidebar 
            chats={hydratedChats} activeChatId={activeChatId} setActiveChatId={setActiveChatId} 
            currentUser={currentUser} activeFolder={activeFolder} setActiveFolder={setActiveFolder}
            stories={stories}
            onOpenCreateStory={() => setShowCreateStory(true)}
            onViewStory={(s) => setViewingStory(s)}
            systemConfig={systemConfig}
            onOpenMyProfile={() => setShowMyProfile(true)}
            onOpenAdminPanel={() => setShowAdminPanel(true)}
            onOpenSettings={() => setShowSettings(true)}
            onLogout={async () => { localStorage.removeItem('starly_session_cloud'); await authApi.logout(); stopSync(); setCurrentUser(null); }}
            onToggleContact={handleToggleContact}
            onOpenSavedMessages={handleOpenSavedMessages}
            onPinChat={handlePinChat}
            onArchiveChat={handleArchiveChat}
            onMuteChat={handleMuteChat}
            onMarkReadChat={handleMarkReadChat}
            onClearHistory={handleClearChatHistory}
            onDeleteChat={handleDeleteChat}
            onStartChat={async (u) => {
              if (u.id === AI_BOT.id) { setActiveChatId(AI_BOT.id); return; }
              const existing = chats.find(c => c.type === 'private' && c.participantIds?.includes(u.id));
              if (existing) {
                if (existing.deletedForUserIds?.includes(currentUser.id)) {
                  const updatedDeleted = (existing.deletedForUserIds || []).filter(id => id !== currentUser.id);
                  await updateDoc(doc(db, "chats", existing.id), { deletedForUserIds: updatedDeleted });
                }
                setActiveChatId(existing.id);
              } else {
                const newChat: Chat = { 
                  id: `c_${Date.now()}`, type: 'private', 
                  participants: [currentUser, u], 
                  participantIds: [currentUser.id, u.id],
                  messages: [], pinnedMessageIds: [], unreadCount: 0,
                  deletedForUserIds: []
                };
                await createChatInFirestore(newChat);
                setActiveChatId(newChat.id);
              }
            }}
            onCreateGroup={async (name, desc, members, isPublic, publicHandle, avatar) => {
              if (systemConfig?.allowGroupCreation === false) {
                alert('ساخت گروه جدید توسط مدیریت سیستم غیرفعال شده است.');
                return;
              }
              const id = `g_${Date.now()}`;
              const allParticipants = [currentUser, ...members];
              const cleanHandle = publicHandle?.trim().replace('@', '');
              const newChat: Chat = { 
                id, type: 'group', groupName: name, description: desc, 
                participants: allParticipants,
                participantIds: allParticipants.map(p => p.id),
                messages: [], pinnedMessageIds: [], 
                unreadCount: 0, adminId: currentUser.id,
                isPublic: !!isPublic,
                publicHandle: cleanHandle || undefined,
                groupAvatar: avatar || generateLocalAvatarSvg(name, id),
                inviteLink: isPublic && cleanHandle
                  ? `${typeof window !== 'undefined' ? window.location.origin : ''}/@${cleanHandle}`
                  : `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${id.substring(2)}`
              };
              await createChatInFirestore(newChat);
              setActiveChatId(id);
            }}
            onCreateChannel={async (name, desc, members, avatar) => {
              if (systemConfig?.allowChannelCreation === false) {
                alert('ساخت کانال جدید توسط مدیریت سیستم غیرفعال شده است.');
                return;
              }
              const id = `ch_${Date.now()}`;
              const allParticipants = [currentUser, ...members];
              const newChat: Chat = { 
                id, type: 'channel', groupName: name, description: desc, 
                participants: allParticipants,
                participantIds: allParticipants.map(p => p.id),
                messages: [], pinnedMessageIds: [], 
                unreadCount: 0, adminId: currentUser.id,
                groupAvatar: avatar || generateLocalAvatarSvg(name, id),
                inviteLink: `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${id.substring(3)}`
              };
              await createChatInFirestore(newChat);
              setActiveChatId(id);
            }}
          />
        </div>

        <div className={`flex-1 h-full w-full ${!activeChatId ? 'hidden md:flex' : 'flex'}`}>
           <ChatArea 
            chat={getActiveChat()} currentUser={currentUser} isTyping={isTyping} 
            chats={hydratedChats}
            onOpenSavedMessages={handleOpenSavedMessages}
            onAction={handleMessageAction}
            onDeleteChat={() => setActiveChatId(null)}
            onBack={() => setActiveChatId(null)}
            onUsernameClick={handleUsernameClick}
            onToggleContact={handleToggleContact}
            onReportMessage={(msg) => setReportingMessage(msg)}
          />
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal 
          user={currentUser} onClose={() => setShowSettings(false)} 
          onDeleteAccount={handleDeleteAccount} 
          onUpdateUser={async (updated) => {
             setCurrentUser(updated);
             const userRef = doc(db, "users", updated.id);
             await updateDoc(userRef, updated as any);
             localStorage.setItem('starly_session_cloud', JSON.stringify(updated));
             document.body.className = `${updated.theme}-theme`;
          }}
        />
      )}

      {/* My Profile Modal */}
      {showMyProfile && (
        <MyProfileModal
          user={currentUser}
          onClose={() => setShowMyProfile(false)}
          onUpdateUser={async (updatedData) => {
            const updated = { ...currentUser, ...updatedData };
            setCurrentUser(updated);
            localStorage.setItem('starly_session_cloud', JSON.stringify(updated));
            const userRef = doc(db, "users", currentUser.id);
            await updateDoc(userRef, updatedData);
          }}
        />
      )}

      {/* Create Story Modal */}
      {showCreateStory && (
        <CreateStoryModal
          currentUser={currentUser}
          onClose={() => setShowCreateStory(false)}
          onSubmitStory={async (mediaUrl, caption, durationHours, mediaType = 'image', durationSeconds = 5) => {
            const storyId = `story_${Date.now()}`;
            const newStory: Story = {
              id: storyId,
              userId: currentUser.id,
              userName: currentUser.displayName,
              userAvatar: currentUser.avatar,
              mediaUrl,
              mediaType,
              durationSeconds,
              caption: caption || undefined,
              timestamp: Date.now(),
              expiresAt: Date.now() + durationHours * 3600 * 1000,
              viewers: []
            };
            await setDoc(doc(db, "stories", storyId), newStory);
          }}
        />
      )}

      {/* Story Viewer Modal */}
      {viewingStory && (
        <StoryViewerModal
          initialStory={viewingStory}
          allStories={stories}
          currentUser={currentUser}
          onClose={() => setViewingStory(null)}
          onStoryViewed={async (storyId) => {
            try {
              const storyRef = doc(db, "stories", storyId);
              await updateDoc(storyRef, {
                viewers: arrayUnion(currentUser.id)
              });
            } catch (e) {
              console.error('Error recording story view:', e);
            }
          }}
          onDeleteStory={async (storyId) => {
            try {
              await deleteDoc(doc(db, "stories", storyId));
            } catch (e) {
              console.error('Error deleting story:', e);
            }
          }}
        />
      )}

      {/* Join Group/Channel Preview Modal */}
      {joinTargetChat && (
        <div 
          className="fixed inset-0 z-[1000] bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => { setJoinTargetChat(null); window.history.replaceState({}, '', '/'); }}
        >
          <div 
            className="w-full max-w-sm bg-[#17212b] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-5 animate-pop"
            onClick={e => e.stopPropagation()}
          >
            <div className="relative">
              <img 
                src={joinTargetChat.groupAvatar || DEFAULT_AVATAR} 
                onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                className="w-24 h-24 rounded-full object-cover border-4 border-[#3390ec]/30 shadow-xl bg-[#242f3d]" 
              />
              <span className="absolute bottom-1 right-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#3390ec] text-white shadow-md">
                {joinTargetChat.type === 'channel' ? 'کانال' : 'گروه'}
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-white text-lg">{joinTargetChat.groupName}</h3>
              {joinTargetChat.publicHandle && (
                <p className="text-xs text-[#3390ec] font-mono" dir="ltr">@{joinTargetChat.publicHandle}</p>
              )}
              <p className="text-xs text-[#708499]">
                {joinTargetChat.participantIds?.length || joinTargetChat.participants?.length || 1} {joinTargetChat.type === 'channel' ? 'مشترک' : 'عضو'}
              </p>
            </div>

            {joinTargetChat.description && (
              <p className="text-xs text-white/80 p-3 bg-black/20 rounded-2xl leading-relaxed max-h-28 overflow-y-auto custom-scrollbar w-full text-right">
                {joinTargetChat.description}
              </p>
            )}

            <div className="flex gap-2 w-full pt-2">
              <button 
                onClick={() => { setJoinTargetChat(null); window.history.replaceState({}, '', '/'); }}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-[#708499] hover:text-white rounded-2xl text-xs font-bold transition-all"
              >
                انصراف
              </button>
              <button 
                onClick={() => handleJoinChat(joinTargetChat)}
                disabled={isJoining}
                className="flex-[2] py-3 bg-[#3390ec] hover:bg-[#2881d9] text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-[#3390ec]/25 active:scale-95 disabled:opacity-50"
              >
                {joinTargetChat.participantIds?.includes(currentUser?.id || '') ? 'مشاهده گفتگو' : (joinTargetChat.type === 'channel' ? 'عضویت در کانال' : 'پیوستن به گروه')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Report Modal */}
      {reportingMessage && (
        <ReportModal
          message={reportingMessage}
          reportedUser={getActiveChat()?.participants.find((p: User) => p.id === reportingMessage.senderId)}
          chatId={activeChatId || ''}
          reporter={currentUser}
          onClose={() => setReportingMessage(null)}
          onSubmitReport={async (reason) => {
            const activeChat = getActiveChat();
            const reportedUser = activeChat?.participants.find((p: User) => p.id === reportingMessage.senderId);
            const reportId = `rep_${Date.now()}`;
            const newReport: MessageReport = {
              id: reportId,
              reporterId: currentUser.id,
              reporterName: currentUser.displayName,
              reportedUserId: reportingMessage.senderId,
              reportedUserName: reportedUser?.displayName || 'کاربر',
              chatId: activeChatId || '',
              messageId: reportingMessage.id,
              messageText: reportingMessage.text,
              reason,
              timestamp: Date.now(),
              status: 'pending'
            };
            await setDoc(doc(db, "reports", reportId), newReport);
          }}
        />
      )}

      {/* Super Admin Panel Modal */}
      {showAdminPanel && (
        <AdminPanelModal
          currentUser={currentUser}
          systemConfig={systemConfig}
          onClose={() => setShowAdminPanel(false)}
          onUpdateSystemConfig={async (newConfig) => {
            const updated = { ...systemConfig, ...newConfig };
            setSystemConfig(updated);
            await setDoc(doc(db, "system_config", "main"), updated, { merge: true });
          }}
          onRefreshData={() => {
            // Re-sync
          }}
        />
      )}
      {/* Floating Notification Permission & Browser Settings Banner */}
      {currentUser && notifPermission !== 'granted' && notifPermission !== 'unsupported' && !dismissNotifBanner && (
        <div className="fixed top-4 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 bg-[#17212b]/95 backdrop-blur-xl border border-amber-500/40 shadow-2xl rounded-2xl p-3.5 flex items-start gap-3 animate-in slide-in-from-top">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
            <BellRing size={18} className="animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <h4 className="text-xs font-bold text-white">اعلان‌های مرورگر فعال نیست</h4>
              <button 
                onClick={() => setDismissNotifBanner(true)} 
                className="p-1 hover:bg-white/10 rounded-full text-[#708499] hover:text-white transition-colors"
                title="بستن موقت"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-[11px] text-[#708499] mt-1 leading-relaxed">
              برای دریافت فوری پیام‌ها در پس‌زمینه، روی علامت قفل 🔒 یا تنظیمات کنار آدرس سایت کلیک کرده و دسترسی اعلان (Notifications) را فعال کنید.
            </p>
            <div className="flex items-center gap-2 mt-2.5">
              <button 
                onClick={async () => {
                  const res = await requestNotificationPermission();
                  setNotifPermission(res);
                  if (res === 'granted') {
                    playNotificationSound();
                  }
                }}
                className="px-3 py-1.5 bg-[#3390ec] hover:bg-[#2881d9] text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                بررسی مجدد مجوز
              </button>
              <button 
                onClick={() => setDismissNotifBanner(true)} 
                className="px-2.5 py-1.5 text-xs text-[#708499] hover:text-white transition-colors"
              >
                بعداً
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Message Toast Notification */}
      {inAppToast && (
        <div 
          onClick={() => {
            setActiveChatId(inAppToast.chatId);
            setInAppToast(null);
          }}
          className="fixed top-4 left-4 right-4 md:right-auto md:left-6 md:w-80 z-50 bg-[#17212b]/95 backdrop-blur-xl border border-[#3390ec]/30 shadow-2xl rounded-2xl p-3 flex items-center gap-3 cursor-pointer animate-in slide-in-from-top hover:bg-[#242f3d] transition-all"
        >
          <div className="w-10 h-10 rounded-full bg-[#3390ec]/20 text-[#3390ec] flex items-center justify-center shrink-0">
            <Bell size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate">{inAppToast.title}</p>
            <p className="text-[11px] text-[#708499] truncate">{inAppToast.body}</p>
          </div>
        </div>
      )}

      {/* Smooth Logo Reveal Splash Animation */}
      {showEntranceSplash && (
        <div 
          className="fixed inset-0 z-[999] bg-[#0e1621] flex flex-col items-center justify-center animate-in fade-in duration-300 p-6 select-none cursor-pointer"
          onClick={() => setShowEntranceSplash(false)}
        >
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute w-[500px] h-[500px] bg-[#3390ec]/15 rounded-full blur-3xl pointer-events-none -top-10 -right-10 animate-pulse" />
          <div className="absolute w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -bottom-10 -left-10" />

          {/* Spacious Modern Welcome Card */}
          <div className="relative z-10 max-w-sm w-full p-8 bg-[#17212b]/90 border border-white/10 rounded-3xl backdrop-blur-md shadow-2xl flex flex-col items-center text-center space-y-6">
            {/* Glowing Logo Icon */}
            <div className="relative flex items-center justify-center my-2">
              <div className="absolute w-28 h-28 rounded-full bg-[#3390ec]/20 animate-ping opacity-50" />
              <div className="absolute w-36 h-36 rounded-full bg-[#3390ec]/10 animate-pulse" />
              <div className="relative w-24 h-24 bg-gradient-to-tr from-[#2b5278] via-[#3390ec] to-[#5288c1] rounded-3xl flex items-center justify-center shadow-2xl shadow-[#3390ec]/40 transform animate-pop">
                <Send size={44} className="text-white -translate-x-0.5" />
              </div>
            </div>

            {/* Title & Slogan */}
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-white tracking-wide flex items-center justify-center gap-2">
                <span>استارلی چت</span>
                <Sparkles size={20} className="text-amber-400" />
              </h1>
              <p className="text-xs text-[#708499] leading-relaxed">
                پیام‌رسان ابری، امن و پرسرعت با رمزنگاری پیشرفته
              </p>
            </div>

            {/* Current User Welcome Badge */}
            {currentUser && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-[#242f3d]/80 rounded-2xl border border-white/5 w-full">
                <img 
                  src={currentUser.avatar || DEFAULT_AVATAR} 
                  onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                  className="w-9 h-9 rounded-full object-cover bg-[#0e1621] shrink-0" 
                />
                <div className="flex-1 text-right min-w-0">
                  <p className="text-[11px] text-[#708499]">خوش آمدید</p>
                  <p className="text-xs font-bold text-white truncate">{currentUser.displayName}</p>
                </div>
              </div>
            )}

            {/* Tap to enter hint */}
            <div className="pt-2 text-center">
              <span className="inline-block px-4 py-1.5 bg-white/5 hover:bg-white/10 text-[#708499] hover:text-white rounded-full text-[11px] transition-colors">
                برای ورود سریع کلیک کنید
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
