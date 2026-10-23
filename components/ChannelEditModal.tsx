import React, { useState, useMemo } from 'react';
import { 
  Chat, User, AdminPermissions, InviteLinkItem, RecentActionItem, RemovedUserItem, DEFAULT_AVATAR 
} from '../types';
import { 
  X, ChevronLeft, SlidersHorizontal, Heart, Link2, 
  ShieldCheck, Users, ClipboardList, Check, Copy, RefreshCw, Plus, 
  Trash2, Shield, UserX, UserCheck, AlertTriangle, ArrowRight, Lock, 
  Globe, Sparkles, MessageSquare, Search, Clock, FileSignature, 
  UserCircle2, UserMinus, Eye, CheckCircle2, ShieldAlert
} from 'lucide-react';
import { generateLocalAvatarSvg } from '../services/avatarGenerator';

interface ChannelEditModalProps {
  chat: Chat;
  currentUser: User;
  chats: Chat[];
  onClose: () => void;
  onAction: (action: string, payload: any) => void;
  onDeleteChat?: () => void;
}

const ALL_EMOJIS = ['👍', '❤️', '🔥', '🎉', '🤩', '👏', '😂', '🕊️', '⚡', '💯', '🤔', '😢', '😍', '🚀', '👎', '✨'];

export const ChannelEditModal: React.FC<ChannelEditModalProps> = ({
  chat,
  currentUser,
  chats,
  onClose,
  onAction,
  onDeleteChat
}) => {
  // Navigation: 'main' or any subview
  const [activeView, setActiveView] = useState<
    'main' | 'channelType' | 'reactions' | 'inviteLinks' | 'administrators' | 'subscribers' | 'removedUsers' | 'recentActions'
  >('main');

  // Basic Info State
  const [channelName, setChannelName] = useState(chat.groupName || '');
  const [channelDesc, setChannelDesc] = useState(chat.description || '');
  const [channelAvatar, setChannelAvatar] = useState(chat.groupAvatar || '');

  // 1. Channel Type State
  const [isPublic, setIsPublic] = useState<boolean>(Boolean(chat.isPublic));
  const [publicHandle, setPublicHandle] = useState<string>(chat.publicHandle || '');

  // 2. Sign Messages & Show Authors' Profiles (from screenshot)
  const [signMessages, setSignMessages] = useState<boolean>(Boolean(chat.signMessages));
  const [showAuthorsProfiles, setShowAuthorsProfiles] = useState<boolean>(Boolean(chat.showAuthorsProfiles));

  // 3. Reactions State
  const [reactionsSetting, setReactionsSetting] = useState<'all' | 'some' | 'off'>(
    chat.reactionsSetting || 'all'
  );
  const [allowedReactions, setAllowedReactions] = useState<string[]>(
    chat.allowedReactions || ['👍', '❤️', '🔥', '🎉', '🤩', '👏', '🕊️']
  );

  // 4. Invite Links State
  const [inviteLinks, setInviteLinks] = useState<InviteLinkItem[]>(() => {
    const list = chat.inviteLinksList ? [...chat.inviteLinksList] : [];
    if (chat.inviteLink && !list.some(l => l.link === chat.inviteLink)) {
      list.unshift({
        id: 'primary',
        link: chat.inviteLink,
        title: 'پیوند اصلی کانال',
        createdAt: Date.now(),
        usageLimit: 0,
        usageCount: 0
      });
    }
    return list;
  });
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkLimit, setNewLinkLimit] = useState(0);
  const [showCreateLinkModal, setShowCreateLinkModal] = useState(false);

  // 5. Administrators State
  const [adminsMap, setAdminsMap] = useState<Record<string, AdminPermissions>>(chat.admins || {});
  const [editingAdminUser, setEditingAdminUser] = useState<User | null>(null);
  const [editingAdminPerms, setEditingAdminPerms] = useState<AdminPermissions>({
    canChangeInfo: true,
    canDeleteMessages: true,
    canBanUsers: true,
    canInviteUsers: true,
    canPinMessages: true,
    canAddAdmins: false,
    canPostMessages: true,
    canEditMessages: true,
    canManageStories: true,
    customTitle: ''
  });
  const [showAddAdminPicker, setShowAddAdminPicker] = useState(false);

  // 6. Subscribers State
  const [subscribersList, setSubscribersList] = useState<User[]>(chat.participants || []);
  const [subscriberSearchQuery, setSubscriberSearchQuery] = useState('');
  const [showAddSubscriberModal, setShowAddSubscriberModal] = useState(false);

  // 7. Removed Users State (Banned / Blocked)
  const [removedUsersList, setRemovedUsersList] = useState<RemovedUserItem[]>(
    chat.removedUsersList || []
  );
  const [removedSearchQuery, setRemovedSearchQuery] = useState('');
  const [showBanUserModal, setShowBanUserModal] = useState(false);

  // 8. Recent Actions State
  const [recentActions, setRecentActions] = useState<RecentActionItem[]>(() => {
    if (chat.recentActions && chat.recentActions.length > 0) {
      return chat.recentActions;
    }
    return [
      {
        id: 'ra_ch_init',
        actorId: chat.adminId || currentUser.id,
        actorName: currentUser.displayName,
        action: 'create_channel',
        title: 'کانال ایجاد شد',
        details: `نام کانال: ${chat.groupName || 'کانال'}`,
        timestamp: Date.now() - 7200000
      }
    ];
  });
  const [recentActionFilter, setRecentActionFilter] = useState<string>('all');

  // UI Helpers
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isCreator = chat.adminId === currentUser.id;

  // Add recent action helper
  const logRecentAction = (title: string, details?: string, action: string = 'edit_info') => {
    const newItem: RecentActionItem = {
      id: `ra_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      actorId: currentUser.id,
      actorName: currentUser.displayName,
      action,
      title,
      details,
      timestamp: Date.now()
    };
    setRecentActions(prev => [newItem, ...prev]);
  };

  // Copy helper
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(text);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  // Toggle emoji in allowedReactions
  const toggleEmoji = (emoji: string) => {
    setAllowedReactions(prev => {
      const exists = prev.includes(emoji);
      const next = exists ? prev.filter(e => e !== emoji) : [...prev, emoji];
      logRecentAction('واکنش‌های مجاز تغییر کرد', `تعداد ایموجی‌ها: ${next.length}`, 'reactions');
      return next;
    });
  };

  // Create new custom invite link
  const handleCreateNewInviteLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const randomToken = Math.random().toString(36).substring(2, 9);
    const newLinkStr = `${origin}/join/ch_${randomToken}`;

    const newLink: InviteLinkItem = {
      id: `link_${Date.now()}`,
      link: newLinkStr,
      title: newLinkTitle.trim() || `پیوند دعوت #${inviteLinks.length + 1}`,
      createdAt: Date.now(),
      creatorId: currentUser.id,
      creatorName: currentUser.displayName,
      usageLimit: newLinkLimit > 0 ? newLinkLimit : 0,
      usageCount: 0,
      isRevoked: false
    };

    setInviteLinks(prev => [newLink, ...prev]);
    logRecentAction('پیوند دعوت جدید ایجاد شد', `عنوان: ${newLink.title}`, 'invite_link');
    setNewLinkTitle('');
    setNewLinkLimit(0);
    setShowCreateLinkModal(false);
  };

  // Revoke invite link
  const handleRevokeInviteLink = (linkId: string) => {
    setInviteLinks(prev => prev.map(l => l.id === linkId ? { ...l, isRevoked: true } : l));
    logRecentAction('یک پیوند دعوت باطل شد', undefined, 'invite_link');
  };

  // Regenerate primary link
  const handleRegeneratePrimaryLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const randomToken = Math.random().toString(36).substring(2, 9);
    const newLinkStr = `${origin}/join/ch_${randomToken}`;

    setInviteLinks(prev => prev.map(l => l.id === 'primary' ? { ...l, link: newLinkStr, createdAt: Date.now() } : l));
    logRecentAction('پیوند اصلی کانال بازتولید شد', undefined, 'invite_link');
  };

  // Save admin permissions
  const handleSaveAdminPerms = () => {
    if (!editingAdminUser) return;
    setAdminsMap(prev => ({
      ...prev,
      [editingAdminUser.id]: editingAdminPerms
    }));
    logRecentAction(
      `دسترسی‌های مدیر به‌روزرسانی شد`,
      `${editingAdminUser.displayName} (${editingAdminPerms.customTitle || 'مدیر'})`,
      'admin_rights'
    );
    setEditingAdminUser(null);
  };

  // Remove admin
  const handleDismissAdmin = (userId: string, userName: string) => {
    setAdminsMap(prev => {
      const copy = { ...prev };
      delete copy[userId];
      return copy;
    });
    logRecentAction('یک مدیر عزل شد', userName, 'admin_rights');
    setEditingAdminUser(null);
  };

  // Remove subscriber and move to removed users
  const handleRemoveSubscriber = (user: User) => {
    setSubscribersList(prev => prev.filter(u => u.id !== user.id));
    setRemovedUsersList(prev => [
      {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        removedAt: Date.now(),
        removedByName: currentUser.displayName,
        reason: 'حذف شده توسط مدیر'
      },
      ...prev.filter(r => r.id !== user.id)
    ]);
    logRecentAction('یک مشترک حذف و مسدود شد', `@${user.username}`, 'remove_subscriber');
  };

  // Unban user
  const handleUnbanUser = (userId: string, userName: string) => {
    setRemovedUsersList(prev => prev.filter(r => r.id !== userId));
    logRecentAction('کاربر از فهرست مسدود خارج شد', userName, 'unban_user');
  };

  // Add subscriber from available users
  const availableUsersToAdd = useMemo(() => {
    const set = new Map<string, User>();
    chats.forEach(c => {
      c.participants?.forEach(p => {
        if (!subscribersList.some(s => s.id === p.id) && p.id !== currentUser.id) {
          set.set(p.id, p);
        }
      });
    });
    return Array.from(set.values());
  }, [chats, subscribersList, currentUser.id]);

  // Save all changes
  const handleSaveAll = () => {
    const updatedPayload = {
      groupName: channelName.trim() || chat.groupName,
      description: channelDesc.trim(),
      groupAvatar: channelAvatar || chat.groupAvatar,
      isPublic,
      publicHandle: isPublic ? publicHandle.trim() : '',
      signMessages,
      showAuthorsProfiles,
      reactionsSetting,
      allowedReactions,
      inviteLinksList: inviteLinks,
      admins: adminsMap,
      participants: subscribersList,
      participantIds: subscribersList.map(s => s.id),
      removedUsersList,
      recentActions
    };

    onAction('updateChatInfo', updatedPayload);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 md:p-6 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-[#17212b] rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[92vh] animate-pop text-right"
        dir="rtl"
        onClick={e => e.stopPropagation()}
      >
        {/* ================= MODAL HEADER ================= */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#242f3d]/60 shrink-0">
          <div className="flex items-center gap-2">
            {activeView !== 'main' ? (
              <button 
                onClick={() => setActiveView('main')} 
                className="p-1.5 hover:bg-white/10 rounded-full text-[#3390ec] flex items-center gap-1 text-xs font-bold transition-all"
              >
                <ArrowRight size={17} />
                <span>بازگشت</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-[#3390ec]" />
                <h3 className="font-bold text-white text-base">ویرایش کانال</h3>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeView === 'main' ? (
              <button 
                onClick={handleSaveAll}
                className="px-3.5 py-1.5 bg-[#3390ec] hover:bg-[#2881d9] text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
              >
                ذخیره
              </button>
            ) : (
              <span className="text-xs font-semibold text-[#708499]">
                {activeView === 'channelType' && 'نوع کانال'}
                {activeView === 'reactions' && 'واکنش‌ها'}
                {activeView === 'inviteLinks' && 'لینک‌های دعوت'}
                {activeView === 'administrators' && 'مدیران کانال'}
                {activeView === 'subscribers' && 'مشترکین'}
                {activeView === 'removedUsers' && 'کاربران حذف شده'}
                {activeView === 'recentActions' && 'اقدامات اخیر'}
              </span>
            )}
            <button 
              onClick={onClose} 
              className="p-1.5 hover:bg-white/10 rounded-full text-[#708499] hover:text-white transition-all"
            >
              <X size={18}/>
            </button>
          </div>
        </div>

        {/* ================= MODAL CONTENT ================= */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 select-none">
          
          {/* ================= 0. MAIN VIEW ================= */}
          {activeView === 'main' && (
            <div className="space-y-4">
              {/* Channel Avatar & Names */}
              <div className="flex flex-col items-center gap-3 pb-3 border-b border-white/5">
                <div className="relative group">
                  <img 
                    src={channelAvatar || chat.groupAvatar || DEFAULT_AVATAR}
                    onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                    className="w-20 h-20 rounded-full object-cover border-2 border-[#3390ec]/40 shadow-xl bg-[#242f3d]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newSvg = generateLocalAvatarSvg(channelName || 'Channel', Date.now().toString());
                      setChannelAvatar(newSvg);
                      logRecentAction('تصویر کانال تغییر کرد', undefined, 'change_photo');
                    }}
                    className="absolute inset-0 bg-black/40 group-hover:opacity-100 opacity-0 rounded-full flex flex-col items-center justify-center text-white transition-opacity backdrop-blur-xs"
                    title="تولید تصویر خودکار"
                  >
                    <Sparkles size={18} className="text-amber-300 mb-0.5" />
                    <span className="text-[10px] font-bold">تغییر</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newSvg = generateLocalAvatarSvg(channelName || 'Channel', Date.now().toString());
                    setChannelAvatar(newSvg);
                    logRecentAction('تصویر کانال تغییر کرد', undefined, 'change_photo');
                  }}
                  className="px-3 py-1 bg-white/5 hover:bg-white/10 text-xs font-bold text-[#3390ec] rounded-xl transition-all flex items-center gap-1.5"
                >
                  <Sparkles size={13} />
                  <span>تولید تصویر خودکار</span>
                </button>
              </div>

              {/* Channel Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#708499] block">نام کانال</label>
                <input 
                  type="text"
                  value={channelName}
                  onChange={e => setChannelName(e.target.value)}
                  placeholder="نام کانال را وارد کنید..."
                  className="w-full bg-[#242f3d] border border-white/5 focus:border-[#3390ec]/50 rounded-2xl px-3.5 py-2.5 text-xs text-white outline-none transition-all"
                />
              </div>

              {/* Channel Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#708499] block">توضیحات و بیوگرافی</label>
                <textarea 
                  value={channelDesc}
                  onChange={e => setChannelDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-[#242f3d] border border-white/5 focus:border-[#3390ec]/50 rounded-2xl px-3.5 py-2.5 text-xs text-white outline-none resize-none transition-all"
                  placeholder="توضیحاتی برای معرفی کانال به مشترکین..."
                />
              </div>

              {/* Management Menu Items (Matching Screenshot) */}
              <div className="bg-[#242f3d]/60 rounded-2xl border border-white/5 divide-y divide-white/5 overflow-hidden">
                
                {/* 1. Channel Type */}
                <button
                  onClick={() => setActiveView('channelType')}
                  className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-white/5 transition-colors group text-right"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#3390ec]/15 text-[#3390ec] flex items-center justify-center">
                      <Globe size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">نوع کانال (Channel type)</span>
                      <span className="text-[11px] text-[#708499]">
                        {isPublic ? (publicHandle ? `@${publicHandle}` : 'عمومی') : 'خصوصی'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#3390ec]">
                    <span>{isPublic ? 'Public' : 'Private'}</span>
                    <ChevronLeft size={16} className="text-[#708499] group-hover:text-white transition-colors" />
                  </div>
                </button>

                {/* 2. Sign Messages (Toggle switch) */}
                <div className="px-4 py-3.5 flex items-center justify-between hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center">
                      <FileSignature size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">امضای پیام‌ها (Sign messages)</span>
                      <span className="text-[11px] text-[#708499]">
                        افزودن نام مدیر ارسال‌کننده به انتهای پیام
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !signMessages;
                      setSignMessages(next);
                      logRecentAction('وضعیت امضای پیام‌ها تغییر کرد', next ? 'فعال' : 'غیرفعال', 'sign_messages');
                    }}
                    className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                      signMessages ? 'bg-[#3390ec]' : 'bg-white/20'
                    }`}
                  >
                    <div 
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        signMessages ? '-translate-x-5' : 'translate-x-0'
                      }`} 
                    />
                  </button>
                </div>

                {/* 3. Show authors' profiles (Toggle switch) */}
                <div className="px-4 py-3.5 hover:bg-white/5 transition-colors space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
                        <UserCircle2 size={16} />
                      </div>
                      <span className="text-xs font-bold text-white block">نمایش پروفایل نویسندگان (Show authors' profiles)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !showAuthorsProfiles;
                        setShowAuthorsProfiles(next);
                        logRecentAction('وضعیت نمایش پروفایل نویسندگان تغییر کرد', next ? 'فعال' : 'غیرفعال', 'author_profiles');
                      }}
                      className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                        showAuthorsProfiles ? 'bg-[#3390ec]' : 'bg-white/20'
                      }`}
                    >
                      <div 
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                          showAuthorsProfiles ? '-translate-x-5' : 'translate-x-0'
                        }`} 
                      />
                    </button>
                  </div>
                  <p className="text-[11px] text-[#708499] pr-11 leading-relaxed">
                    افزودن نام و تصویر مدیران به پیام‌هایی که ارسال می‌کنند و لینک به پروفایل آن‌ها.
                  </p>
                </div>

                {/* 4. Reactions */}
                <button
                  onClick={() => setActiveView('reactions')}
                  className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-white/5 transition-colors group text-right"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-pink-500/15 text-pink-400 flex items-center justify-center">
                      <Heart size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">واکنش‌ها (Reactions)</span>
                      <span className="text-[11px] text-[#708499]">
                        {reactionsSetting === 'all' ? 'همه ایموجی‌ها مجاز است' : reactionsSetting === 'some' ? `${allowedReactions.length} ایموجی انتخابی` : 'غیرفعال'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-pink-400">
                    <span>
                      {reactionsSetting === 'all' ? '73' : reactionsSetting === 'some' ? allowedReactions.length : 'Off'}
                    </span>
                    <ChevronLeft size={16} className="text-[#708499] group-hover:text-white transition-colors" />
                  </div>
                </button>

                {/* 5. Invite links */}
                <button
                  onClick={() => setActiveView('inviteLinks')}
                  className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-white/5 transition-colors group text-right"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                      <Link2 size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">لینک‌های دعوت (Invite links)</span>
                      <span className="text-[11px] text-[#708499]">مدیریت پیوندهای عضویت کانال</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <span>{inviteLinks.filter(l => !l.isRevoked).length}</span>
                    <ChevronLeft size={16} className="text-[#708499] group-hover:text-white transition-colors" />
                  </div>
                </button>

                {/* 6. Administrators */}
                <button
                  onClick={() => setActiveView('administrators')}
                  className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-white/5 transition-colors group text-right"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
                      <ShieldCheck size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">مدیران (Administrators)</span>
                      <span className="text-[11px] text-[#708499]">تعیین دسترسی‌ها و عنوان‌های سفارشی</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400">
                    <span>{Object.keys(adminsMap).length + 1}</span>
                    <ChevronLeft size={16} className="text-[#708499] group-hover:text-white transition-colors" />
                  </div>
                </button>

                {/* 7. Subscribers */}
                <button
                  onClick={() => setActiveView('subscribers')}
                  className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-white/5 transition-colors group text-right"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center">
                      <Users size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">مشترکین (Subscribers)</span>
                      <span className="text-[11px] text-[#708499]">مشاهده، جستجو و مدیریت اعضا</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                    <span>{subscribersList.length}</span>
                    <ChevronLeft size={16} className="text-[#708499] group-hover:text-white transition-colors" />
                  </div>
                </button>

                {/* 8. Removed users */}
                <button
                  onClick={() => setActiveView('removedUsers')}
                  className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-white/5 transition-colors group text-right"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center">
                      <UserX size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">کاربران حذف شده (Removed users)</span>
                      <span className="text-[11px] text-[#708499]">فهرست مسدودشدگان و امکان بازگردانی</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                    <span>{removedUsersList.length}</span>
                    <ChevronLeft size={16} className="text-[#708499] group-hover:text-white transition-colors" />
                  </div>
                </button>

                {/* 9. Recent actions */}
                <button
                  onClick={() => setActiveView('recentActions')}
                  className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-white/5 transition-colors group text-right"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                      <ClipboardList size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">اقدامات اخیر (Recent actions)</span>
                      <span className="text-[11px] text-[#708499]">گزارش و تاریخچه فعالیت‌های مدیریتی</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                    <ChevronLeft size={16} className="text-[#708499] group-hover:text-white transition-colors" />
                  </div>
                </button>

              </div>

              {/* Danger Zone: Delete Channel */}
              {isCreator && (
                <div className="pt-2">
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-red-500/20 active:scale-95"
                  >
                    <Trash2 size={16} />
                    <span>حذف و انحلال کامل کانال</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ================= 1. CHANNEL TYPE SUBVIEW ================= */}
          {activeView === 'channelType' && (
            <div className="space-y-4">
              <div className="bg-[#242f3d]/60 p-4 rounded-2xl border border-white/5 space-y-4">
                {/* Private Channel */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input 
                    type="radio" 
                    name="channelType"
                    checked={!isPublic}
                    onChange={() => setIsPublic(false)}
                    className="mt-1 accent-[#3390ec]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Lock size={15} className="text-emerald-400" />
                      <span className="text-xs font-bold text-white">کانال خصوصی (Private Channel)</span>
                    </div>
                    <p className="text-[11px] text-[#708499] mt-1 leading-relaxed">
                      کانال‌های خصوصی فقط از طریق پیوند دعوت اختصاصی قابل مشاهده و پیوستن هستند و در جستجوی پیام‌رسان نمایش داده نمی‌شوند.
                    </p>
                  </div>
                </label>

                {/* Public Channel */}
                <label className="flex items-start gap-3 cursor-pointer pt-3 border-t border-white/5">
                  <input 
                    type="radio" 
                    name="channelType"
                    checked={isPublic}
                    onChange={() => setIsPublic(true)}
                    className="mt-1 accent-[#3390ec]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Globe size={15} className="text-[#3390ec]" />
                      <span className="text-xs font-bold text-white">کانال عمومی (Public Channel)</span>
                    </div>
                    <p className="text-[11px] text-[#708499] mt-1 leading-relaxed">
                      هر کاربری در سرتاسر پیام‌رسان می‌تواند نام کاربری کانال را جستجو کرده، محتوای آن را ببیند و عضو شود.
                    </p>
                  </div>
                </label>
              </div>

              {/* Public Handle Configuration */}
              {isPublic ? (
                <div className="bg-[#242f3d]/60 p-4 rounded-2xl border border-white/5 space-y-3">
                  <label className="text-xs font-bold text-white block">پیوند عمومی کانال (Public Link)</label>
                  <div className="flex items-center bg-[#17212b] border border-white/10 rounded-xl px-3 py-2 text-xs" dir="ltr">
                    <span className="text-[#708499] font-mono select-none">t.me/</span>
                    <input 
                      type="text"
                      value={publicHandle}
                      onChange={e => setPublicHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                      placeholder="channel_handle"
                      className="flex-1 bg-transparent text-white font-mono outline-none px-1"
                    />
                  </div>
                  <p className="text-[10px] text-[#708499]">
                    شناسه باید حداقل ۴ کاراکتر و شامل حروف انگلیسی، اعداد و خط زیر (_) باشد.
                  </p>
                </div>
              ) : (
                <div className="bg-[#242f3d]/60 p-4 rounded-2xl border border-white/5 space-y-2">
                  <span className="text-xs font-bold text-white block">پیوند دعوت خصوصی فعلی:</span>
                  <div className="flex items-center justify-between bg-[#17212b] p-2.5 rounded-xl border border-white/5 text-xs text-[#708499] font-mono">
                    <span className="truncate max-w-[260px]" dir="ltr">
                      {inviteLinks[0]?.link || chat.inviteLink || 'http://localhost:3000/join/ch_default'}
                    </span>
                    <button
                      onClick={() => handleCopy(inviteLinks[0]?.link || chat.inviteLink || '')}
                      className="px-2 py-1 bg-[#3390ec]/20 hover:bg-[#3390ec]/30 text-[#3390ec] rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                    >
                      {copiedLink ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedLink ? 'کپی شد' : 'کپی'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= 2. REACTIONS SUBVIEW ================= */}
          {activeView === 'reactions' && (
            <div className="space-y-4">
              <div className="bg-[#242f3d]/60 p-4 rounded-2xl border border-white/5 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input 
                    type="radio" 
                    name="reactionsSetting"
                    checked={reactionsSetting === 'all'}
                    onChange={() => setReactionsSetting('all')}
                    className="mt-1 accent-[#3390ec]"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">همه واکنش‌ها (All Reactions)</span>
                    <span className="text-[11px] text-[#708499]">مشترکین می‌توانند از هر ایموجی دلخواهی برای واکنش به پست‌های کانال استفاده کنند.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer pt-3 border-t border-white/5">
                  <input 
                    type="radio" 
                    name="reactionsSetting"
                    checked={reactionsSetting === 'some'}
                    onChange={() => setReactionsSetting('some')}
                    className="mt-1 accent-[#3390ec]"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">واکنش‌های انتخابی (Some Reactions)</span>
                    <span className="text-[11px] text-[#708499]">فقط ایموجی‌های تایید شده توسط شما در دسترس مشترکین خواهند بود.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer pt-3 border-t border-white/5">
                  <input 
                    type="radio" 
                    name="reactionsSetting"
                    checked={reactionsSetting === 'off'}
                    onChange={() => setReactionsSetting('off')}
                    className="mt-1 accent-[#3390ec]"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">غیرفعال (No Reactions)</span>
                    <span className="text-[11px] text-[#708499]">ثبت واکنش به پست‌های این کانال به کلی غیرفعال می‌شود.</span>
                  </div>
                </label>
              </div>

              {reactionsSetting === 'some' && (
                <div className="bg-[#242f3d]/60 p-4 rounded-2xl border border-white/5 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">انتخاب ایموجی‌های مجاز ({allowedReactions.length})</span>
                    <button 
                      onClick={() => setAllowedReactions(ALL_EMOJIS)}
                      className="text-xs font-bold text-[#3390ec] hover:underline"
                    >
                      انتخاب همه
                    </button>
                  </div>
                  <div className="grid grid-cols-8 gap-2 pt-1">
                    {ALL_EMOJIS.map(emoji => {
                      const isSelected = allowedReactions.includes(emoji);
                      return (
                        <button
                          key={emoji}
                          onClick={() => toggleEmoji(emoji)}
                          className={`w-10 h-10 rounded-xl text-lg flex items-center justify-center transition-all ${
                            isSelected 
                              ? 'bg-[#3390ec] text-white scale-105 shadow-md' 
                              : 'bg-[#17212b] text-white/40 hover:bg-white/5'
                          }`}
                        >
                          {emoji}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= 3. INVITE LINKS SUBVIEW ================= */}
          {activeView === 'inviteLinks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#708499]">پیوندهای دعوت فعال ({inviteLinks.filter(l => !l.isRevoked).length})</span>
                <button
                  onClick={() => setShowCreateLinkModal(true)}
                  className="px-3 py-1.5 bg-[#3390ec] hover:bg-[#2881d9] text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all shadow-md"
                >
                  <Plus size={14} />
                  <span>پیوند جدید</span>
                </button>
              </div>

              {/* Primary Link Card */}
              <div className="bg-[#242f3d]/60 p-4 rounded-2xl border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-amber-400" />
                    <span className="text-xs font-bold text-white">پیوند اصلی و دائمی کانال</span>
                  </div>
                  <button
                    onClick={handleRegeneratePrimaryLink}
                    className="text-[11px] text-[#3390ec] hover:underline flex items-center gap-1 font-bold"
                  >
                    <RefreshCw size={11} />
                    <span>بازتولید پیوند</span>
                  </button>
                </div>
                <div className="flex items-center justify-between bg-[#17212b] p-2.5 rounded-xl border border-white/5 text-xs text-[#708499] font-mono">
                  <span className="truncate max-w-[270px]" dir="ltr">
                    {inviteLinks.find(l => l.id === 'primary')?.link || chat.inviteLink || 'http://localhost:3000/join/ch_default'}
                  </span>
                  <button
                    onClick={() => handleCopy(inviteLinks.find(l => l.id === 'primary')?.link || chat.inviteLink || '')}
                    className="px-2 py-1 bg-[#3390ec]/20 hover:bg-[#3390ec]/30 text-[#3390ec] rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                  >
                    {copiedLink ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedLink ? 'کپی شد' : 'کپی'}</span>
                  </button>
                </div>
              </div>

              {/* Custom Invite Links List */}
              <div className="space-y-2">
                {inviteLinks.filter(l => l.id !== 'primary').map(l => (
                  <div 
                    key={l.id}
                    className={`bg-[#242f3d]/60 p-3.5 rounded-2xl border border-white/5 space-y-2 ${l.isRevoked ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{l.title || 'پیوند سفارشی'}</span>
                      {l.isRevoked ? (
                        <span className="text-[10px] text-red-400 bg-red-400/10 px-2 py-0.5 rounded-lg">باطل شده</span>
                      ) : (
                        <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-lg">فعال</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between bg-[#17212b] p-2 rounded-xl text-xs font-mono text-[#708499]">
                      <span className="truncate max-w-[240px]" dir="ltr">{l.link}</span>
                      <div className="flex items-center gap-1">
                        {!l.isRevoked && (
                          <>
                            <button
                              onClick={() => handleCopy(l.link)}
                              className="p-1 hover:bg-white/10 rounded-lg text-[#3390ec]"
                              title="کپی"
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              onClick={() => handleRevokeInviteLink(l.id)}
                              className="p-1 hover:bg-white/10 rounded-lg text-red-400"
                              title="باطل کردن"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= 4. ADMINISTRATORS SUBVIEW ================= */}
          {activeView === 'administrators' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#708499]">فهرست مدیران ({Object.keys(adminsMap).length + 1})</span>
                <button
                  onClick={() => setShowAddAdminPicker(true)}
                  className="px-3 py-1.5 bg-[#3390ec] hover:bg-[#2881d9] text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all shadow-md"
                >
                  <Plus size={14} />
                  <span>افزودن مدیر</span>
                </button>
              </div>

              {/* Admins List */}
              <div className="space-y-2">
                {/* Creator (Owner) */}
                <div className="bg-[#242f3d]/60 p-3.5 rounded-2xl border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img 
                      src={currentUser.avatar || DEFAULT_AVATAR} 
                      className="w-10 h-10 rounded-full object-cover border border-[#3390ec]/30"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">{currentUser.displayName}</span>
                        <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">مالک کانال</span>
                      </div>
                      <span className="text-[11px] text-[#708499]">@{currentUser.username}</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-[#708499] font-medium">دسترسی کامل</span>
                </div>

                {/* Other Admins */}
                {Object.entries(adminsMap).map(([adminUserId, perms]) => {
                  const adminUser = subscribersList.find(s => s.id === adminUserId);
                  if (!adminUser) return null;
                  return (
                    <div 
                      key={adminUserId}
                      onClick={() => {
                        setEditingAdminUser(adminUser);
                        setEditingAdminPerms(perms);
                      }}
                      className="bg-[#242f3d]/60 p-3.5 rounded-2xl border border-white/5 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <img 
                          src={adminUser.avatar || DEFAULT_AVATAR} 
                          className="w-10 h-10 rounded-full object-cover border border-white/10"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white">{adminUser.displayName}</span>
                            <span className="text-[10px] bg-[#3390ec]/20 text-[#3390ec] px-2 py-0.5 rounded-full font-bold">
                              {perms.customTitle || 'مدیر'}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#708499]">@{adminUser.username}</span>
                        </div>
                      </div>
                      <ChevronLeft size={16} className="text-[#708499]" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= 5. SUBSCRIBERS SUBVIEW ================= */}
          {activeView === 'subscribers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#708499]">مشترکین کانال ({subscribersList.length})</span>
                <button
                  onClick={() => setShowAddSubscriberModal(true)}
                  className="px-3 py-1.5 bg-[#3390ec] hover:bg-[#2881d9] text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all shadow-md"
                >
                  <Plus size={14} />
                  <span>افزودن مشترک</span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search size={15} className="absolute right-3.5 top-3 text-[#708499]" />
                <input 
                  type="text"
                  value={subscriberSearchQuery}
                  onChange={e => setSubscriberSearchQuery(e.target.value)}
                  placeholder="جستجو در مشترکین..."
                  className="w-full bg-[#242f3d]/60 border border-white/5 focus:border-[#3390ec]/50 rounded-2xl pr-10 pl-4 py-2.5 text-xs text-white outline-none"
                />
              </div>

              {/* Subscribers List */}
              <div className="space-y-2">
                {subscribersList
                  .filter(s => 
                    s.displayName.toLowerCase().includes(subscriberSearchQuery.toLowerCase()) ||
                    s.username.toLowerCase().includes(subscriberSearchQuery.toLowerCase())
                  )
                  .map(sub => {
                    const isSubCreator = chat.adminId === sub.id;
                    const isSubAdmin = Boolean(adminsMap[sub.id]);
                    return (
                      <div 
                        key={sub.id}
                        className="bg-[#242f3d]/60 p-3 rounded-2xl border border-white/5 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <img 
                            src={sub.avatar || DEFAULT_AVATAR} 
                            className="w-10 h-10 rounded-full object-cover border border-white/10"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white">{sub.displayName}</span>
                              {isSubCreator && <span className="text-[10px] text-amber-400 font-bold">مالک</span>}
                              {isSubAdmin && !isSubCreator && <span className="text-[10px] text-[#3390ec] font-bold">مدیر</span>}
                            </div>
                            <span className="text-[11px] text-[#708499]">@{sub.username}</span>
                          </div>
                        </div>

                        {!isSubCreator && sub.id !== currentUser.id && (
                          <div className="flex items-center gap-1">
                            {!isSubAdmin && (
                              <button
                                onClick={() => {
                                  setEditingAdminUser(sub);
                                  setEditingAdminPerms({
                                    canChangeInfo: true,
                                    canDeleteMessages: true,
                                    canBanUsers: true,
                                    canInviteUsers: true,
                                    canPinMessages: true,
                                    canAddAdmins: false,
                                    canPostMessages: true,
                                    canEditMessages: true,
                                    canManageStories: true,
                                    customTitle: 'مدیر محتوا'
                                  });
                                }}
                                className="p-1.5 hover:bg-white/10 text-[#3390ec] rounded-xl text-xs font-bold transition-all"
                                title="ارتقا به مدیر"
                              >
                                <ShieldCheck size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveSubscriber(sub)}
                              className="p-1.5 hover:bg-red-500/10 text-red-400 rounded-xl transition-all"
                              title="حذف و مسدودسازی از کانال"
                            >
                              <UserX size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ================= 6. REMOVED USERS SUBVIEW ================= */}
          {activeView === 'removedUsers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">کاربران حذف شده ({removedUsersList.length})</span>
                  <span className="text-[11px] text-[#708499]">کاربران مسدود شده اجازه پیوستن مجدد به کانال را ندارند</span>
                </div>
                <button
                  onClick={() => setShowBanUserModal(true)}
                  className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-xl text-xs font-bold flex items-center gap-1 transition-all border border-rose-500/30"
                >
                  <UserMinus size={14} />
                  <span>مسدودسازی کاربر</span>
                </button>
              </div>

              {/* Search in Removed Users */}
              <div className="relative">
                <Search size={15} className="absolute right-3.5 top-3 text-[#708499]" />
                <input 
                  type="text"
                  value={removedSearchQuery}
                  onChange={e => setRemovedSearchQuery(e.target.value)}
                  placeholder="جستجو در کاربران حذف شده..."
                  className="w-full bg-[#242f3d]/60 border border-white/5 focus:border-[#3390ec]/50 rounded-2xl pr-10 pl-4 py-2.5 text-xs text-white outline-none"
                />
              </div>

              {/* Removed Users List */}
              <div className="space-y-2">
                {removedUsersList.length === 0 ? (
                  <div className="p-8 text-center text-[#708499] text-xs bg-[#242f3d]/40 rounded-2xl border border-white/5">
                    هیچ کاربر مسدود شده‌ای در این کانال وجود ندارد.
                  </div>
                ) : (
                  removedUsersList
                    .filter(r => 
                      r.displayName.toLowerCase().includes(removedSearchQuery.toLowerCase()) ||
                      r.username.toLowerCase().includes(removedSearchQuery.toLowerCase())
                    )
                    .map(ru => (
                      <div 
                        key={ru.id}
                        className="bg-[#242f3d]/60 p-3 rounded-2xl border border-white/5 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <img 
                            src={ru.avatar || DEFAULT_AVATAR} 
                            className="w-10 h-10 rounded-full object-cover border border-rose-500/30 grayscale"
                          />
                          <div>
                            <span className="text-xs font-bold text-white block">{ru.displayName}</span>
                            <div className="flex items-center gap-2 text-[10px] text-[#708499]">
                              <span>@{ru.username}</span>
                              <span>•</span>
                              <span>حذف شده توسط {ru.removedByName || 'مدیر'}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleUnbanUser(ru.id, ru.displayName)}
                          className="px-2.5 py-1 bg-[#3390ec]/20 hover:bg-[#3390ec]/30 text-[#3390ec] rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                        >
                          <UserCheck size={14} />
                          <span>رفع مسدودیت</span>
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

          {/* ================= 7. RECENT ACTIONS SUBVIEW ================= */}
          {activeView === 'recentActions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#708499]">گزارش فعالیت‌های کانال ({recentActions.length})</span>
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { id: 'all', name: 'همه اقدامات' },
                  { id: 'settings', name: 'تنظیمات و اطلاعات' },
                  { id: 'admins', name: 'مدیران و مشترکین' },
                  { id: 'links', name: 'لینک‌های دعوت' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setRecentActionFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                      recentActionFilter === tab.id 
                        ? 'bg-[#3390ec] text-white shadow-sm' 
                        : 'bg-white/5 text-[#708499] hover:bg-white/10'
                    }`}
                  >
                    {tab.name}
                  </button>
                ))}
              </div>

              {/* Actions List */}
              <div className="space-y-2">
                {recentActions.map(action => (
                  <div key={action.id} className="bg-[#242f3d]/60 p-3.5 rounded-2xl border border-white/5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-[#3390ec]" />
                        <span>{action.title}</span>
                      </span>
                      <span className="text-[10px] text-[#708499] font-mono">
                        {new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#708499] flex items-center gap-2">
                      <span>توسط: <strong className="text-white/80">{action.actorName}</strong></span>
                      {action.details && (
                        <>
                          <span>•</span>
                          <span>{action.details}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ================= EDIT ADMIN PERMISSIONS MODAL ================= */}
      {editingAdminUser && (
        <div 
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setEditingAdminUser(null)}
        >
          <div 
            className="w-full max-w-md bg-[#17212b] rounded-3xl overflow-hidden shadow-2xl border border-white/10 p-5 space-y-4 animate-pop text-right"
            onClick={e => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2.5">
                <img 
                  src={editingAdminUser.avatar || DEFAULT_AVATAR} 
                  className="w-9 h-9 rounded-full object-cover border border-[#3390ec]/30"
                />
                <div>
                  <h4 className="font-bold text-white text-sm">{editingAdminUser.displayName}</h4>
                  <span className="text-[11px] text-[#708499]">مدیریت دسترسی‌های کانال</span>
                </div>
              </div>
              <button onClick={() => setEditingAdminUser(null)} className="p-1 hover:bg-white/10 rounded-full text-[#708499]">
                <X size={17} />
              </button>
            </div>

            {/* Custom Title Input */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#708499] block">عنوان سفارشی مدیر (Custom Title)</label>
              <input 
                type="text"
                value={editingAdminPerms.customTitle || ''}
                onChange={e => setEditingAdminPerms(prev => ({ ...prev, customTitle: e.target.value }))}
                placeholder="مثال: مدیر محتوا، ادمین تبادل، پشتیبان..."
                className="w-full bg-[#242f3d] border border-white/5 focus:border-[#3390ec]/50 rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
            </div>

            {/* Permission Switches for Channel Admin */}
            <div className="bg-[#242f3d]/60 rounded-2xl border border-white/5 p-3 space-y-2.5 text-xs max-h-60 overflow-y-auto">
              {[
                { key: 'canPostMessages', label: 'ارسال پیام در کانال (Post Messages)' },
                { key: 'canEditMessages', label: 'ویرایش پیام‌های دیگران (Edit Messages)' },
                { key: 'canDeleteMessages', label: 'حذف پیام‌های دیگران (Delete Messages)' },
                { key: 'canChangeInfo', label: 'تغییر مشخصات کانال (Change Info)' },
                { key: 'canInviteUsers', label: 'افزودن مشترکین با لینک (Add Subscribers)' },
                { key: 'canBanUsers', label: 'مسدودسازی کاربران (Ban Users)' },
                { key: 'canPinMessages', label: 'سنجاق پیام‌ها (Pin Messages)' },
                { key: 'canManageStories', label: 'ارسال و مدیریت استوری (Manage Stories)' },
                { key: 'canAddAdmins', label: 'افزودن مدیران جدید (Add New Admins)' }
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between py-1">
                  <span className="text-white/90">{item.label}</span>
                  <input 
                    type="checkbox"
                    checked={Boolean((editingAdminPerms as any)[item.key])}
                    onChange={e => setEditingAdminPerms(prev => ({ ...prev, [item.key]: e.target.checked }))}
                    className="w-4 h-4 accent-[#3390ec] cursor-pointer"
                  />
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => handleDismissAdmin(editingAdminUser.id, editingAdminUser.displayName)}
                className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold transition-all"
              >
                عزل از مدیریت
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingAdminUser(null)}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all"
                >
                  انصراف
                </button>
                <button
                  onClick={handleSaveAdminPerms}
                  className="px-4 py-2 bg-[#3390ec] hover:bg-[#2881d9] text-white rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  ذخیره دسترسی‌ها
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= ADD SUBSCRIBER PICKER MODAL ================= */}
      {showAddSubscriberModal && (
        <div 
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowAddSubscriberModal(false)}
        >
          <div 
            className="w-full max-w-sm bg-[#17212b] rounded-3xl overflow-hidden shadow-2xl border border-white/10 p-5 space-y-3 animate-pop text-right"
            onClick={e => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h4 className="font-bold text-white text-sm">افزودن مشترک جدید</h4>
              <button onClick={() => setShowAddSubscriberModal(false)} className="p-1 hover:bg-white/10 rounded-full text-[#708499]">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pt-1">
              {availableUsersToAdd.length === 0 ? (
                <p className="text-center text-xs text-[#708499] py-4">کاربر جدیدی برای افزودن یافت نشد.</p>
              ) : (
                availableUsersToAdd.map(u => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setSubscribersList(prev => [...prev, u]);
                      logRecentAction('مشترک جدید اضافه شد', `@${u.username}`, 'add_subscriber');
                      setShowAddSubscriberModal(false);
                    }}
                    className="w-full p-2.5 hover:bg-white/5 rounded-2xl flex items-center justify-between transition-colors text-right"
                  >
                    <div className="flex items-center gap-2.5">
                      <img src={u.avatar || DEFAULT_AVATAR} className="w-8 h-8 rounded-full object-cover" />
                      <div>
                        <span className="text-xs font-bold text-white block">{u.displayName}</span>
                        <span className="text-[10px] text-[#708499]">@{u.username}</span>
                      </div>
                    </div>
                    <Plus size={16} className="text-[#3390ec]" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= ADD ADMIN FROM SUBSCRIBERS MODAL ================= */}
      {showAddAdminPicker && (
        <div 
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowAddAdminPicker(false)}
        >
          <div 
            className="w-full max-w-sm bg-[#17212b] rounded-3xl overflow-hidden shadow-2xl border border-white/10 p-5 space-y-3 animate-pop text-right"
            onClick={e => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h4 className="font-bold text-white text-sm">انتخاب مدیر از مشترکین</h4>
              <button onClick={() => setShowAddAdminPicker(false)} className="p-1 hover:bg-white/10 rounded-full text-[#708499]">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pt-1">
              {subscribersList
                .filter(s => s.id !== chat.adminId && !adminsMap[s.id])
                .map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => {
                      setEditingAdminUser(sub);
                      setEditingAdminPerms({
                        canChangeInfo: true,
                        canDeleteMessages: true,
                        canBanUsers: true,
                        canInviteUsers: true,
                        canPinMessages: true,
                        canAddAdmins: false,
                        canPostMessages: true,
                        canEditMessages: true,
                        canManageStories: true,
                        customTitle: 'مدیر محتوا'
                      });
                      setShowAddAdminPicker(false);
                    }}
                    className="w-full p-2.5 hover:bg-white/5 rounded-2xl flex items-center justify-between transition-colors text-right"
                  >
                    <div className="flex items-center gap-2.5">
                      <img src={sub.avatar || DEFAULT_AVATAR} className="w-8 h-8 rounded-full object-cover" />
                      <div>
                        <span className="text-xs font-bold text-white block">{sub.displayName}</span>
                        <span className="text-[10px] text-[#708499]">@{sub.username}</span>
                      </div>
                    </div>
                    <ShieldCheck size={16} className="text-[#3390ec]" />
                  </button>
                ))}
              {subscribersList.filter(s => s.id !== chat.adminId && !adminsMap[s.id]).length === 0 && (
                <p className="text-center text-xs text-[#708499] py-4">همه مشترکین حاضر مدیر هستند یا مشترک دیگری وجود ندارد.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= BAN USER MODAL ================= */}
      {showBanUserModal && (
        <div 
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowBanUserModal(false)}
        >
          <div 
            className="w-full max-w-sm bg-[#17212b] rounded-3xl overflow-hidden shadow-2xl border border-white/10 p-5 space-y-3 animate-pop text-right"
            onClick={e => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h4 className="font-bold text-white text-sm">مسدودسازی کاربر در کانال</h4>
              <button onClick={() => setShowBanUserModal(false)} className="p-1 hover:bg-white/10 rounded-full text-[#708499]">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pt-1">
              {subscribersList
                .filter(s => s.id !== chat.adminId && s.id !== currentUser.id)
                .map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => {
                      handleRemoveSubscriber(sub);
                      setShowBanUserModal(false);
                    }}
                    className="w-full p-2.5 hover:bg-white/5 rounded-2xl flex items-center justify-between transition-colors text-right"
                  >
                    <div className="flex items-center gap-2.5">
                      <img src={sub.avatar || DEFAULT_AVATAR} className="w-8 h-8 rounded-full object-cover" />
                      <div>
                        <span className="text-xs font-bold text-white block">{sub.displayName}</span>
                        <span className="text-[10px] text-[#708499]">@{sub.username}</span>
                      </div>
                    </div>
                    <UserX size={16} className="text-rose-400" />
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= CREATE CUSTOM INVITE LINK MODAL ================= */}
      {showCreateLinkModal && (
        <div 
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowCreateLinkModal(false)}
        >
          <div 
            className="w-full max-w-sm bg-[#17212b] rounded-3xl overflow-hidden shadow-2xl border border-white/10 p-5 space-y-4 animate-pop text-right"
            onClick={e => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h4 className="font-bold text-white text-sm">ایجاد پیوند دعوت سفارشی</h4>
              <button onClick={() => setShowCreateLinkModal(false)} className="p-1 hover:bg-white/10 rounded-full text-[#708499]">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#708499] block mb-1">نام یا عنوان پیوند</label>
                <input 
                  type="text"
                  value={newLinkTitle}
                  onChange={e => setNewLinkTitle(e.target.value)}
                  placeholder="مثال: تبلیغات اینستاگرام، جشنواره..."
                  className="w-full bg-[#242f3d] border border-white/5 focus:border-[#3390ec]/50 rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#708499] block mb-1">محدودیت تعداد اعضا (۰ = نامحدود)</label>
                <input 
                  type="number"
                  min="0"
                  value={newLinkLimit}
                  onChange={e => setNewLinkLimit(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#242f3d] border border-white/5 focus:border-[#3390ec]/50 rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreateLinkModal(false)}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all"
              >
                انصراف
              </button>
              <button
                onClick={handleCreateNewInviteLink}
                className="px-4 py-2 bg-[#3390ec] hover:bg-[#2881d9] text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                ایجاد پیوند
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= DELETE CHANNEL CONFIRMATION ================= */}
      {showDeleteConfirm && (
        <div 
          className="fixed inset-0 z-70 bg-black/85 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div 
            className="w-full max-w-sm bg-[#17212b] rounded-3xl overflow-hidden shadow-2xl border border-red-500/20 p-5 space-y-4 animate-pop text-right"
            onClick={e => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle size={24} />
              <h4 className="font-bold text-white text-sm">حذف و انحلال کامل کانال؟</h4>
            </div>
            <p className="text-xs text-[#708499] leading-relaxed">
              آیا از حذف کامل کانال <strong>{channelName}</strong> اطمینان دارید؟ تمامی پیام‌ها، رسانه‌ها و دسترسی‌های مشترکین برای همیشه پاک خواهد شد.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all"
              >
                انصراف
              </button>
              <button
                onClick={() => {
                  if (onDeleteChat) onDeleteChat();
                  onClose();
                }}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                بله، کانال حذف شود
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
