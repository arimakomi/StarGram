import React, { useState, useEffect, useCallback } from 'react';
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
import { Lock } from 'lucide-react';
import { db, collection, query, where, onSnapshot, doc, updateDoc, setDoc, getDoc, getDocs, deleteDoc, arrayUnion, startSync, stopSync } from './services/database';
import { authApi, getToken } from './services/auth';

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
  
  // App Lock State
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [lockInput, setLockInput] = useState('');

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
          } else if (r.status === 401 || r.status === 403) {
            localStorage.removeItem('starly_session_cloud');
            await authApi.logout();
          }
        }
      } catch (e) { console.error(e); }
      finally { setBooting(false); }
    })();
  }, []);

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

  const handleAuth = async (user: User) => {
    await startSync();
    setCurrentUser(user);
    document.body.className = `${user.theme}-theme`;
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
            isRead: false
          };
          
          await updateDoc(chatRef, {
            messages: arrayUnion(msg),
            lastMessage: msg,
            unreadCount: 0
          });
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
            const newMessages = chatData.messages.filter(m => m.id !== payload.id);
            await updateDoc(chatRef, { messages: newMessages });
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

        case 'updateChatInfo':
          await updateDoc(chatRef, {
            groupName: payload.groupName,
            description: payload.description,
            slowMode: payload.slowMode
          });
          break;

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
    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, { messages: [], lastMessage: null });
  };

  const handleDeleteChat = async (chatId: string, deleteForBoth: boolean) => {
    if (!currentUser) return;
    const targetChat = chats.find(c => c.id === chatId);
    const chatRef = doc(db, "chats", chatId);
    if (deleteForBoth && targetChat) {
      await updateDoc(chatRef, { 
        deletedForUserIds: arrayUnion(currentUser.id, ...(targetChat.participantIds || [])) 
      });
    } else {
      await updateDoc(chatRef, { 
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

  const getActiveChat = () => {
    if (!activeChatId || !currentUser) return null;
    if (activeChatId === AI_BOT.id) {
       return chats.find(c => c.id === AI_BOT.id) || { id: AI_BOT.id, type: 'bot', participants: [currentUser, AI_BOT], messages: [], pinnedMessageIds: [], unreadCount: 0 } as Chat;
    }
    return chats.find(c => c.id === activeChatId) || null;
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
    <div className="flex h-screen w-full bg-[#0e1621] text-white overflow-hidden font-['Vazirmatn']" dir="rtl">
      <div className={`flex-1 flex w-full h-full ${activeChatId ? 'md:flex' : ''}`}>
        
        <div className={`w-full md:w-[380px] lg:w-[420px] flex-shrink-0 h-full border-l border-black/20 ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
          <Sidebar 
            chats={chats} activeChatId={activeChatId} setActiveChatId={setActiveChatId} 
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
                  ? `https://chat.starly.ir/@${cleanHandle}`
                  : `https://chat.starly.ir/join/${id.substring(2)}`
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
                inviteLink: `https://chat.starly.ir/join/${id.substring(3)}`
              };
              await createChatInFirestore(newChat);
              setActiveChatId(id);
            }}
          />
        </div>

        <div className={`flex-1 h-full w-full ${!activeChatId ? 'hidden md:flex' : 'flex'}`}>
           <ChatArea 
            chat={getActiveChat()} currentUser={currentUser} isTyping={isTyping} 
            chats={chats}
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

      {/* Message Report Modal */}
      {reportingMessage && (
        <ReportModal
          message={reportingMessage}
          reportedUser={getActiveChat()?.participants.find(p => p.id === reportingMessage.senderId)}
          chatId={activeChatId || ''}
          reporter={currentUser}
          onClose={() => setReportingMessage(null)}
          onSubmitReport={async (reason) => {
            const activeChat = getActiveChat();
            const reportedUser = activeChat?.participants.find(p => p.id === reportingMessage.senderId);
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
    </div>
  );
};

export default App;