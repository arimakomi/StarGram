import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, Chat, FolderType, DEFAULT_AVATAR, Story, SystemConfig } from '../types';
import { 
  Menu, Search, Download, Smartphone, LogOut, Bookmark, Users, Settings, Megaphone, Plus, X, 
  ChevronLeft, Image as ImageIcon, MessageCircle, Lock, Globe, Check, UserPlus, 
  Trash, UserCheck, Camera, Phone, UserX, Pin, PinOff, Bell, BellOff, 
  Archive, ArchiveRestore, CheckCheck, RotateCcw, ChevronDown, ChevronUp,
  Shield, User as UserIcon, Sparkles, Heart
} from 'lucide-react';
import { collection, query, where, getDocs, db } from '../services/database';
import { compressImage } from '../services/imageUtils';
import { StoriesBar } from './StoriesBar';
import { getUserPresence } from '../services/presenceUtils';
import { StarChatLogo } from './StarChatLogo';

interface SidebarProps {
  chats: Chat[];
  activeChatId: string | null;
  setActiveChatId: (id: string) => void;
  currentUser: User;
  activeFolder: FolderType;
  setActiveFolder: (f: FolderType) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onStartChat: (user: User) => void;
  onCreateGroup: (name: string, desc: string, members: User[], isPublic?: boolean, publicHandle?: string, avatar?: string) => void;
  onCreateChannel: (name: string, desc: string, members: User[], avatar?: string) => void;
  onToggleContact?: (user: User) => void;
  onOpenSavedMessages?: () => void;
  onPinChat?: (chatId: string) => void;
  onArchiveChat?: (chatId: string) => void;
  onMuteChat?: (chatId: string) => void;
  onMarkReadChat?: (chatId: string) => void;
  onClearHistory?: (chatId: string) => void;
  onDeleteChat?: (chatId: string, deleteForBoth: boolean) => void;
  stories: Story[];
  onOpenCreateStory: () => void;
  onViewStory: (story: Story) => void;
  systemConfig: SystemConfig;
  onOpenMyProfile: () => void;
  onOpenAdminPanel: () => void;
}


// Helper to compute exact unseen messages for currentUser
const getChatUnseenCount = (chat: Chat, currentUserId: string): number => {
  const clearTime = chat.clearedAt?.[currentUserId] || 0;
  const count = (chat.messages || []).filter(m => 
    m.senderId !== currentUserId &&
    m.timestamp > clearTime &&
    !(m.seenBy && m.seenBy.some(s => s.userId === currentUserId)) &&
    !m.isRead
  ).length;
  return count > 0 ? count : (chat.unreadCount > 0 ? chat.unreadCount : 0);
};

const Sidebar: React.FC<SidebarProps> = ({ 
  chats, activeChatId, setActiveChatId, currentUser, activeFolder, setActiveFolder, 
  onOpenSettings, onLogout, onStartChat, onCreateGroup, onCreateChannel, onToggleContact,
  onOpenSavedMessages, onPinChat, onArchiveChat, onMuteChat, onMarkReadChat, onClearHistory, onDeleteChat,
  stories, onOpenCreateStory, onViewStory, systemConfig, onOpenMyProfile, onOpenAdminPanel
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDrawer, setShowDrawer] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [isArchiveExpanded, setIsArchiveExpanded] = useState(false);

  // Chat Context Menu State
  const [chatContextMenu, setChatContextMenu] = useState<{ x: number; y: number; chat: Chat } | null>(null);

  // Confirmation Modal State (Delete or Clear History)
  const [confirmModal, setConfirmModal] = useState<{ type: 'delete' | 'clear'; chat: Chat; deleteForBoth: boolean } | null>(null);

  // Touch timer for mobile long-press
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Group / Channel Creation State
  const [showCreateModal, setShowCreateModal] = useState<'group' | 'channel' | null>(null);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isPublicGroup, setIsPublicGroup] = useState(false);
  const [publicHandle, setPublicHandle] = useState('');
  const [groupAvatar, setGroupAvatar] = useState<string>('');
  // PWA detection & Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(() => (window as any).stargramInstallPrompt || null);
  const [isPWA, setIsPWA] = useState<boolean>(() => {
    try {
      return window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
    } catch {
      return false;
    }
  });
  const [showPwaGuideModal, setShowPwaGuideModal] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      (window as any).stargramInstallPrompt = e;
      setDeferredPrompt(e);
    };
    const handleAppInstalled = () => {
      setIsPWA(true);
      (window as any).stargramInstallPrompt = null;
      setDeferredPrompt(null);
      setShowDrawer(false);
    };
    const handleInstallPromptReady = () => {
      setDeferredPrompt((window as any).stargramInstallPrompt || null);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('stargram:installprompt', handleInstallPromptReady);

    const mql = window.matchMedia('(display-mode: standalone)');
    const handleMql = (e: MediaQueryListEvent) => {
      setIsPWA(e.matches);
    };
    mql.addEventListener('change', handleMql);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('stargram:installprompt', handleInstallPromptReady);
      mql.removeEventListener('change', handleMql);
    };
  }, []);

  const handleInstallPWA = async () => {
    const installPrompt = deferredPrompt || (window as any).stargramInstallPrompt;
    if (installPrompt) {
      try {
        // Call prompt directly from the click handler so the browser's user-activation check passes.
        installPrompt.prompt();
        await installPrompt.userChoice;
        (window as any).stargramInstallPrompt = null;
        setDeferredPrompt(null);
      } catch {
        (window as any).stargramInstallPrompt = null;
        setDeferredPrompt(null);
        setShowPwaGuideModal(true);
      }
    } else {
      setShowPwaGuideModal(true);
    }
  };

  // ESC Key listener for Sidebar inner modals
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPwaGuideModal) { setShowPwaGuideModal(false); return; }
        if (showDrawer) { setShowDrawer(false); return; }
        if (showContactsModal) { setShowContactsModal(false); return; }
        if (showCreateModal) { setShowCreateModal(null); return; }
        if (confirmModal) { setConfirmModal(null); return; }
        if (chatContextMenu) { setChatContextMenu(null); return; }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showPwaGuideModal, showDrawer, showContactsModal, showCreateModal, confirmModal, chatContextMenu]);

  const [selectedMembers, setSelectedMembers] = useState<User[]>([]);

  // Contacts state
  const [contactUsers, setContactUsers] = useState<User[]>([]);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [showAddContactSearch, setShowAddContactSearch] = useState(false);
  const [allUsersList, setAllUsersList] = useState<User[]>([]);

  // Global Search State
  const [globalResults, setGlobalResults] = useState<{ users: User[]; publicChats: Chat[] }>({ users: [], publicChats: [] });
  const [isSearching, setIsSearching] = useState(false);

  const groupAvatarInputRef = useRef<HTMLInputElement>(null);

  // Load User's Contacts
  const userContactIds = useMemo(() => {
    return currentUser.contacts || [];
  }, [currentUser.contacts]);

  // Fetch users corresponding to userContactIds
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        const contacts: User[] = [];
        const all: User[] = [];
        snap.forEach((d: any) => {
          const u = d.data() as User;
          if (u.id !== currentUser.id && u.id !== 'ai-assistant') {
            all.push(u);
            if (userContactIds.includes(u.id)) {
              contacts.push(u);
            }
          }
        });
        setContactUsers(contacts);
        setAllUsersList(all);
      } catch (e) {
        console.error("Error loading contacts:", e);
      }
    };
    fetchContacts();
  }, [userContactIds, currentUser.id, showContactsModal, showCreateModal]);

  // Handle Group Avatar Upload
  const handleGroupAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 256, 256, 0.85);
      setGroupAvatar(compressed);
    } catch (err) {
      console.error("Failed to compress group avatar:", err);
    }
  };

  // Search Firebase Logic (Users + Public Groups & Channels)
  useEffect(() => {
    const qTrimmed = searchQuery.trim().toLowerCase().replace('@', '');
    if (qTrimmed.length < 2) {
       setGlobalResults({ users: [], publicChats: [] });
       setIsSearching(false);
       return;
    }

    const timer = setTimeout(async () => {
       setIsSearching(true);
       try {
          // 1. Search Users
          const userSnap = await getDocs(collection(db, "users"));
          const matchedUsers: User[] = [];
          userSnap.forEach((doc: any) => {
             const u = doc.data() as User;
             if (u.id !== currentUser.id && (
               u.username.toLowerCase().includes(qTrimmed) || 
               u.displayName.toLowerCase().includes(qTrimmed)
             )) {
               matchedUsers.push(u);
             }
          });

          // 2. Search Public Groups & Channels
          const chatSnap = await getDocs(collection(db, "chats"));
          const matchedChats: Chat[] = [];
          chatSnap.forEach((doc: any) => {
            const c = doc.data() as Chat;
            if (c.type === 'channel' || c.isPublic) {
              const nameMatch = c.groupName?.toLowerCase().includes(qTrimmed);
              const handleMatch = c.publicHandle?.toLowerCase().includes(qTrimmed);
              if (nameMatch || handleMatch) {
                matchedChats.push(c);
              }
            }
          });

          setGlobalResults({ users: matchedUsers, publicChats: matchedChats });
       } catch (e) {
         console.error(e);
       } finally {
         setIsSearching(false);
       }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, currentUser.id]);

  const handleTouchStart = (e: React.TouchEvent, chat: Chat) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      setChatContextMenu({
        x: touch.clientX,
        y: touch.clientY,
        chat
      });
    }, 450);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchTimerRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPos.current.x);
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);
    if (dx > 10 || dy > 10) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleContextMenu = (e: React.MouseEvent, chat: Chat) => {
    e.preventDefault();
    e.stopPropagation();
    setChatContextMenu({
      x: e.clientX,
      y: e.clientY,
      chat
    });
  };

  // Separate regular vs archived chats, apply folder filter & pinned sorting
  const { mainChats, archivedChats } = useMemo(() => {
    const validChats = chats.filter(c => !c.deletedForUserIds?.includes(currentUser.id));

    const archived: Chat[] = [];
    const regular: Chat[] = [];

    validChats.forEach(chat => {
      if (chat.isArchived) {
        archived.push(chat);
      } else {
        regular.push(chat);
      }
    });

    const filterByFolder = (list: Chat[]) => {
      return list.filter(chat => {
        if (activeFolder === 'all') return true;
        if (activeFolder === 'private') return chat.type === 'private';
        if (activeFolder === 'groups') return chat.type === 'group';
        if (activeFolder === 'channels') return chat.type === 'channel';
        if (activeFolder === 'saved') return chat.type === 'saved';
        return true;
      });
    };

    const sortChats = (list: Chat[]) => {
      return [...list].sort((a, b) => {
        // Pinned chats first
        if (a.isPinnedInSidebar && !b.isPinnedInSidebar) return -1;
        if (!a.isPinnedInSidebar && b.isPinnedInSidebar) return 1;
        // Then by lastMessage timestamp
        const timeA = a.lastMessage?.timestamp || 0;
        const timeB = b.lastMessage?.timestamp || 0;
        return timeB - timeA;
      });
    };

    return {
      mainChats: sortChats(filterByFolder(regular)),
      archivedChats: sortChats(filterByFolder(archived))
    };
  }, [chats, activeFolder, currentUser.id]);

  // Compute unread badges per folder
  const unreadCounts = useMemo(() => {
    const counts = { all: 0, private: 0, groups: 0, channels: 0, saved: 0 };
    const validChats = chats.filter(c => !c.deletedForUserIds?.includes(currentUser.id));
    validChats.forEach(c => {
      const unread = c.unreadCount || 0;
      counts.all += unread;
      if (c.type === 'private') counts.private += unread;
      if (c.type === 'group') counts.groups += unread;
      if (c.type === 'channel') counts.channels += unread;
    });
    return counts;
  }, [chats, currentUser.id]);
  
  const folders: { id: FolderType; icon: any; label: string; count: number }[] = [
    { id: 'all', icon: MessageCircle, label: 'همه', count: unreadCounts.all },
    { id: 'private', icon: Users, label: 'شخصی', count: unreadCounts.private },
    { id: 'groups', icon: Users, label: 'گروه‌ها', count: unreadCounts.groups },
    { id: 'channels', icon: Megaphone, label: 'کانال‌ها', count: unreadCounts.channels },
    { id: 'saved', icon: Bookmark, label: 'ذخیره‌شده', count: 0 },
  ];

  const toggleSelectMember = (u: User) => {
    if (selectedMembers.some(m => m.id === u.id)) {
      setSelectedMembers(prev => prev.filter(m => m.id !== u.id));
    } else {
      setSelectedMembers(prev => [...prev, u]);
    }
  };

  const resetModal = () => {
    setShowCreateModal(null);
    setCreateStep(1);
    setNewName('');
    setNewDesc('');
    setIsPublicGroup(false);
    setPublicHandle('');
    setGroupAvatar('');
    setSelectedMembers([]);
  };

  // Filtered contacts in contacts modal
  const filteredContacts = contactUsers.filter(u => 
    u.displayName.toLowerCase().includes(contactSearchQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(contactSearchQuery.toLowerCase())
  );

  // Exact username lookup for adding new contacts (strictly by exact username/ID)
  const cleanTargetUsername = contactSearchQuery.trim().toLowerCase().replace(/^@/, '');
  const exactMatchedUser = (cleanTargetUsername.length >= 2)
    ? allUsersList.find(u => u.username.toLowerCase() === cleanTargetUsername && u.id !== currentUser.id)
    : null;

  return (
    <div className="flex flex-col h-full w-full bg-[#17212b] border-l border-black/20 relative select-none">
      {/* Header */}
      <div className="p-3 flex items-center gap-2.5 bg-[#17212b] border-b border-white/5 shrink-0">
        <button 
          onClick={() => setShowDrawer(true)} 
          className="p-2 text-[#708499] hover:text-white hover:bg-white/5 rounded-full transition-all active:scale-95 shrink-0"
          title="منوی اصلی"
        >
          <Menu size={22} />
        </button>
        <div className="flex-1 relative">
           <Search size={18} className="absolute right-3.5 top-2.5 text-[#708499]" />
           <input 
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
             placeholder="جستجو پیام، کاربر یا کانال..."
             className="w-full bg-[#242f3d] py-2 pr-10 pl-4 rounded-full text-[13px] outline-none text-white focus:bg-[#0e1621] transition-colors border border-transparent focus:border-[#3390ec]/30"
           />
           {searchQuery && (
             <button 
               onClick={() => setSearchQuery('')}
               className="absolute left-3 top-2.5 text-[#708499] hover:text-white"
             >
               <X size={16}/>
             </button>
           )}
        </div>
        <div 
          onClick={() => setShowDrawer(true)}
          className="cursor-pointer hover:opacity-85 transition-opacity shrink-0"
          title="استارلی چت"
        >
          <StarChatLogo variant="symbol" size={32} />
        </div>
      </div>

      {/* Stories Bar */}
      <StoriesBar
        stories={stories}
        currentUser={currentUser}
        onOpenCreateStory={onOpenCreateStory}
        onViewStory={onViewStory}
        canCreateStory={systemConfig?.allowStories !== false}
      />

      {/* Folders Bar */}
      <div className="flex items-center px-1 overflow-x-auto no-scrollbar border-b border-white/5 shrink-0 bg-[#17212b]/80">
         {folders.map(f => (
            <button 
              key={f.id} 
              onClick={() => setActiveFolder(f.id)}
              className={`flex flex-col items-center justify-center py-2.5 px-3 min-w-[68px] relative border-b-[2px] transition-all active:scale-95 ${activeFolder === f.id ? 'border-[#3390ec] text-[#3390ec]' : 'border-transparent text-[#708499] hover:text-white hover:bg-white/5'}`}
            >
              <div className="relative">
                <f.icon size={20} className="mb-0.5"/>
                {f.count > 0 && (
                  <span className="absolute -top-1 -right-2 bg-[#3390ec] text-white text-[9px] font-bold px-1 rounded-full min-w-[14px] h-[14px] flex items-center justify-center">
                    {f.count}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium tracking-tight">{f.label}</span>
            </button>
         ))}
      </div>

      {/* Chat / Search Results List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {searchQuery.trim().length >= 2 ? (
           <div className="p-2 space-y-3">
              {isSearching ? (
                <div className="text-center text-[#708499] text-xs py-8 animate-pulse">درحال جستجوی سراسری...</div>
              ) : (
                <>
                  {/* Public Groups & Channels Results */}
                  {globalResults.publicChats.length > 0 && (
                    <div>
                      <div className="text-[11px] font-bold text-[#3390ec] px-2 mb-1.5 flex items-center gap-1">
                        <Globe size={13}/>
                        گروه‌ها و کانال‌های عمومی
                      </div>
                      <div className="space-y-1">
                        {globalResults.publicChats.map(c => (
                          <div 
                            key={c.id} 
                            onClick={() => { setActiveChatId(c.id); setSearchQuery(''); }}
                            className="flex items-center gap-3 p-2.5 hover:bg-[#2b5278]/25 rounded-xl cursor-pointer transition-all active:scale-[0.99]"
                          >
                            <img src={c.groupAvatar || ''} className="w-11 h-11 rounded-full bg-[#242f3d] object-cover border border-white/5"/>
                            <div className="flex-1 min-w-0">
                               <div className="flex items-center gap-1.5">
                                 <h4 className="font-bold text-white text-[13px] truncate">{c.groupName}</h4>
                                 {c.isPublic && <span className="text-[10px] bg-[#3390ec]/20 text-[#3390ec] px-1.5 rounded font-medium">عمومی</span>}
                               </div>
                               <p className="text-xs text-[#708499] truncate">
                                 {c.publicHandle ? `@${c.publicHandle}` : `${c.participants?.length || 1} عضو`}
                               </p>
                            </div>
                            <span className="text-xs text-[#3390ec] bg-[#3390ec]/10 px-2.5 py-1 rounded-lg font-medium">
                              مشاهده
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Users Results */}
                  {globalResults.users.length > 0 && (
                    <div>
                      <div className="text-[11px] font-bold text-[#3390ec] px-2 mb-1.5 flex items-center gap-1">
                        <Users size={13}/>
                        کاربران
                      </div>
                      <div className="space-y-1">
                        {globalResults.users.map(u => (
                          <div 
                            key={u.id} 
                            onClick={() => { onStartChat(u); setSearchQuery(''); }} 
                            className="flex items-center gap-3 p-2.5 hover:bg-[#2b5278]/25 rounded-xl cursor-pointer transition-all active:scale-[0.99] group"
                          >
                            <img 
                              src={u.avatar || DEFAULT_AVATAR} 
                              onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                              className="w-11 h-11 rounded-full bg-[#242f3d] object-cover border border-white/5"
                            />
                            <div className="flex-1 min-w-0">
                               <h4 className="font-bold text-white text-[13px] truncate">{u.displayName}</h4>
                               <p className="text-xs text-[#708499] truncate">@{u.username}</p>
                            </div>
                            <span className="text-xs text-[#3390ec] bg-[#3390ec]/10 px-2.5 py-1 rounded-lg font-medium">
                              گفتگو
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {globalResults.users.length === 0 && globalResults.publicChats.length === 0 && (
                    <div className="text-center text-[#708499] text-xs py-8">
                      نتیجه‌ای برای &quot;{searchQuery}&quot; یافت نشد.
                    </div>
                  )}
                </>
              )}
           </div>
        ) : (
          <div className="p-2 space-y-1">
            {/* Expandable Archived Chats Folder at top of list */}
            {archivedChats.length > 0 && (
              <div className="mb-2">
                <div 
                  onClick={() => setIsArchiveExpanded(!isArchiveExpanded)}
                  className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-[#242f3d]/70 transition-colors bg-[#1c2733] border border-white/5 active:scale-[0.99]"
                >
                  <div className="w-12 h-12 rounded-full bg-[#2b5278]/40 border border-[#3390ec]/20 flex items-center justify-center shrink-0 text-[#3390ec]">
                    <Archive size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <h4 className="font-bold text-[14px] text-white">گفتگوهای آرشیو شده</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] bg-[#3390ec]/20 text-[#3390ec] font-bold px-2 py-0.5 rounded-full tabular-nums">
                          {archivedChats.length}
                        </span>
                        {isArchiveExpanded ? <ChevronUp size={16} className="text-[#708499]" /> : <ChevronDown size={16} className="text-[#708499]" />}
                      </div>
                    </div>
                    <p className="text-[12px] text-[#708499] truncate">
                      {isArchiveExpanded ? 'جهت بستن پوشه کلیک کنید' : 'برای مشاهده گفتگوهای ذخیره شده در بایگانی کلیک کنید'}
                    </p>
                  </div>
                </div>
                {isArchiveExpanded && (
                  <div className="mt-1.5 pr-2.5 border-r-2 border-[#3390ec]/30 space-y-1 bg-black/10 py-1.5 rounded-xl animate-in slide-in-from-top duration-150">
                    {archivedChats.map(chat => {
                      const other = chat.participants.find(p => p.id !== currentUser.id);
                      const title = chat.type === 'private' ? (other?.displayName || 'کاربر') : (chat.type === 'saved' ? 'پیام‌های ذخیره شده' : chat.groupName);
                      const avatar = chat.type === 'private' ? other?.avatar : chat.groupAvatar;
                      const clearTime = chat.clearedAt?.[currentUser.id] || 0;
              const visibleMsgs = (chat.messages || []).filter(m => m.timestamp > clearTime);
              const lastMsg = visibleMsgs.length > 0 ? visibleMsgs[visibleMsgs.length - 1] : (chat.lastMessage && chat.lastMessage.timestamp > clearTime ? chat.lastMessage : undefined);
                      const isSelected = activeChatId === chat.id;
                      const hasReactions = Boolean(
                        chat.messages?.some(m => Array.isArray(m.reactions) && m.reactions.length > 0 && m.reactions.some(r => r.count > 0)) ||
                        (chat.lastMessage?.reactions && chat.lastMessage.reactions.length > 0 && chat.lastMessage.reactions.some(r => r.count > 0))
                      );

                      return (
                        <div 
                          key={chat.id} 
                          onClick={() => {
                            setActiveChatId(chat.id);
                            if (chat.unreadCount > 0 && onMarkReadChat) {
                              onMarkReadChat(chat.id);
                            }
                          }} 
                          onContextMenu={(e) => handleContextMenu(e, chat)}
                          onTouchStart={(e) => handleTouchStart(e, chat)}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={handleTouchEnd}
                          className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-150 active:scale-[0.98] select-none ${isSelected ? 'bg-[#3390ec] shadow-md shadow-[#3390ec]/20' : 'hover:bg-[#242f3d]/60'}`}
                        >
                          <div className="relative shrink-0">
                            {chat.type === 'saved' ? (
                              <div className="w-12 h-12 rounded-full bg-[#3390ec] flex items-center justify-center shadow-inner">
                                <Bookmark size={22} className="text-white fill-current"/>
                              </div>
                            ) : (
                              <img 
                                src={avatar || DEFAULT_AVATAR} 
                                onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                                className="w-12 h-12 rounded-full bg-[#242f3d] object-cover border border-white/5"
                              />
                            )}
                            {chat.type === 'private' && other && getUserPresence(other, (currentUser.contacts || []).includes(other.id)).isOnline && (
                              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[#17212b] rounded-full"/>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-0.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <h4 className="font-bold text-[14px] truncate text-white">
                                  {title}
                                </h4>
                                {chat.isMuted && (
                                  <BellOff size={13} className={isSelected ? 'text-white/70' : 'text-[#708499]'} />
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {chat.isPinnedInSidebar && (
                                  <Pin size={13} className={`transform rotate-45 ${isSelected ? 'text-white' : 'text-[#3390ec]'}`} />
                                )}
                                {lastMsg && (
                                  <span className={`text-[10px] tabular-nums ${isSelected ? 'text-white/80' : 'text-[#708499]'}`}>
                                    {new Date(lastMsg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                              <p className={`text-[12px] truncate max-w-[200px] ${isSelected ? 'text-white/85' : 'text-[#708499]'}`}>
                                {lastMsg ? (lastMsg.senderId === currentUser.id ? 'شما: ' : '') + (lastMsg.text || (lastMsg.imageUrl ? 'تصویر' : (lastMsg.audioUrl ? 'پیام صوتی' : 'پیام'))) : 'پیامی ارسال نشده'}
                              </p>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {hasReactions && (
                                  <span title="دارای ری‌اکشن به پیام‌ها" className="inline-flex items-center justify-center">
                                    <Heart size={13} className="text-rose-500 fill-rose-500 drop-shadow-[0_0_5px_rgba(244,63,94,0.4)]" />
                                  </span>
                                )}
                                {(() => {
                                  const badgeCount = getChatUnseenCount(chat, currentUser.id);
                                  if (badgeCount <= 0) return null;
                                  return (
                                    <div 
                                      className={`px-2 py-0.5 min-w-[20px] h-[20px] rounded-full text-[10.5px] flex items-center justify-center font-bold tabular-nums shadow-sm transition-all duration-200 animate-in zoom-in-75 ${
                                        isSelected ? 'bg-white text-[#3390ec]' : 'bg-[#3390ec] text-white shadow-[#3390ec]/30'
                                      }`}
                                      title={`${badgeCount} پیام خوانده‌نشده جدید`}
                                    >
                                      {badgeCount > 99 ? '+99' : badgeCount}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Main Non-Archived Chats */}
            {mainChats.map(chat => {
              const other = chat.participants.find(p => p.id !== currentUser.id);
              const title = chat.type === 'private' ? (other?.displayName || 'کاربر') : (chat.type === 'saved' ? 'پیام‌های ذخیره شده' : chat.groupName);
              const avatar = chat.type === 'private' ? other?.avatar : chat.groupAvatar;
              const lastMsg = chat.lastMessage;
              const isSelected = activeChatId === chat.id;
              const hasReactions = Boolean(
                chat.messages?.some(m => Array.isArray(m.reactions) && m.reactions.length > 0 && m.reactions.some(r => r.count > 0)) ||
                (chat.lastMessage?.reactions && chat.lastMessage.reactions.length > 0 && chat.lastMessage.reactions.some(r => r.count > 0))
              );

              return (
                <div 
                  key={chat.id} 
                  onClick={() => {
                    setActiveChatId(chat.id);
                    if (chat.unreadCount > 0 && onMarkReadChat) {
                      onMarkReadChat(chat.id);
                    }
                  }} 
                  onContextMenu={(e) => handleContextMenu(e, chat)}
                  onTouchStart={(e) => handleTouchStart(e, chat)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-150 active:scale-[0.98] select-none ${isSelected ? 'bg-[#3390ec] shadow-md shadow-[#3390ec]/20' : 'hover:bg-[#242f3d]/60'}`}
                >
                  <div className="relative shrink-0">
                    {chat.type === 'saved' ? (
                      <div className="w-12 h-12 rounded-full bg-[#3390ec] flex items-center justify-center shadow-inner">
                        <Bookmark size={22} className="text-white fill-current"/>
                      </div>
                    ) : (
                      <img 
                        src={avatar || DEFAULT_AVATAR} 
                        onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                        className="w-12 h-12 rounded-full bg-[#242f3d] object-cover border border-white/5"
                      />
                    )}
                    {chat.type === 'private' && other && getUserPresence(other, (currentUser.contacts || []).includes(other.id)).isOnline && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[#17212b] rounded-full"/>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h4 className="font-bold text-[14px] truncate text-white">
                          {title}
                        </h4>
                        {chat.isMuted && (
                          <BellOff size={13} className={isSelected ? 'text-white/70' : 'text-[#708499]'} />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {chat.isPinnedInSidebar && (
                          <Pin size={13} className={`transform rotate-45 ${isSelected ? 'text-white' : 'text-[#3390ec]'}`} />
                        )}
                        {lastMsg && (
                          <span className={`text-[10px] tabular-nums ${isSelected ? 'text-white/80' : 'text-[#708499]'}`}>
                            {new Date(lastMsg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <p className={`text-[12px] truncate max-w-[200px] ${isSelected ? 'text-white/85' : 'text-[#708499]'}`}>
                        {lastMsg ? (lastMsg.senderId === currentUser.id ? 'شما: ' : '') + (lastMsg.text || (lastMsg.imageUrl ? 'تصویر' : (lastMsg.audioUrl ? 'پیام صوتی' : 'پیام'))) : 'پیامی ارسال نشده'}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasReactions && (
                          <span title="دارای ری‌اکشن به پیام‌ها" className="inline-flex items-center justify-center">
                            <Heart size={13} className="text-rose-500 fill-rose-500 drop-shadow-[0_0_5px_rgba(244,63,94,0.4)]" />
                          </span>
                        )}
                        {(() => {
                          const badgeCount = getChatUnseenCount(chat, currentUser.id);
                          if (badgeCount <= 0) return null;
                          return (
                            <div 
                              className={`px-2 py-0.5 min-w-[20px] h-[20px] rounded-full text-[10.5px] flex items-center justify-center font-bold tabular-nums shadow-sm transition-all duration-200 animate-in zoom-in-75 ${
                                isSelected ? 'bg-white text-[#3390ec]' : 'bg-[#3390ec] text-white shadow-[#3390ec]/30'
                              }`}
                              title={`${badgeCount} پیام خوانده‌نشده جدید`}
                            >
                              {badgeCount > 99 ? '+99' : badgeCount}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {mainChats.length === 0 && archivedChats.length === 0 && (
              <div className="text-center text-[#708499] text-xs py-12">
                پیامی در این پوشه وجود ندارد.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <div className="absolute bottom-5 left-5 z-10">
         <button 
           onClick={() => setShowCreateModal('group')} 
           className="w-13 h-13 p-3 bg-[#3390ec] hover:bg-[#2881d9] text-white rounded-full shadow-xl shadow-[#3390ec]/35 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
           title="ایجاد گروه جدید"
         >
            <Plus size={26}/>
         </button>
      </div>
      
      {/* Telegram Drawer Menu with Spring Animation & Glassmorphism */}
      {showDrawer && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" 
          onClick={() => setShowDrawer(false)}
        >
          <div 
            className="h-full w-[295px] bg-[#17212b] shadow-2xl flex flex-col animate-in slide-in-from-right duration-250 ease-out border-l border-white/5" 
            onClick={e => e.stopPropagation()}
          >
             {/* Profile Header Card */}
             <div 
               onClick={() => { onOpenMyProfile(); setShowDrawer(false); }}
               className="bg-[#242f3d] p-5 pb-4 border-b border-white/5 relative overflow-hidden cursor-pointer hover:bg-[#2b3a4a] transition-colors group"
               title="مشاهده و ویرایش پروفایل من"
             >
                <div className="absolute -left-10 -top-10 w-32 h-32 bg-[#3390ec]/15 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between mb-3">
                  <div className="w-16 h-16 rounded-full relative bg-[#17212b]">
                     <img 
                       src={currentUser.avatar || DEFAULT_AVATAR} 
                       onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                       className="w-full h-full rounded-full object-cover border-2 border-[#3390ec]/40 shadow-lg"
                     />
                     <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#242f3d]" />
                  </div>
                  <span className="text-[11px] text-[#3390ec] group-hover:underline flex items-center gap-1 bg-[#17212b]/60 px-2.5 py-1 rounded-lg border border-white/5">
                    ویرایش پروفایل
                  </span>
                </div>
                <h3 className="font-bold text-white text-[15px] leading-tight flex items-center gap-1.5">
                  <span>{currentUser.displayName}</span>
                  {currentUser.role === 'superadmin' && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-500/30 font-normal">مدیر</span>
                  )}
                </h3>
                <p className="text-xs text-[#3390ec] mt-0.5" dir="ltr">@{currentUser.username}</p>
                {currentUser.bio && <p className="text-xs text-[#708499] mt-2 line-clamp-2 leading-relaxed">{currentUser.bio}</p>}
             </div>

             {/* Menu Actions */}
             <div className="p-2 space-y-1 flex-1 overflow-y-auto custom-scrollbar">
                {/* My Profile Menu Item */}
                <button 
                  onClick={() => { onOpenMyProfile(); setShowDrawer(false); }} 
                  className="w-full p-3 flex items-center gap-3.5 text-white hover:bg-white/5 rounded-xl transition-all active:scale-[0.98] text-sm group"
                >
                  <UserIcon size={19} className="text-[#708499] group-hover:text-[#3390ec] transition-colors"/> 
                  <span className="font-medium">پروفایل من</span>
                </button>

                {/* Saved Messages Menu Item */}
                <button 
                  onClick={() => { 
                    if (onOpenSavedMessages) {
                      onOpenSavedMessages();
                    } else {
                      setActiveChatId(`saved_${currentUser.id}`);
                    }
                    setShowDrawer(false); 
                  }} 
                  className="w-full p-3 flex items-center gap-3.5 text-white hover:bg-white/5 rounded-xl transition-all active:scale-[0.98] text-sm group"
                >
                  <Bookmark size={19} className="text-[#708499] group-hover:text-[#3390ec] transition-colors"/> 
                  <span className="font-medium">پیام‌های ذخیره شده</span>
                </button>

                {/* Contacts Menu Item */}
                <button 
                  onClick={() => { setShowContactsModal(true); setShowDrawer(false); }} 
                  className="w-full p-3 flex items-center gap-3.5 text-white hover:bg-white/5 rounded-xl transition-all active:scale-[0.98] text-sm group"
                >
                  <Users size={19} className="text-[#708499] group-hover:text-[#3390ec] transition-colors"/> 
                  <span className="font-medium">مخاطبین</span>
                  {userContactIds.length > 0 && (
                    <span className="mr-auto text-[11px] text-[#708499] tabular-nums font-bold">
                      {userContactIds.length}
                    </span>
                  )}
                </button>

                <button 
                  onClick={() => { 
                    if (systemConfig?.allowGroupCreation === false) {
                      alert('ساخت گروه جدید توسط مدیریت سیستم موقتاً غیرفعال شده است.');
                      return;
                    }
                    setShowCreateModal('group'); 
                    setShowDrawer(false); 
                  }} 
                  className="w-full p-3 flex items-center gap-3.5 text-white hover:bg-white/5 rounded-xl transition-all active:scale-[0.98] text-sm group"
                >
                  <Users size={19} className="text-[#708499] group-hover:text-[#3390ec] transition-colors"/> 
                  <span className="font-medium">گروه جدید</span>
                  {systemConfig?.allowGroupCreation === false && (
                    <span className="mr-auto text-[10px] text-gray-500">غیرفعال</span>
                  )}
                </button>

                <button 
                  onClick={() => { 
                    if (systemConfig?.allowChannelCreation === false) {
                      alert('ساخت کانال جدید توسط مدیریت سیستم موقتاً غیرفعال شده است.');
                      return;
                    }
                    setShowCreateModal('channel'); 
                    setShowDrawer(false); 
                  }} 
                  className="w-full p-3 flex items-center gap-3.5 text-white hover:bg-white/5 rounded-xl transition-all active:scale-[0.98] text-sm group"
                >
                  <Megaphone size={19} className="text-[#708499] group-hover:text-[#3390ec] transition-colors"/> 
                  <span className="font-medium">کانال جدید</span>
                  {systemConfig?.allowChannelCreation === false && (
                    <span className="mr-auto text-[10px] text-gray-500">غیرفعال</span>
                  )}
                </button>

                {/* Super Admin Panel Button */}
                {(currentUser.role === 'superadmin' || currentUser.role === 'admin') && (
                  <button 
                    onClick={() => { onOpenAdminPanel(); setShowDrawer(false); }} 
                    className="w-full p-3 flex items-center justify-between text-white bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl transition-all active:scale-[0.98] text-sm group my-1"
                  >
                    <div className="flex items-center gap-3">
                      <Shield size={19} className="text-amber-400 group-hover:scale-110 transition-transform"/> 
                      <span className="font-bold text-amber-200">پنل مدیریت سیستم</span>
                    </div>
                    <span className="text-[10px] bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full font-semibold">
                      Admin
                    </span>
                  </button>
                )}

                
                {/* PWA Install Button (Hidden when inside standalone PWA) */}
                {!isPWA && (
                  <button 
                    onClick={handleInstallPWA}
                    className="w-full p-3 flex items-center justify-between text-white bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-all active:scale-[0.98] text-sm group my-1"
                  >
                    <div className="flex items-center gap-3">
                      <Download size={19} className="text-emerald-400 group-hover:scale-110 transition-transform"/> 
                      <span className="font-bold text-emerald-200">نصب اپلیکیشن (PWA)</span>
                    </div>
                    <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-full font-semibold">
                      وب‌اپ
                    </span>
                  </button>
                )}

                <button 
                  onClick={() => { onOpenSettings(); setShowDrawer(false); }} 
                  className="w-full p-3 flex items-center gap-3.5 text-white hover:bg-white/5 rounded-xl transition-all active:scale-[0.98] text-sm group"
                >
                  <Settings size={19} className="text-[#708499] group-hover:text-[#3390ec] transition-colors"/> 
                  <span className="font-medium">تنظیمات</span>
                </button>

                <div className="h-px bg-white/5 my-2"/>

                <button 
                  onClick={onLogout} 
                  className="w-full p-3 flex items-center gap-3.5 text-red-400 hover:bg-red-500/10 rounded-xl transition-all active:scale-[0.98] text-sm"
                >
                  <LogOut size={19}/> 
                  <span className="font-medium">خروج از حساب</span>
                </button>

                <div className="pt-3 pb-1 px-3 flex items-center justify-between text-[11px] text-[#708499] border-t border-white/5 mt-2">
                  <div className="flex items-center gap-2">
                    <StarChatLogo variant="symbol" size={20} />
                    <span className="font-medium">استارلی چت</span>
                  </div>
                  <span className="font-mono text-[10px] opacity-70">Cloud Edition</span>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Contacts Modal (مخاطبین) */}
      {showContactsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-[#17212b] rounded-2xl overflow-hidden shadow-2xl animate-pop border border-white/10 flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#242f3d] shrink-0">
              <div className="flex items-center gap-2">
                <Users size={19} className="text-[#3390ec]" />
                <h3 className="font-bold text-white text-[15px]">مخاطبین</h3>
              </div>
              <button onClick={() => setShowContactsModal(false)} className="p-1.5 hover:bg-white/10 rounded-full text-[#708499]">
                <X size={18}/>
              </button>
            </div>

            {/* Contacts Search Bar */}
            <div className="p-3 border-b border-white/5 bg-[#17212b] shrink-0 space-y-2">
              <div className="relative">
                <Search size={16} className="absolute right-3 top-2.5 text-[#708499]" />
                <input 
                  value={contactSearchQuery}
                  onChange={e => setContactSearchQuery(e.target.value)}
                  placeholder="جستجو در مخاطبین یا کاربران جدید..."
                  className="w-full bg-[#242f3d] py-2 pr-9 pl-3 rounded-xl text-xs outline-none text-white focus:bg-[#0e1621] transition-colors"
                />
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => setShowAddContactSearch(false)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${!showAddContactSearch ? 'bg-[#3390ec] text-white' : 'bg-[#242f3d] text-[#708499] hover:text-white'}`}
                >
                  مخاطبین من ({contactUsers.length})
                </button>
                <button 
                  onClick={() => setShowAddContactSearch(true)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 ${showAddContactSearch ? 'bg-[#3390ec] text-white' : 'bg-[#242f3d] text-[#708499] hover:text-white'}`}
                >
                  <UserPlus size={14}/> افزودن مخاطب جدید
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
              {!showAddContactSearch ? (
                // My Contacts
                <>
                  {filteredContacts.map(u => (
                    <div 
                      key={u.id}
                      className="flex items-center justify-between p-2.5 hover:bg-white/5 rounded-xl transition-colors group"
                    >
                      <div 
                        className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                        onClick={() => { onStartChat(u); setShowContactsModal(false); }}
                      >
                        <div className="relative shrink-0">
                          <img 
                            src={u.avatar || DEFAULT_AVATAR} 
                            onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                            className="w-10 h-10 rounded-full object-cover bg-[#242f3d]"
                          />
                          {getUserPresence(u).isOnline && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#17212b]"/>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs text-white truncate">{u.displayName}</h4>
                          <p className="text-[10px] text-[#708499] truncate">@{u.username}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button 
                          onClick={() => { onStartChat(u); setShowContactsModal(false); }}
                          className="px-2.5 py-1 text-xs bg-[#3390ec]/20 hover:bg-[#3390ec] text-[#3390ec] hover:text-white rounded-lg transition-colors font-medium"
                        >
                          گفتگو
                        </button>
                        {onToggleContact && (
                          <button 
                            onClick={() => onToggleContact(u)}
                            className="p-1.5 text-[#708499] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="حذف از مخاطبین"
                          >
                            <Trash size={14}/>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {filteredContacts.length === 0 && (
                    <div className="text-center text-[#708499] text-xs py-10 space-y-2">
                      <p>مخاطبی در لیست شما وجود ندارد.</p>
                      <button 
                        onClick={() => setShowAddContactSearch(true)} 
                        className="text-[#3390ec] font-bold text-xs hover:underline"
                      >
                        + افزودن مخاطب جدید
                      </button>
                    </div>
                  )}
                </>
              ) : (
                // Add new contact by EXACT ID / USERNAME ONLY
                <div className="py-2 space-y-4">
                  <div className="p-3 bg-[#242f3d]/60 rounded-xl border border-white/5 space-y-1">
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Shield size={14} className="text-[#3390ec]" />
                      افزودن با شناسه کاربری (آیدی دقیق)
                    </p>
                    <p className="text-[11px] text-[#708499] leading-relaxed">
                      برای حفظ حریم خصوصی کاربران، فهرست کلی مخاطبان نمایش داده نمی‌شود. لطفاً آیدی دقیق مخاطب مورد نظر خود را در کادر جستجو وارد کنید.
                    </p>
                  </div>

                  {exactMatchedUser ? (
                    // Exact Matched User Card
                    <div className="p-3 bg-[#242f3d] rounded-2xl border border-[#3390ec]/30 space-y-3 animate-in fade-in">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <img 
                            src={exactMatchedUser.avatar || DEFAULT_AVATAR} 
                            onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                            className="w-12 h-12 rounded-full object-cover bg-[#17212b]"
                          />
                          {getUserPresence(exactMatchedUser).isOnline && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#242f3d]"/>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-white truncate">{exactMatchedUser.displayName}</h4>
                          <p className="text-xs text-[#3390ec] font-mono truncate" dir="ltr">@{exactMatchedUser.username}</p>
                          {exactMatchedUser.bio && (
                            <p className="text-[11px] text-[#708499] truncate mt-0.5">{exactMatchedUser.bio}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                        {userContactIds.includes(exactMatchedUser.id) ? (
                          <div className="flex-1 py-2 text-center text-xs font-bold text-emerald-400 bg-emerald-500/10 rounded-xl">
                            ✓ در مخاطبین شما وجود دارد
                          </div>
                        ) : (
                          onToggleContact && (
                            <button 
                              onClick={() => onToggleContact(exactMatchedUser)}
                              className="flex-1 py-2 bg-[#3390ec] hover:bg-[#2881d9] text-white rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-md shadow-[#3390ec]/20"
                            >
                              <UserPlus size={14} /> افزودن به مخاطبین
                            </button>
                          )
                        )}
                        <button 
                          onClick={() => { onStartChat(exactMatchedUser); setShowContactsModal(false); }}
                          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all"
                        >
                          شروع گفتگو
                        </button>
                      </div>
                    </div>
                  ) : cleanTargetUsername.length >= 2 ? (
                    // Not Found with Exact Search
                    <div className="text-center py-8 px-4 bg-[#242f3d]/30 rounded-2xl border border-dashed border-white/10 space-y-2">
                      <div className="w-10 h-10 mx-auto rounded-full bg-red-500/10 text-red-400 flex items-center justify-center">
                        <X size={20} />
                      </div>
                      <p className="text-xs font-bold text-white">کاربری با آیدی «@{cleanTargetUsername}» یافت نشد</p>
                      <p className="text-[11px] text-[#708499]">لطفاً از املای دقیق آیدی اطمینان حاصل فرمایید.</p>
                    </div>
                  ) : (
                    // Prompt to enter username
                    <div className="text-center py-10 px-4 text-[#708499] space-y-2">
                      <div className="w-12 h-12 mx-auto rounded-full bg-white/5 text-[#3390ec] flex items-center justify-center">
                        <Search size={22} />
                      </div>
                      <p className="text-xs font-bold text-white/80">جستجوی کاربر با نام کاربری دقیق</p>
                      <p className="text-[11px] text-[#708499] max-w-xs mx-auto">
                        آیدی کاربر مورد نظر را در کادر بالای این پنجره تایپ کنید تا مشخصات او برای افزودن نمایش داده شود.
                      </p>
                    </div>
                  )}
                </div>              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Group / Channel Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
           <div className="w-full max-w-md bg-[#17212b] rounded-2xl overflow-hidden shadow-2xl animate-pop border border-white/10">
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#242f3d]">
                 <div className="flex items-center gap-2">
                   {createStep === 2 && (
                     <button onClick={() => setCreateStep(1)} className="p-1 hover:bg-white/10 rounded-full text-[#708499]">
                       <ChevronLeft size={20} className="rotate-180"/>
                     </button>
                   )}
                   <h3 className="font-bold text-white text-[15px]">
                     {showCreateModal === 'group' ? 'ساخت گروه جدید' : 'ساخت کانال جدید'}
                   </h3>
                 </div>
                 <button onClick={resetModal} className="p-1.5 hover:bg-white/10 rounded-full text-[#708499]">
                   <X size={18}/>
                 </button>
              </div>
              
              <div className="p-5">
                 {createStep === 1 ? (
                    <div className="space-y-4">
                       
                       {/* Prominent Large Group Avatar Picker (88px) */}
                       <div className="flex flex-col items-center justify-center my-3">
                          <input 
                            type="file" 
                            ref={groupAvatarInputRef} 
                            accept="image/*" 
                            onChange={handleGroupAvatarSelect} 
                            className="hidden" 
                          />
                          <div 
                            onClick={() => groupAvatarInputRef.current?.click()}
                            className="w-22 h-22 rounded-full relative group cursor-pointer border-2 border-dashed border-[#3390ec]/60 hover:border-[#3390ec] flex items-center justify-center overflow-hidden transition-all duration-200 hover:scale-105 shadow-xl bg-[#242f3d]"
                            title="انتخاب تصویر گروه"
                          >
                             {groupAvatar ? (
                               <img src={groupAvatar} className="w-full h-full object-cover" />
                             ) : (
                               <div className="flex flex-col items-center justify-center text-[#3390ec]">
                                  <Camera size={32} className="mb-0.5 group-hover:scale-110 transition-transform"/>
                                  <span className="text-[10px] font-bold">افزودن عکس</span>
                               </div>
                             )}
                             <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <Camera size={26}/>
                             </div>
                          </div>
                          <span className="text-[11px] text-[#708499] mt-2">عکس پروفایل {showCreateModal === 'group' ? 'گروه' : 'کانال'}</span>
                       </div>
                       
                       <div className="space-y-1">
                         <label className="text-[11px] font-bold text-[#3390ec] uppercase">نام {showCreateModal === 'group' ? 'گروه' : 'کانال'}</label>
                         <input 
                           value={newName} 
                           onChange={e=>setNewName(e.target.value)} 
                           placeholder={`نام ${showCreateModal === 'group' ? 'گروه' : 'کانال'} خود را وارد کنید...`} 
                           className="w-full bg-[#242f3d] p-3 rounded-xl outline-none text-white text-sm border border-transparent focus:border-[#3390ec] transition-all"
                           autoFocus
                         />
                       </div>

                       <div className="space-y-1">
                         <label className="text-[11px] font-bold text-[#708499] uppercase">توضیحات (اختیاری)</label>
                         <textarea 
                           value={newDesc} 
                           onChange={e=>setNewDesc(e.target.value)} 
                           placeholder="توضیحات درباره موضوع گفتگو..." 
                           className="w-full bg-[#242f3d] p-3 rounded-xl outline-none text-white text-sm border border-transparent focus:border-[#3390ec] transition-all h-18 resize-none"
                         />
                       </div>

                       {/* Public vs Private Selector for Groups */}
                       {showCreateModal === 'group' && (
                         <div className="space-y-2 pt-2 border-t border-white/5">
                            <label className="text-[11px] font-bold text-[#3390ec] uppercase">نوع دسترسی گروه</label>
                            <div className="grid grid-cols-2 gap-2">
                               <button 
                                 type="button"
                                 onClick={() => setIsPublicGroup(false)}
                                 className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 ${!isPublicGroup ? 'border-[#3390ec] bg-[#3390ec]/15' : 'border-white/10 bg-[#242f3d]/60 hover:bg-[#242f3d]'}`}
                               >
                                  <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                                    <Lock size={14} className="text-[#708499]"/>
                                    گروه خصوصی
                                  </div>
                                  <span className="text-[10px] text-[#708499] leading-tight">فقط از طریق لینک دعوت</span>
                               </button>

                               <button 
                                 type="button"
                                 onClick={() => setIsPublicGroup(true)}
                                 className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 ${isPublicGroup ? 'border-[#3390ec] bg-[#3390ec]/15' : 'border-white/10 bg-[#242f3d]/60 hover:bg-[#242f3d]'}`}
                               >
                                  <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                                    <Globe size={14} className="text-[#3390ec]"/>
                                    گروه عمومی
                                  </div>
                                  <span className="text-[10px] text-[#708499] leading-tight">قابل جستجو و پیوستن همه</span>
                               </button>
                            </div>

                            {isPublicGroup && (
                              <div className="space-y-1 animate-pop pt-1">
                                <label className="text-[10px] text-[#708499]">آیدی عمومی (نام کاربری گروه)</label>
                                <div className="relative">
                                  <span className="absolute left-3 top-2.5 text-xs text-[#708499]">@</span>
                                  <input 
                                    value={publicHandle} 
                                    onChange={e=>setPublicHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                                    placeholder="مثال: my_group" 
                                    className="w-full bg-[#242f3d] py-2.5 pr-3 pl-8 rounded-xl outline-none text-white text-xs text-left"
                                    dir="ltr"
                                  />
                                </div>
                              </div>
                            )}
                         </div>
                       )}

                       <button 
                         onClick={() => { if(newName.trim()) setCreateStep(2); }} 
                         className="w-full py-3.5 bg-[#3390ec] hover:bg-[#2881d9] rounded-xl font-bold text-white text-sm mt-3 disabled:opacity-50 transition-all active:scale-95 shadow-md shadow-[#3390ec]/20" 
                         disabled={!newName.trim()}
                       >
                         مرحله بعد: افزودن از مخاطبین
                       </button>
                    </div>
                 ) : (
                    <div className="flex flex-col h-[340px]">
                       <div className="flex justify-between items-center mb-2 px-1">
                         <h4 className="text-xs font-bold text-[#708499]">انتخاب از بین مخاطبین شما ({selectedMembers.length} نفر)</h4>
                         <span className="text-[11px] text-[#3390ec]">{contactUsers.length} مخاطب</span>
                       </div>

                       {/* List of Contacts ONLY (Not all users) */}
                       <div className="flex-1 overflow-y-auto bg-[#0e1621] rounded-xl p-2 space-y-1 mb-4 custom-scrollbar">
                          {contactUsers.map(u => {
                             const isSelected = selectedMembers.some(m => m.id === u.id);
                             return (
                               <div 
                                 key={u.id}
                                 onClick={() => toggleSelectMember(u)}
                                 className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-[#3390ec]/20 border border-[#3390ec]/30' : 'hover:bg-white/5'}`}
                               >
                                 <div className="flex items-center gap-2.5">
                                   <img src={u.avatar} className="w-9 h-9 rounded-full object-cover"/>
                                   <div>
                                     <h5 className="font-bold text-xs text-white">{u.displayName}</h5>
                                     <p className="text-[10px] text-[#708499]">@{u.username}</p>
                                   </div>
                                 </div>
                                 <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${isSelected ? 'bg-[#3390ec] border-[#3390ec]' : 'border-white/20'}`}>
                                   {isSelected && <Check size={13} className="text-white"/>}
                                 </div>
                               </div>
                             );
                          })}
                          {contactUsers.length === 0 && (
                            <div className="text-center text-[#708499] text-xs py-10 space-y-2">
                              <p>شما هنوز مخاطبی اضافه نکرده‌اید.</p>
                              <p className="text-[10px] opacity-70">می‌توانید گروه را بسازید و بعداً اعضا را دعوت کنید.</p>
                            </div>
                          )}
                       </div>

                       <button 
                         onClick={() => {
                            if (showCreateModal === 'group') {
                              onCreateGroup(newName.trim(), newDesc.trim(), selectedMembers, isPublicGroup, publicHandle, groupAvatar || undefined);
                            } else {
                              onCreateChannel(newName.trim(), newDesc.trim(), selectedMembers, groupAvatar || undefined);
                            }
                            resetModal();
                         }} 
                         className="w-full py-3.5 bg-[#3390ec] hover:bg-[#2881d9] rounded-xl font-bold text-white text-sm transition-all active:scale-95 shadow-md shadow-[#3390ec]/20"
                       >
                         تکمیل و ساخت {showCreateModal === 'group' ? (isPublicGroup ? 'گروه عمومی' : 'گروه خصوصی') : 'کانال'}
                       </button>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Chat Floating Context Menu (Right-Click & Mobile Long-Press) */}
      {chatContextMenu && (
        <div 
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs animate-in fade-in"
          onClick={() => setChatContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setChatContextMenu(null); }}
        >
          <div 
            className="fixed bg-[#17212b] border border-white/10 rounded-2xl shadow-2xl p-1.5 w-60 space-y-0.5 animate-pop z-50 text-xs text-right"
            style={{
              top: `${Math.max(10, Math.min(chatContextMenu.y, window.innerHeight - 300))}px`,
              left: `${Math.max(10, Math.min(chatContextMenu.x, window.innerWidth - 260))}px`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header info */}
            <div className="px-3 py-2 border-b border-white/5 mb-1">
              <span className="font-bold text-white text-[13px] block truncate">
                {chatContextMenu.chat.type === 'saved' ? 'پیام‌های ذخیره شده' : (chatContextMenu.chat.type === 'private' ? (chatContextMenu.chat.participants.find(p => p.id !== currentUser.id)?.displayName || 'گفتگو') : chatContextMenu.chat.groupName)}
              </span>
              <span className="text-[10px] text-[#708499]">
                {chatContextMenu.chat.type === 'saved' ? 'فضای ابری اختصاصی شما' : (chatContextMenu.chat.type === 'private' ? 'گفتگوی شخصی' : (chatContextMenu.chat.type === 'group' ? 'گروه' : 'کانال'))}
              </span>
            </div>

            {/* Pin / Unpin */}
            <button 
              onClick={() => {
                onPinChat?.(chatContextMenu.chat.id);
                setChatContextMenu(null);
              }}
              className="w-full flex items-center gap-3 p-2.5 hover:bg-white/5 rounded-xl text-white transition-colors text-right"
            >
              {chatContextMenu.chat.isPinnedInSidebar ? (
                <>
                  <PinOff size={16} className="text-[#708499] shrink-0" />
                  <span className="flex-1">برداشتن سنجاق (Unpin)</span>
                </>
              ) : (
                <>
                  <Pin size={16} className="text-[#3390ec] shrink-0" />
                  <span className="flex-1">سنجاق کردن گفتگو (Pin)</span>
                </>
              )}
            </button>

            {/* Mute / Unmute */}
            <button 
              onClick={() => {
                onMuteChat?.(chatContextMenu.chat.id);
                setChatContextMenu(null);
              }}
              className="w-full flex items-center gap-3 p-2.5 hover:bg-white/5 rounded-xl text-white transition-colors text-right"
            >
              {chatContextMenu.chat.isMuted ? (
                <>
                  <Bell size={16} className="text-[#3390ec] shrink-0" />
                  <span className="flex-1">فعال‌سازی صدا (Unmute)</span>
                </>
              ) : (
                <>
                  <BellOff size={16} className="text-[#708499] shrink-0" />
                  <span className="flex-1">بی‌صدا کردن (Mute)</span>
                </>
              )}
            </button>

            {/* Archive / Unarchive */}
            <button 
              onClick={() => {
                onArchiveChat?.(chatContextMenu.chat.id);
                setChatContextMenu(null);
              }}
              className="w-full flex items-center gap-3 p-2.5 hover:bg-white/5 rounded-xl text-white transition-colors text-right"
            >
              {chatContextMenu.chat.isArchived ? (
                <>
                  <ArchiveRestore size={16} className="text-[#3390ec] shrink-0" />
                  <span className="flex-1">خروج از آرشیو (Unarchive)</span>
                </>
              ) : (
                <>
                  <Archive size={16} className="text-[#708499] shrink-0" />
                  <span className="flex-1">آرشیو کردن گفتگو (Archive)</span>
                </>
              )}
            </button>

            {/* Mark as read / unread */}
            <button 
              onClick={() => {
                onMarkReadChat?.(chatContextMenu.chat.id);
                setChatContextMenu(null);
              }}
              className="w-full flex items-center gap-3 p-2.5 hover:bg-white/5 rounded-xl text-white transition-colors text-right"
            >
              <CheckCheck size={16} className="text-[#708499] shrink-0" />
              <span className="flex-1">
                {chatContextMenu.chat.unreadCount > 0 ? 'علامت به عنوان خوانده‌شده' : 'علامت به عنوان خوانده‌نشده'}
              </span>
            </button>

            <div className="h-px bg-white/5 my-1" />

            {/* Clear History */}
            <button 
              onClick={() => {
                setConfirmModal({ type: 'clear', chat: chatContextMenu.chat, deleteForBoth: false });
                setChatContextMenu(null);
              }}
              className="w-full flex items-center gap-3 p-2.5 hover:bg-amber-500/10 text-amber-400 rounded-xl transition-colors text-right"
            >
              <RotateCcw size={16} className="shrink-0" />
              <span className="flex-1">پاک کردن تاریخچه</span>
            </button>

            {/* Delete Chat */}
            <button 
              onClick={() => {
                setConfirmModal({ type: 'delete', chat: chatContextMenu.chat, deleteForBoth: false });
                setChatContextMenu(null);
              }}
              className="w-full flex items-center gap-3 p-2.5 hover:bg-red-500/10 text-red-400 rounded-xl transition-colors text-right"
            >
              <Trash size={16} className="shrink-0" />
              <span className="flex-1">حذف گفتگو (Delete Chat)</span>
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal (Delete Chat / Clear History) */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-[#17212b] rounded-2xl overflow-hidden shadow-2xl animate-pop border border-white/10 p-5 space-y-4">
            <div className="flex items-center gap-3 text-white">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${confirmModal.type === 'delete' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {confirmModal.type === 'delete' ? <Trash size={20} /> : <RotateCcw size={20} />}
              </div>
              <div>
                <h3 className="font-bold text-[15px]">
                  {confirmModal.type === 'delete' ? 'حذف گفتگو' : 'پاک کردن تاریخچه گفتگو'}
                </h3>
                <p className="text-xs text-[#708499] mt-0.5 truncate max-w-[210px]">
                  {confirmModal.chat.type === 'saved' ? 'پیام‌های ذخیره شده' : (confirmModal.chat.type === 'private' ? (confirmModal.chat.participants.find(p => p.id !== currentUser.id)?.displayName || 'این گفتگو') : confirmModal.chat.groupName)}
                </p>
              </div>
            </div>

            <p className="text-xs text-white/80 leading-relaxed">
              {confirmModal.type === 'delete' 
                ? 'آیا از حذف کامل این گفتگو اطمینان دارید؟ تمام پیام‌های این چت پاک خواهد شد.'
                : 'آیا مایل به پاک کردن تمام پیام‌های ارسال شده در این گفتگو هستید؟'}
            </p>

            {/* Checkbox for delete for both if private chat */}
            {confirmModal.type === 'delete' && confirmModal.chat.type === 'private' && (
              <label className="flex items-center gap-2.5 p-2.5 bg-[#242f3d] rounded-xl cursor-pointer hover:bg-[#2b5278]/30 transition-colors select-none">
                <input 
                  type="checkbox" 
                  checked={confirmModal.deleteForBoth}
                  onChange={(e) => setConfirmModal({ ...confirmModal, deleteForBoth: e.target.checked })}
                  className="w-4 h-4 text-[#3390ec] rounded focus:ring-0 cursor-pointer accent-[#3390ec]"
                />
                <span className="text-xs text-white/90">
                  حذف برای {confirmModal.chat.participants.find(p => p.id !== currentUser.id)?.displayName || 'طرف مقابل'} نیز اعمال شود
                </span>
              </label>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button 
                onClick={() => {
                  if (confirmModal.type === 'delete') {
                    onDeleteChat?.(confirmModal.chat.id, confirmModal.deleteForBoth);
                  } else {
                    onClearHistory?.(confirmModal.chat.id);
                  }
                  setConfirmModal(null);
                }}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md shadow-red-500/20"
              >
                {confirmModal.type === 'delete' ? 'بله، حذف کن' : 'پاک کردن تاریخچه'}
              </button>
              <button 
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 bg-[#242f3d] hover:bg-white/10 text-white/80 hover:text-white rounded-xl text-xs font-medium transition-all"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    
      {/* PWA Installation Guide Modal */}
      {showPwaGuideModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-[#17212b] rounded-3xl p-5 border border-white/10 shadow-2xl space-y-4 animate-pop text-right" dir="rtl">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Smartphone size={20} />
                </div>
                <h4 className="font-bold text-white text-sm">نصب نسخه وب‌اپ (PWA)</h4>
              </div>
              <button onClick={() => setShowPwaGuideModal(false)} className="text-[#708499] hover:text-white p-1">
                <X size={18}/>
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#708499] leading-relaxed">
              {!window.isSecureContext && (
                <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-amber-200">
                  نصب برنامه فقط روی HTTPS یا آدرس localhost فعال می‌شود. این سایت را با HTTPS باز کنید و دوباره تلاش کنید.
                </p>
              )}
              <p className="text-white font-medium">
                مرورگر برای این سایت هنوز پنجره نصب را ارائه نمی‌کند. پس از فعال‌شدن نصب PWA، با زدن دکمه نصب همین‌جا درخواست رسمی مرورگر باز می‌شود. در حال حاضر می‌توانید از روش‌های زیر استفاده کنید:
              </p>
              <div className="bg-[#242f3d] p-3 rounded-2xl border border-white/5 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#3390ec]/20 text-[#3390ec] flex items-center justify-center font-bold text-[11px] shrink-0">۱</span>
                  <p className="text-white">در کامپیوتر (Chrome یا Edge): روی علامت نصب در سمت راست نوار آدرس کلیک کنید.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#3390ec]/20 text-[#3390ec] flex items-center justify-center font-bold text-[11px] shrink-0">۲</span>
                  <p className="text-white">در گوشی اندروید: منوی سه‌نقطه مرورگر را زده و «Install app» یا «افزودن به صفحه اصلی» را انتخاب کنید.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#3390ec]/20 text-[#3390ec] flex items-center justify-center font-bold text-[11px] shrink-0">۳</span>
                  <p className="text-white">در آیفون (Safari): دکمه Share (اشتراک‌گذاری) را زده و «Add to Home Screen» را بزنید.</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowPwaGuideModal(false)}
              className="w-full py-2.5 bg-[#3390ec] hover:bg-[#2b7bc4] text-white text-xs font-bold rounded-xl transition-all"
            >
              متوجه شدم
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Sidebar;
