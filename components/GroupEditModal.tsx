import React, { useState, useMemo } from 'react';
import { 
  Chat, User, AdminPermissions, Permissions, InviteLinkItem, RecentActionItem, DEFAULT_AVATAR 
} from '../types';
import { 
  X, ChevronLeft, ChevronRight, SlidersHorizontal, Heart, Key, Link2, 
  ShieldCheck, Users, ClipboardList, Check, Copy, RefreshCw, Plus, 
  Trash2, Shield, UserX, UserCheck, AlertTriangle, ArrowRight, Lock, 
  Globe, Sparkles, MessageSquare, Image, Mic, BarChart2, Pin, Search,
  Clock, ShieldAlert, CheckCircle2
} from 'lucide-react';
import { generateLocalAvatarSvg } from '../services/avatarGenerator';

interface GroupEditModalProps {
  chat: Chat;
  currentUser: User;
  chats: Chat[];
  onClose: () => void;
  onAction: (action: string, payload: any) => void;
  onDeleteChat?: () => void;
}

const ALL_EMOJIS = ['👍', '❤️', '🔥', '🎉', '😂', '👏', '😢', '😮', '🤔', '👎', '⚡', '💯', '🤝', '😍', '🥳', '🤩'];

export const GroupEditModal: React.FC<GroupEditModalProps> = ({
  chat,
  currentUser,
  chats,
  onClose,
  onAction,
  onDeleteChat
}) => {
  // Navigation: 'main' or any of the 7 subviews
  const [activeView, setActiveView] = useState<
    'main' | 'groupType' | 'reactions' | 'permissions' | 'inviteLinks' | 'administrators' | 'members' | 'recentActions'
  >('main');

  // Basic Info State
  const [groupName, setGroupName] = useState(chat.groupName || '');
  const [groupDesc, setGroupDesc] = useState(chat.description || '');
  const [groupAvatar, setGroupAvatar] = useState(chat.groupAvatar || '');

  // 1. Group Type State
  const [isPublic, setIsPublic] = useState<boolean>(Boolean(chat.isPublic));
  const [publicHandle, setPublicHandle] = useState<string>(chat.publicHandle || '');

  // 2. Reactions State
  const [reactionsSetting, setReactionsSetting] = useState<'all' | 'some' | 'off'>(
    chat.reactionsSetting || 'all'
  );
  const [allowedReactions, setAllowedReactions] = useState<string[]>(
    chat.allowedReactions || ['👍', '❤️', '🔥', '🎉', '😂', '👏']
  );

  // 3. Permissions State
  const [permissions, setPermissions] = useState<Permissions>({
    canSendMessages: chat.permissions?.canSendMessages ?? true,
    canSendMedia: chat.permissions?.canSendMedia ?? true,
    canSendVoice: chat.permissions?.canSendVoice ?? true,
    canSendPolls: chat.permissions?.canSendPolls ?? true,
    canEmbedLinks: chat.permissions?.canEmbedLinks ?? true,
    canAddUsers: chat.permissions?.canAddUsers ?? true,
    canPinMessages: chat.permissions?.canPinMessages ?? true,
    canChangeInfo: chat.permissions?.canChangeInfo ?? false,
  });
  const [slowMode, setSlowMode] = useState<number>(chat.slowMode || 0);

  // 4. Invite Links State
  const [inviteLinks, setInviteLinks] = useState<InviteLinkItem[]>(() => {
    const list = chat.inviteLinksList ? [...chat.inviteLinksList] : [];
    if (chat.inviteLink && !list.some(l => l.link === chat.inviteLink)) {
      list.unshift({
        id: 'primary',
        link: chat.inviteLink,
        title: 'پیوند اصلی گروه',
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
    customTitle: ''
  });
  const [showAddAdminPicker, setShowAddAdminPicker] = useState(false);

  // 6. Members State
  const [membersList, setMembersList] = useState<User[]>(chat.participants || []);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  // 7. Recent Actions State
  const [recentActions, setRecentActions] = useState<RecentActionItem[]>(() => {
    if (chat.recentActions && chat.recentActions.length > 0) {
      return chat.recentActions;
    }
    // Generate initial actions if empty
    return [
      {
        id: 'ra_init',
        actorId: chat.adminId || currentUser.id,
        actorName: currentUser.displayName,
        action: 'create_group',
        title: 'گروه ایجاد شد',
        details: `نام گروه: ${chat.groupName || 'گروه'}`,
        timestamp: Date.now() - 3600000
      }
    ];
  });
  const [actionsFilter, setActionsFilter] = useState<string>('all');

  // Confirmation modal for deleting group
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isCreator = chat.adminId === currentUser.id;
  const userAdminPerms = chat.admins?.[currentUser.id];
  const canManageAdmins = isCreator || Boolean(userAdminPerms?.canAddAdmins);

  // Helper to record recent action
  const logRecentAction = (title: string, details?: string, actionType: string = 'change_info') => {
    const newEntry: RecentActionItem = {
      id: `ra_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      actorId: currentUser.id,
      actorName: currentUser.displayName,
      action: actionType,
      title,
      details,
      timestamp: Date.now()
    };
    setRecentActions(prev => [newEntry, ...prev]);
    return newEntry;
  };

  // Calculate active permissions count (e.g. 7/8)
  const activePermissionsCount = useMemo(() => {
    const keys = [
      'canSendMessages', 'canSendMedia', 'canSendVoice', 
      'canSendPolls', 'canEmbedLinks', 'canAddUsers', 
      'canPinMessages', 'canChangeInfo'
    ] as const;
    let count = 0;
    keys.forEach(k => {
      if (permissions[k]) count++;
    });
    return `${count}/8`;
  }, [permissions]);

  // Total admins count including creator
  const totalAdminsCount = useMemo(() => {
    const adminKeys = Object.keys(adminsMap);
    return chat.adminId && !adminKeys.includes(chat.adminId) 
      ? adminKeys.length + 1 
      : Math.max(adminKeys.length, 1);
  }, [adminsMap, chat.adminId]);

  // All known users from all chats to add as members
  const availableUsersToAdd = useMemo(() => {
    const existingIds = new Set(membersList.map(m => m.id));
    const set = new Map<string, User>();
    chats.forEach(c => {
      c.participants?.forEach(p => {
        if (!existingIds.has(p.id) && p.id !== 'saved') {
          set.set(p.id, p);
        }
      });
    });
    return Array.from(set.values());
  }, [chats, membersList]);

  // Save all changes
  const handleSaveAll = () => {
    const updatedPayload = {
      groupName: groupName.trim() || chat.groupName,
      description: groupDesc.trim(),
      groupAvatar: groupAvatar || chat.groupAvatar,
      isPublic,
      publicHandle: isPublic ? publicHandle.trim() : '',
      slowMode,
      permissions,
      reactionsSetting,
      allowedReactions,
      inviteLinksList: inviteLinks,
      admins: adminsMap,
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
                <h3 className="font-bold text-white text-base">ویرایش گروه</h3>
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
                {activeView === 'groupType' && 'نوع گروه'}
                {activeView === 'reactions' && 'واکنش‌ها'}
                {activeView === 'permissions' && 'مجوزها'}
                {activeView === 'inviteLinks' && 'لینک‌های دعوت'}
                {activeView === 'administrators' && 'مدیران'}
                {activeView === 'members' && 'اعضای گروه'}
                {activeView === 'recentActions' && 'اقدامات اخیر'}
              </span>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full text-[#708499]">
              <X size={18}/>
            </button>
          </div>
        </div>

        {/* ================= MODAL BODY ================= */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
          
          {/* ----------------- MAIN VIEW ----------------- */}
          {activeView === 'main' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Avatar + Name + Description Card */}
              <div className="bg-[#242f3d]/40 border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-4">
                <div className="relative group shrink-0">
                  <img 
                    src={groupAvatar || chat.groupAvatar || DEFAULT_AVATAR}
                    onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                    className="w-20 h-20 rounded-full object-cover border-2 border-[#3390ec]/40 shadow-xl bg-[#242f3d]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newSvg = generateLocalAvatarSvg(groupName || 'Group', Date.now().toString());
                      setGroupAvatar(newSvg);
                      logRecentAction('تصویر گروه تغییر یافت', 'تولید خودکار آواتار');
                    }}
                    title="تولید خودکار تصویر"
                    className="absolute bottom-0 right-0 p-1.5 bg-[#3390ec] text-white rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all"
                  >
                    <Sparkles size={13} />
                  </button>
                </div>

                <div className="flex-1 w-full space-y-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-[#708499] block mb-1">نام گروه</label>
                    <input 
                      type="text"
                      value={groupName}
                      onChange={e => setGroupName(e.target.value)}
                      className="w-full bg-[#17212b] border border-white/5 focus:border-[#3390ec]/50 rounded-xl px-3 py-2 text-xs text-white outline-none"
                      placeholder="نام گروه..."
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#708499] block mb-1">توضیحات و بیوگرافی</label>
                    <textarea 
                      value={groupDesc}
                      onChange={e => setGroupDesc(e.target.value)}
                      rows={2}
                      className="w-full bg-[#17212b] border border-white/5 focus:border-[#3390ec]/50 rounded-xl px-3 py-1.5 text-xs text-white outline-none resize-none"
                      placeholder="توضیحاتی برای گروه بنویسید..."
                    />
                  </div>
                </div>
              </div>

              {/* LIST OF 7 GROUP CAPABILITIES (Matching the User Screenshot Exactly) */}
              <div className="bg-[#242f3d]/40 border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5 text-sm">
                
                {/* 1. Group type */}
                <button
                  type="button"
                  onClick={() => setActiveView('groupType')}
                  className="w-full p-3.5 flex items-center justify-between hover:bg-white/5 transition-all text-right group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                      <SlidersHorizontal size={17} />
                    </div>
                    <span className="font-semibold text-white">نوع گروه (Group type)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${isPublic ? 'text-[#3390ec]' : 'text-rose-400'}`}>
                      {isPublic ? 'عمومی (Public)' : 'خصوصی (Private)'}
                    </span>
                    <ChevronLeft size={16} className="text-[#708499] group-hover:-translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* 2. Reactions */}
                <button
                  type="button"
                  onClick={() => setActiveView('reactions')}
                  className="w-full p-3.5 flex items-center justify-between hover:bg-white/5 transition-all text-right group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center">
                      <Heart size={17} />
                    </div>
                    <span className="font-semibold text-white">واکنش‌ها (Reactions)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-rose-400">
                      {reactionsSetting === 'all' && 'همه (All)'}
                      {reactionsSetting === 'some' && `انتخابی (${allowedReactions.length})`}
                      {reactionsSetting === 'off' && 'غیرفعال (Off)'}
                    </span>
                    <ChevronLeft size={16} className="text-[#708499] group-hover:-translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* 3. Permissions */}
                <button
                  type="button"
                  onClick={() => setActiveView('permissions')}
                  className="w-full p-3.5 flex items-center justify-between hover:bg-white/5 transition-all text-right group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                      <Key size={17} />
                    </div>
                    <span className="font-semibold text-white">مجوزها (Permissions)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-rose-400 font-mono">
                      {activePermissionsCount}
                    </span>
                    <ChevronLeft size={16} className="text-[#708499] group-hover:-translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* 4. Invite links */}
                <button
                  type="button"
                  onClick={() => setActiveView('inviteLinks')}
                  className="w-full p-3.5 flex items-center justify-between hover:bg-white/5 transition-all text-right group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                      <Link2 size={17} />
                    </div>
                    <span className="font-semibold text-white">لینک‌های دعوت (Invite links)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-rose-400 font-mono">
                      {inviteLinks.filter(l => !l.isRevoked).length}
                    </span>
                    <ChevronLeft size={16} className="text-[#708499] group-hover:-translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* 5. Administrators */}
                <button
                  type="button"
                  onClick={() => setActiveView('administrators')}
                  className="w-full p-3.5 flex items-center justify-between hover:bg-white/5 transition-all text-right group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                      <ShieldCheck size={17} />
                    </div>
                    <span className="font-semibold text-white">مدیران (Administrators)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-rose-400 font-mono">
                      {totalAdminsCount}
                    </span>
                    <ChevronLeft size={16} className="text-[#708499] group-hover:-translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* 6. Members */}
                <button
                  type="button"
                  onClick={() => setActiveView('members')}
                  className="w-full p-3.5 flex items-center justify-between hover:bg-white/5 transition-all text-right group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                      <Users size={17} />
                    </div>
                    <span className="font-semibold text-white">اعضا (Members)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-rose-400 font-mono">
                      {membersList.length}
                    </span>
                    <ChevronLeft size={16} className="text-[#708499] group-hover:-translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* 7. Recent actions */}
                <button
                  type="button"
                  onClick={() => setActiveView('recentActions')}
                  className="w-full p-3.5 flex items-center justify-between hover:bg-white/5 transition-all text-right group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                      <ClipboardList size={17} />
                    </div>
                    <span className="font-semibold text-white">اقدامات اخیر (Recent actions)</span>
                  </div>
                  <ChevronLeft size={16} className="text-[#708499] group-hover:-translate-x-1 transition-transform" />
                </button>

              </div>

              {/* Danger Zone: Delete / Leave Group */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-3 px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <Trash2 size={16} />
                  <span>{isCreator ? 'حذف و انحلال کامل گروه' : 'خروج از گروه'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ----------------- SUBVIEW 1: GROUP TYPE ----------------- */}
          {activeView === 'groupType' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-[#242f3d]/50 p-4 rounded-2xl border border-white/5 space-y-3">
                <label 
                  onClick={() => {
                    setIsPublic(false);
                    logRecentAction('نوع گروه به خصوصی تغییر یافت', '', 'change_type');
                  }}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    !isPublic ? 'bg-[#3390ec]/15 border-[#3390ec]' : 'bg-[#17212b] border-white/5 hover:border-white/10'
                  }`}
                >
                  <input 
                    type="radio" 
                    name="groupTypeRadio" 
                    checked={!isPublic} 
                    onChange={() => {}} 
                    className="mt-1 text-[#3390ec]"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Lock size={15} className="text-rose-400" />
                      <h4 className="font-bold text-white text-xs">گروه خصوصی (Private Group)</h4>
                    </div>
                    <p className="text-[11px] text-[#708499] leading-relaxed">
                      گروه‌های خصوصی فقط از طریق پیوند دعوت قابل پیوستن هستند و در جستجوی عمومی دیده نمی‌شوند.
                    </p>
                  </div>
                </label>

                <label 
                  onClick={() => {
                    setIsPublic(true);
                    logRecentAction('نوع گروه به عمومی تغییر یافت', '', 'change_type');
                  }}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    isPublic ? 'bg-[#3390ec]/15 border-[#3390ec]' : 'bg-[#17212b] border-white/5 hover:border-white/10'
                  }`}
                >
                  <input 
                    type="radio" 
                    name="groupTypeRadio" 
                    checked={isPublic} 
                    onChange={() => {}} 
                    className="mt-1 text-[#3390ec]"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Globe size={15} className="text-[#3390ec]" />
                      <h4 className="font-bold text-white text-xs">گروه عمومی (Public Group)</h4>
                    </div>
                    <p className="text-[11px] text-[#708499] leading-relaxed">
                      هر کاربری می‌تواند این گروه را در جستجوی پیام‌رسان پیدا کرده و به آن بپیوندد.
                    </p>
                  </div>
                </label>
              </div>

              {isPublic && (
                <div className="bg-[#242f3d]/50 p-4 rounded-2xl border border-white/5 space-y-2">
                  <label className="text-xs font-bold text-white block">پیوند و شناسه عمومی گروه (Handle)</label>
                  <p className="text-[11px] text-[#708499]">کاربران می‌توانند با این آیدی گروه را پیدا کرده و وارد شوند:</p>
                  <div className="relative">
                    <input 
                      type="text"
                      value={publicHandle}
                      onChange={e => setPublicHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                      placeholder="group_username"
                      dir="ltr"
                      className="w-full bg-[#17212b] border border-white/10 focus:border-[#3390ec] rounded-xl px-3 py-2.5 pl-8 text-xs text-white outline-none font-mono"
                    />
                    <span className="absolute left-3 top-2.5 text-[#708499] text-xs font-bold">@</span>
                  </div>
                  {publicHandle && (
                    <p className="text-[11px] text-emerald-400 font-mono" dir="ltr">
                      https://starchat.app/{publicHandle}
                    </p>
                  )}
                </div>
              )}

              {!isPublic && chat.inviteLink && (
                <div className="bg-[#242f3d]/50 p-4 rounded-2xl border border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">پیوند دعوت خصوصی فعلی:</span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(chat.inviteLink!);
                        alert('پیوند دعوت کپی شد');
                      }}
                      className="text-[#3390ec] hover:underline flex items-center gap-1 font-bold"
                    >
                      <Copy size={13}/> کپی
                    </button>
                  </div>
                  <p className="text-[11px] text-[#3390ec] font-mono bg-black/25 p-2 rounded-xl truncate" dir="ltr">
                    {chat.inviteLink}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ----------------- SUBVIEW 2: REACTIONS ----------------- */}
          {activeView === 'reactions' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-[#242f3d]/50 p-4 rounded-2xl border border-white/5 space-y-3">
                <label 
                  onClick={() => {
                    setReactionsSetting('all');
                    logRecentAction('تنظیمات واکنش‌ها تغییر کرد', 'همه واکنش‌ها مجاز شد', 'change_reactions');
                  }}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    reactionsSetting === 'all' ? 'bg-[#3390ec]/15 border-[#3390ec]' : 'bg-[#17212b] border-white/5'
                  }`}
                >
                  <input type="radio" checked={reactionsSetting === 'all'} onChange={() => {}} className="mt-1" />
                  <div>
                    <h4 className="font-bold text-white text-xs">همه واکنش‌ها (All Reactions)</h4>
                    <p className="text-[11px] text-[#708499]">اعضا می‌توانند از هر ایموجی دلخواهی برای واکنش به پیام‌ها استفاده کنند.</p>
                  </div>
                </label>

                <label 
                  onClick={() => {
                    setReactionsSetting('some');
                    logRecentAction('تنظیمات واکنش‌ها تغییر کرد', 'واکنش‌های انتخابی فعال شد', 'change_reactions');
                  }}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    reactionsSetting === 'some' ? 'bg-[#3390ec]/15 border-[#3390ec]' : 'bg-[#17212b] border-white/5'
                  }`}
                >
                  <input type="radio" checked={reactionsSetting === 'some'} onChange={() => {}} className="mt-1" />
                  <div>
                    <h4 className="font-bold text-white text-xs">واکنش‌های انتخابی (Some Reactions)</h4>
                    <p className="text-[11px] text-[#708499]">فقط ایموجی‌های مشخص شده توسط شما برای واکنش در دسترس خواهند بود.</p>
                  </div>
                </label>

                <label 
                  onClick={() => {
                    setReactionsSetting('off');
                    logRecentAction('تنظیمات واکنش‌ها تغییر کرد', 'واکنش‌ها غیرفعال شد', 'change_reactions');
                  }}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    reactionsSetting === 'off' ? 'bg-red-500/15 border-red-500' : 'bg-[#17212b] border-white/5'
                  }`}
                >
                  <input type="radio" checked={reactionsSetting === 'off'} onChange={() => {}} className="mt-1" />
                  <div>
                    <h4 className="font-bold text-white text-xs">غیرفعال (No Reactions)</h4>
                    <p className="text-[11px] text-[#708499]">امکان ثبت واکنش به پیام‌ها به طور کامل بسته می‌شود.</p>
                  </div>
                </label>
              </div>

              {reactionsSetting === 'some' && (
                <div className="bg-[#242f3d]/50 p-4 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">ایموجی‌های مجاز ({allowedReactions.length})</span>
                    <button
                      type="button"
                      onClick={() => setAllowedReactions(ALL_EMOJIS)}
                      className="text-[11px] text-[#3390ec] hover:underline font-bold"
                    >
                      انتخاب همه
                    </button>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {ALL_EMOJIS.map(emoji => {
                      const isAllowed = allowedReactions.includes(emoji);
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            if (isAllowed) {
                              setAllowedReactions(allowedReactions.filter(e => e !== emoji));
                            } else {
                              setAllowedReactions([...allowedReactions, emoji]);
                            }
                          }}
                          className={`p-2 rounded-xl text-xl flex items-center justify-center border transition-all ${
                            isAllowed 
                              ? 'bg-[#3390ec]/20 border-[#3390ec] scale-105 shadow-sm' 
                              : 'bg-[#17212b] border-white/5 opacity-40 hover:opacity-100'
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

          {/* ----------------- SUBVIEW 3: PERMISSIONS ----------------- */}
          {activeView === 'permissions' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-[#242f3d]/50 p-3 rounded-2xl border border-white/5">
                <p className="text-xs text-[#708499] leading-relaxed">
                  اعضای عادی این گروه چه کارهایی می‌توانند انجام دهند؟ مدیران از این محدودیت‌ها مستثنی هستند.
                </p>
              </div>

              <div className="bg-[#242f3d]/40 rounded-2xl border border-white/5 divide-y divide-white/5 overflow-hidden">
                {[
                  { key: 'canSendMessages', icon: MessageSquare, label: 'ارسال پیام‌ها (Send Messages)', desc: 'ارسال متن و چت عادی در گروه' },
                  { key: 'canSendMedia', icon: Image, label: 'ارسال رسانه (Send Media)', desc: 'ارسال تصاویر، ویدیوها و فایل‌ها' },
                  { key: 'canSendVoice', icon: Mic, label: 'ارسال پیام‌های صوتی (Voice Messages)', desc: 'ضبط و ارسال ویس' },
                  { key: 'canSendPolls', icon: BarChart2, label: 'ارسال نظرسنجی (Send Polls)', desc: 'ایجاد و به اشتراک‌گذاری نظرسنجی' },
                  { key: 'canEmbedLinks', icon: Link2, label: 'پیش‌نمایش پیوندها (Embed Links)', desc: 'نمایش پیش‌نمایش لینک‌های وب' },
                  { key: 'canAddUsers', icon: Users, label: 'افزودن اعضا (Add Members)', desc: 'امکان دعوت دوستان و اعضای جدید' },
                  { key: 'canPinMessages', icon: Pin, label: 'سنجاق کردن پیام‌ها (Pin Messages)', desc: 'پین کردن پیام‌ها در بالای گروه' },
                  { key: 'canChangeInfo', icon: SlidersHorizontal, label: 'تغییر مشخصات گروه (Change Info)', desc: 'تغییر نام، عکس و توضیحات گروه' },
                ].map(({ key, icon: Icon, label, desc }) => {
                  const val = Boolean(permissions[key as keyof Permissions]);
                  return (
                    <div key={key} className="p-3.5 flex items-center justify-between hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-[#3390ec]">
                          <Icon size={16} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">{label}</h4>
                          <p className="text-[10px] text-[#708499]">{desc}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...permissions, [key]: !val };
                          setPermissions(updated);
                          logRecentAction('مجوزهای اعضا به‌روز شد', `${label}: ${!val ? 'فعال' : 'غیرفعال'}`, 'change_permissions');
                        }}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                          val ? 'bg-[#3390ec]' : 'bg-white/20'
                        }`}
                      >
                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                          val ? '-translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Slow Mode */}
              <div className="bg-[#242f3d]/50 p-4 rounded-2xl border border-white/5 space-y-2">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-amber-400" />
                  <h4 className="text-xs font-bold text-white">حالت کندی ارسال پیام (Slow Mode)</h4>
                </div>
                <p className="text-[11px] text-[#708499]">مدت زمان انتظار بین دو ارسال متوالی توسط اعضای عادی:</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
                  {[
                    { label: 'خاموش', sec: 0 },
                    { label: '۱۰ ثانیه', sec: 10 },
                    { label: '۳۰ ثانیه', sec: 30 },
                    { label: '۱ دقیقه', sec: 60 },
                    { label: '۵ دقیقه', sec: 300 },
                    { label: '۱۵ دقیقه', sec: 900 },
                  ].map(item => (
                    <button
                      key={item.sec}
                      type="button"
                      onClick={() => setSlowMode(item.sec)}
                      className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all ${
                        slowMode === item.sec 
                          ? 'bg-[#3390ec] text-white border-[#3390ec]' 
                          : 'bg-[#17212b] text-[#708499] border-white/5 hover:border-white/15'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ----------------- SUBVIEW 4: INVITE LINKS ----------------- */}
          {activeView === 'inviteLinks' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#708499]">پیوندهای دعوت فعال ({inviteLinks.filter(l => !l.isRevoked).length})</span>
                <button
                  type="button"
                  onClick={() => setShowCreateLinkModal(true)}
                  className="px-3 py-1.5 bg-[#3390ec]/20 hover:bg-[#3390ec]/30 text-[#3390ec] border border-[#3390ec]/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Plus size={14} />
                  <span>پیوند جدید</span>
                </button>
              </div>

              {/* Primary Link Card */}
              <div className="bg-[#242f3d]/50 p-4 rounded-2xl border border-white/5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <span className="font-bold text-white">پیوند اصلی و دائمی گروه</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('آیا از باطل کردن این پیوند و ساخت پیوند جدید اطمینان دارید؟ پیوند قبلی غیرفعال می‌شود.')) {
                        onAction('regenerateInviteLink', {});
                        const newUrl = `${window.location.origin}/join/g_${Math.random().toString(36).substring(2, 9)}`;
                        setInviteLinks(prev => prev.map(l => l.id === 'primary' ? { ...l, link: newUrl } : l));
                        logRecentAction('پیوند دعوت اصلی باطل شد و پیوند جدید تولید شد', '', 'revoke_invite_link');
                      }
                    }}
                    className="text-amber-400 hover:text-amber-300 text-[11px] font-bold flex items-center gap-1"
                  >
                    <RefreshCw size={12} />
                    <span>بازتولید پیوند</span>
                  </button>
                </div>
                <div className="flex items-center gap-2 bg-[#17212b] p-2.5 rounded-xl border border-white/5">
                  <p className="flex-1 text-xs text-[#3390ec] font-mono truncate" dir="ltr">
                    {inviteLinks.find(l => l.id === 'primary')?.link || chat.inviteLink || `${window.location.origin}/join/g_${chat.id}`}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const link = inviteLinks.find(l => l.id === 'primary')?.link || chat.inviteLink || '';
                      navigator.clipboard.writeText(link);
                      alert('پیوند با موفقیت کپی شد!');
                    }}
                    className="p-1.5 bg-[#3390ec]/20 hover:bg-[#3390ec]/30 text-[#3390ec] rounded-lg transition-all"
                    title="کپی پیوند"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>

              {/* Custom Links List */}
              <div className="space-y-2">
                {inviteLinks.filter(l => l.id !== 'primary' && !l.isRevoked).map(item => (
                  <div key={item.id} className="bg-[#242f3d]/40 p-3 rounded-2xl border border-white/5 flex items-center justify-between">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">{item.title || 'پیوند دعوت سفارشی'}</span>
                        {item.usageLimit ? (
                          <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-[#708499]">
                            ظرفیت: {item.usageLimit} نفر
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-[#3390ec] font-mono truncate" dir="ltr">{item.link}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 mr-3">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(item.link);
                          alert('پیوند کپی شد!');
                        }}
                        className="p-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setInviteLinks(prev => prev.map(l => l.id === item.id ? { ...l, isRevoked: true } : l));
                          logRecentAction(`پیوند دعوت ${item.title || ''} لغو شد`, '', 'revoke_invite_link');
                        }}
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg"
                        title="لغو پیوند"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Create Link Modal */}
              {showCreateLinkModal && (
                <div className="bg-[#17212b] p-4 rounded-2xl border border-[#3390ec]/30 space-y-3 shadow-xl">
                  <h4 className="text-xs font-bold text-white">ایجاد پیوند دعوت جدید</h4>
                  <div>
                    <label className="text-[11px] text-[#708499] block mb-1">نام پیوند (اختیاری)</label>
                    <input 
                      type="text"
                      value={newLinkTitle}
                      onChange={e => setNewLinkTitle(e.target.value)}
                      placeholder="مثلاً: لینک دوستان، تبلیغات..."
                      className="w-full bg-[#242f3d] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#708499] block mb-1">محدودیت تعداد اعضا</label>
                    <select
                      value={newLinkLimit}
                      onChange={e => setNewLinkLimit(Number(e.target.value))}
                      className="w-full bg-[#242f3d] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    >
                      <option value={0}>بدون محدودیت (نامحدود)</option>
                      <option value={1}>فقط ۱ نفر</option>
                      <option value={10}>۱۰ نفر</option>
                      <option value={50}>۵۰ نفر</option>
                      <option value={100}>۱۰۰ نفر</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowCreateLinkModal(false)}
                      className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-[#708499] text-xs font-bold rounded-xl"
                    >
                      انصراف
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const newLinkObj: InviteLinkItem = {
                          id: `link_${Date.now()}`,
                          link: `${window.location.origin}/join/g_${Math.random().toString(36).substring(2, 9)}`,
                          title: newLinkTitle.trim() || 'پیوند سفارشی',
                          createdAt: Date.now(),
                          creatorId: currentUser.id,
                          creatorName: currentUser.displayName,
                          usageLimit: newLinkLimit,
                          usageCount: 0
                        };
                        setInviteLinks(prev => [...prev, newLinkObj]);
                        setShowCreateLinkModal(false);
                        setNewLinkTitle('');
                        setNewLinkLimit(0);
                        logRecentAction(`پیوند دعوت جدید ایجاد شد: ${newLinkObj.title}`, '', 'create_invite_link');
                      }}
                      className="flex-1 py-2 bg-[#3390ec] hover:bg-[#2881d9] text-white text-xs font-bold rounded-xl"
                    >
                      ساخت پیوند
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ----------------- SUBVIEW 5: ADMINISTRATORS ----------------- */}
          {activeView === 'administrators' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#708499]">فهرست مدیران ({totalAdminsCount})</span>
                {canManageAdmins && (
                  <button
                    type="button"
                    onClick={() => setShowAddAdminPicker(true)}
                    className="px-3 py-1.5 bg-[#3390ec]/20 hover:bg-[#3390ec]/30 text-[#3390ec] border border-[#3390ec]/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Plus size={14} />
                    <span>افزودن مدیر</span>
                  </button>
                )}
              </div>

              {/* Admins List */}
              <div className="bg-[#242f3d]/40 rounded-2xl border border-white/5 divide-y divide-white/5 overflow-hidden">
                {/* Creator Item */}
                {(() => {
                  const creatorUser = membersList.find(m => m.id === chat.adminId) || currentUser;
                  return (
                    <div className="p-3.5 flex items-center justify-between hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <img 
                          src={creatorUser.avatar || DEFAULT_AVATAR} 
                          onError={e => { e.currentTarget.src = DEFAULT_AVATAR; }}
                          className="w-10 h-10 rounded-full object-cover border border-amber-500/40"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{creatorUser.displayName}</span>
                            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                              مالک گروه
                            </span>
                          </div>
                          <span className="text-[11px] text-[#708499]">@{creatorUser.username}</span>
                        </div>
                      </div>
                      <span className="text-[11px] text-amber-400 font-semibold">دسترسی کامل</span>
                    </div>
                  );
                })()}

                {/* Other Admins */}
                {Object.entries(adminsMap).map(([adminUserId, perms]) => {
                  if (adminUserId === chat.adminId) return null;
                  const adminUser = membersList.find(m => m.id === adminUserId);
                  if (!adminUser) return null;

                  return (
                    <div key={adminUserId} className="p-3.5 flex items-center justify-between hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <img 
                          src={adminUser.avatar || DEFAULT_AVATAR} 
                          onError={e => { e.currentTarget.src = DEFAULT_AVATAR; }}
                          className="w-10 h-10 rounded-full object-cover border border-[#3390ec]/30"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{adminUser.displayName}</span>
                            <span className="text-[10px] bg-[#3390ec]/20 text-[#3390ec] px-2 py-0.5 rounded-full font-bold">
                              {perms.customTitle || 'مدیر'}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#708499]">@{adminUser.username}</span>
                        </div>
                      </div>

                      {canManageAdmins && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAdminUser(adminUser);
                              setEditingAdminPerms(perms);
                            }}
                            className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white text-[11px] font-bold rounded-lg transition-all"
                          >
                            اختیارات
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Admin Picker Modal */}
              {showAddAdminPicker && (
                <div className="bg-[#17212b] p-4 rounded-2xl border border-white/10 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h4 className="text-xs font-bold text-white">انتخاب عضو برای ارتقا به مدیر</h4>
                    <button onClick={() => setShowAddAdminPicker(false)} className="text-[#708499]">
                      <X size={15}/>
                    </button>
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-1.5 custom-scrollbar">
                    {membersList
                      .filter(m => m.id !== chat.adminId && !adminsMap[m.id])
                      .map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setShowAddAdminPicker(false);
                            setEditingAdminUser(m);
                            setEditingAdminPerms({
                              canChangeInfo: true,
                              canDeleteMessages: true,
                              canBanUsers: true,
                              canInviteUsers: true,
                              canPinMessages: true,
                              canAddAdmins: false,
                              customTitle: 'مدیر'
                            });
                          }}
                          className="w-full p-2 flex items-center justify-between hover:bg-white/5 rounded-xl transition-all text-right"
                        >
                          <div className="flex items-center gap-2.5">
                            <img src={m.avatar || DEFAULT_AVATAR} className="w-8 h-8 rounded-full" />
                            <div>
                              <p className="text-xs font-bold text-white">{m.displayName}</p>
                              <p className="text-[10px] text-[#708499]">@{m.username}</p>
                            </div>
                          </div>
                          <span className="text-[11px] text-[#3390ec] font-bold">+ انتصاب</span>
                        </button>
                      ))}
                    {membersList.filter(m => m.id !== chat.adminId && !adminsMap[m.id]).length === 0 && (
                      <p className="text-xs text-[#708499] text-center py-3">همه اعضا هم‌اکنون مدیر هستند.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Admin Permissions Sub-Editor */}
              {editingAdminUser && (
                <div className="bg-[#17212b] p-4 rounded-2xl border border-[#3390ec]/30 space-y-3 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <div className="flex items-center gap-2">
                      <Shield className="text-[#3390ec]" size={18}/>
                      <h4 className="text-xs font-bold text-white">اختیارات مدیر: {editingAdminUser.displayName}</h4>
                    </div>
                    <button onClick={() => setEditingAdminUser(null)} className="text-[#708499]">
                      <X size={15}/>
                    </button>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#708499] block mb-1">عنوان سفارشی (Custom Title)</label>
                    <input 
                      type="text"
                      value={editingAdminPerms.customTitle || ''}
                      onChange={e => setEditingAdminPerms({ ...editingAdminPerms, customTitle: e.target.value })}
                      placeholder="مثلاً: ادمین ارشد، ناظر..."
                      className="w-full bg-[#242f3d] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none"
                    />
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                    {[
                      { key: 'canChangeInfo', label: 'تغییر مشخصات گروه' },
                      { key: 'canDeleteMessages', label: 'حذف پیام‌های دیگران' },
                      { key: 'canBanUsers', label: 'اخراج و مسدودسازی اعضا' },
                      { key: 'canInviteUsers', label: 'دعوت کاربران با لینک' },
                      { key: 'canPinMessages', label: 'سنجاق کردن پیام‌ها' },
                      { key: 'canAddAdmins', label: 'افزودن مدیران جدید' },
                    ].map(({ key, label }) => {
                      const enabled = Boolean(editingAdminPerms[key as keyof AdminPermissions]);
                      return (
                        <div key={key} className="flex items-center justify-between p-2 bg-[#242f3d]/50 rounded-xl">
                          <span className="text-xs text-white">{label}</span>
                          <button
                            type="button"
                            onClick={() => setEditingAdminPerms({ ...editingAdminPerms, [key]: !enabled })}
                            className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                              enabled ? 'bg-[#3390ec]' : 'bg-white/20'
                            }`}
                          >
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                              enabled ? '-translate-x-4' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...adminsMap };
                        delete updated[editingAdminUser.id];
                        setAdminsMap(updated);
                        onAction('removeAdmin', { userId: editingAdminUser.id });
                        logRecentAction(`کاربر ${editingAdminUser.displayName} از مدیریت عزل شد`, '', 'demote_admin');
                        setEditingAdminUser(null);
                      }}
                      className="py-2 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-xl transition-all"
                    >
                      عزل از مدیریت
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = {
                          ...adminsMap,
                          [editingAdminUser.id]: editingAdminPerms
                        };
                        setAdminsMap(updated);
                        onAction('setAdminPermissions', {
                          userId: editingAdminUser.id,
                          permissions: editingAdminPerms
                        });
                        logRecentAction(`اختیارات مدیر ${editingAdminUser.displayName} به‌روز شد`, '', 'promote_admin');
                        setEditingAdminUser(null);
                      }}
                      className="flex-1 py-2 bg-[#3390ec] hover:bg-[#2881d9] text-white text-xs font-bold rounded-xl transition-all shadow-md"
                    >
                      ذخیره اختیارات
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ----------------- SUBVIEW 6: MEMBERS ----------------- */}
          {activeView === 'members' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#708499]">اعضای گروه ({membersList.length})</span>
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(true)}
                  className="px-3 py-1.5 bg-[#3390ec]/20 hover:bg-[#3390ec]/30 text-[#3390ec] border border-[#3390ec]/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Plus size={14} />
                  <span>افزودن عضو</span>
                </button>
              </div>

              {/* Search Members */}
              <div className="relative">
                <input 
                  type="text"
                  value={memberSearchQuery}
                  onChange={e => setMemberSearchQuery(e.target.value)}
                  placeholder="جستجو در اعضای گروه..."
                  className="w-full bg-[#242f3d] border border-white/5 rounded-xl px-3 py-2 pr-9 text-xs text-white outline-none"
                />
                <Search size={15} className="absolute right-3 top-2.5 text-[#708499]" />
              </div>

              {/* Members List */}
              <div className="bg-[#242f3d]/40 rounded-2xl border border-white/5 divide-y divide-white/5 overflow-hidden max-h-72 overflow-y-auto custom-scrollbar">
                {membersList
                  .filter(m => 
                    !memberSearchQuery || 
                    m.displayName.toLowerCase().includes(memberSearchQuery.toLowerCase()) || 
                    m.username.toLowerCase().includes(memberSearchQuery.toLowerCase())
                  )
                  .map(member => {
                    const isMemCreator = member.id === chat.adminId;
                    const isMemAdmin = Boolean(adminsMap[member.id]);

                    return (
                      <div key={member.id} className="p-3 flex items-center justify-between hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3">
                          <img 
                            src={member.avatar || DEFAULT_AVATAR} 
                            onError={e => { e.currentTarget.src = DEFAULT_AVATAR; }}
                            className="w-9 h-9 rounded-full object-cover"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white">{member.displayName}</span>
                              {isMemCreator && (
                                <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.2 rounded font-bold">مالک</span>
                              )}
                              {isMemAdmin && !isMemCreator && (
                                <span className="text-[9px] bg-[#3390ec]/20 text-[#3390ec] px-1.5 py-0.2 rounded font-bold">مدیر</span>
                              )}
                            </div>
                            <span className="text-[10px] text-[#708499]">@{member.username}</span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5">
                          {canManageAdmins && !isMemCreator && !isMemAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAdminUser(member);
                                setEditingAdminPerms({
                                  canChangeInfo: true,
                                  canDeleteMessages: true,
                                  canBanUsers: true,
                                  canInviteUsers: true,
                                  canPinMessages: true,
                                  canAddAdmins: false,
                                  customTitle: 'مدیر'
                                });
                                setActiveView('administrators');
                              }}
                              className="px-2 py-1 bg-white/5 hover:bg-white/10 text-[#3390ec] text-[10px] font-bold rounded-lg"
                              title="ارتقا به مدیر"
                            >
                              + مدیر
                            </button>
                          )}
                          {!isMemCreator && (isCreator || Boolean(userAdminPerms?.canBanUsers)) && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`آیا از حذف ${member.displayName} از گروه مطمئن هستید؟`)) {
                                  onAction('kickMember', { userId: member.id });
                                  setMembersList(prev => prev.filter(m => m.id !== member.id));
                                  logRecentAction(`کاربر ${member.displayName} از گروه اخراج شد`, '', 'remove_member');
                                }
                              }}
                              className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all"
                              title="اخراج از گروه"
                            >
                              <UserX size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Add Member Modal */}
              {showAddMemberModal && (
                <div className="bg-[#17212b] p-4 rounded-2xl border border-white/10 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h4 className="text-xs font-bold text-white">افزودن عضو جدید به گروه</h4>
                    <button onClick={() => setShowAddMemberModal(false)} className="text-[#708499]">
                      <X size={15}/>
                    </button>
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-1.5 custom-scrollbar">
                    {availableUsersToAdd.map(user => (
                      <div key={user.id} className="p-2 flex items-center justify-between hover:bg-white/5 rounded-xl transition-all">
                        <div className="flex items-center gap-2.5">
                          <img src={user.avatar || DEFAULT_AVATAR} className="w-8 h-8 rounded-full" />
                          <div>
                            <p className="text-xs font-bold text-white">{user.displayName}</p>
                            <p className="text-[10px] text-[#708499]">@{user.username}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onAction('addParticipant', user);
                            setMembersList(prev => [...prev, user]);
                            logRecentAction(`کاربر ${user.displayName} به گروه اضافه شد`, '', 'add_member');
                            setShowAddMemberModal(false);
                          }}
                          className="px-2.5 py-1 bg-[#3390ec] hover:bg-[#2881d9] text-white text-[11px] font-bold rounded-lg transition-all"
                        >
                          افزودن
                        </button>
                      </div>
                    ))}
                    {availableUsersToAdd.length === 0 && (
                      <p className="text-xs text-[#708499] text-center py-3">کاربر دیگری برای افزودن یافت نشد.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ----------------- SUBVIEW 7: RECENT ACTIONS ----------------- */}
          {activeView === 'recentActions' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#708499]">گزارش فعالیت‌های مدیریتی ({recentActions.length})</span>
                <select
                  value={actionsFilter}
                  onChange={e => setActionsFilter(e.target.value)}
                  className="bg-[#242f3d] border border-white/10 rounded-xl px-2.5 py-1 text-[11px] text-white outline-none"
                >
                  <option value="all">همه اقدامات</option>
                  <option value="info">اطلاعات و تنظیمات</option>
                  <option value="admins">تغییرات مدیران</option>
                  <option value="members">اعضا و پیوندها</option>
                </select>
              </div>

              <div className="space-y-2">
                {recentActions.map(action => (
                  <div key={action.id} className="bg-[#242f3d]/40 p-3 rounded-2xl border border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#3390ec]" />
                        <span className="text-xs font-bold text-white">{action.title}</span>
                      </div>
                      <span className="text-[10px] text-[#708499] font-mono" dir="ltr">
                        {new Date(action.timestamp).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#708499] pr-4">
                      <span>توسط: <strong className="text-white">{action.actorName}</strong></span>
                      {action.details && <span>{action.details}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Delete Group Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-sm bg-[#17212b] rounded-3xl p-5 border border-red-500/30 space-y-4 text-right shadow-2xl">
              <div className="flex items-center gap-2.5 text-red-400">
                <AlertTriangle size={22} />
                <h4 className="font-bold text-sm text-white">
                  {isCreator ? 'حذف دائمی گروه' : 'خروج از گروه'}
                </h4>
              </div>
              <p className="text-xs text-[#708499] leading-relaxed">
                {isCreator 
                  ? 'با حذف این گروه، تمامی پیام‌ها، رسانه‌ها و دسترسی اعضا برای همیشه پاک خواهند شد و این عملیات غیرقابل بازگشت است.' 
                  : 'آیا مطمئن هستید که می‌خواهید از این گروه خارج شوید؟'}
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    onClose();
                    if (onDeleteChat) onDeleteChat();
                  }}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg"
                >
                  تأیید و {isCreator ? 'حذف گروه' : 'خروج'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
