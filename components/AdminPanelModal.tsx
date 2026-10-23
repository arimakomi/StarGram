import React, { useState, useEffect } from 'react';
import { User, Chat, MessageReport, SystemConfig } from '../types';
import { 
  X, Shield, Sliders, Users, Flag, MessageSquare, AlertTriangle, 
  Check, Ban, UserCheck, Key, ShieldOff, Trash2, Lock, Unlock, 
  Search, RefreshCw, Clock, Filter, Eye, Power
} from 'lucide-react';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, db } from '../services/firebase';

interface AdminPanelModalProps {
  currentUser: User;
  systemConfig: SystemConfig;
  onUpdateSystemConfig: (newConfig: Partial<SystemConfig>) => Promise<void>;
  onClose: () => void;
  onRefreshData?: () => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  currentUser,
  systemConfig,
  onUpdateSystemConfig,
  onClose,
  onRefreshData
}) => {
  const [activeTab, setActiveTab] = useState<'system' | 'reports' | 'users' | 'chats'>('system');

  // System Config state
  const [cfg, setCfg] = useState<SystemConfig>(systemConfig);
  const [isSavingCfg, setIsSavingCfg] = useState(false);

  // Reports state
  const [reports, setReports] = useState<MessageReport[]>([]);
  const [reportFilter, setReportFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const [loadingReports, setLoadingReports] = useState(false);

  // Users state
  const [usersList, setUsersList] = useState<User[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserForAction, setSelectedUserForAction] = useState<User | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [actionModalType, setActionModalType] = useState<'password' | 'tempBan' | null>(null);
  const [tempBanHours, setTempBanHours] = useState(24);

  // Chats state (Groups & Channels)
  const [chatsList, setChatsList] = useState<Chat[]>([]);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [loadingChats, setLoadingChats] = useState(false);

  // Load Reports
  const loadReports = async () => {
    setLoadingReports(true);
    try {
      const snap = await getDocs(collection(db, 'reports'));
      const list: MessageReport[] = [];
      snap.forEach((d: any) => {
        list.push({ id: d.id, ...d.data() });
      });
      list.sort((a, b) => b.timestamp - a.timestamp);
      setReports(list);
    } catch (e) {
      console.error('Error fetching reports:', e);
    } finally {
      setLoadingReports(false);
    }
  };

  // Load Users
  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list: User[] = [];
      snap.forEach((d: any) => {
        list.push({ id: d.id, ...d.data() });
      });
      setUsersList(list);
    } catch (e) {
      console.error('Error fetching users:', e);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Load Chats
  const loadChats = async () => {
    setLoadingChats(true);
    try {
      const snap = await getDocs(collection(db, 'chats'));
      const list: Chat[] = [];
      snap.forEach((d: any) => {
        const c = d.data() as Chat;
        if (c.type === 'group' || c.type === 'channel') {
          list.push(c);
        }
      });
      setChatsList(list);
    } catch (e) {
      console.error('Error fetching chats:', e);
    } finally {
      setLoadingChats(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reports') loadReports();
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'chats') loadChats();
  }, [activeTab]);

  // System toggle handlers
  const handleToggleSystemSetting = async (key: keyof SystemConfig) => {
    const updated = { ...cfg, [key]: !cfg[key] };
    setCfg(updated);
    setIsSavingCfg(true);
    try {
      await onUpdateSystemConfig(updated);
    } catch (e) {
      console.error('Error updating system setting:', e);
    } finally {
      setIsSavingCfg(false);
    }
  };

  // Report Moderation Actions
  const handleResolveReport = async (report: MessageReport, action: 'ban' | 'tempBan' | 'deleteMessage' | 'dismiss') => {
    try {
      // 1. Action on user / message
      if (action === 'ban') {
        await updateDoc(doc(db, 'users', report.reportedUserId), {
          isBanned: true,
          banReason: `تخلف گزارش شده: ${report.reason}`
        });
      } else if (action === 'tempBan') {
        const bannedUntil = Date.now() + 24 * 3600 * 1000; // 24 hours
        await updateDoc(doc(db, 'users', report.reportedUserId), {
          isBanned: true,
          bannedUntil,
          banReason: `مسدودیت موقت: ${report.reason}`
        });
      } else if (action === 'deleteMessage') {
        // Remove message from chat
        const chatRef = doc(db, 'chats', report.chatId);
        const chatSnap = await getDocs(collection(db, 'chats'));
        chatSnap.forEach(async (d: any) => {
          if (d.id === report.chatId) {
            const chatData = d.data() as Chat;
            const updatedMessages = chatData.messages.filter(m => m.id !== report.messageId);
            await updateDoc(chatRef, { messages: updatedMessages });
          }
        });
      }

      // 2. Mark report status
      await updateDoc(doc(db, 'reports', report.id), {
        status: action === 'dismiss' ? 'dismissed' : 'resolved'
      });

      // Refresh list
      loadReports();
      if (onRefreshData) onRefreshData();
    } catch (e) {
      console.error('Error moderating report:', e);
    }
  };

  // User Management Actions
  const handleToggleBanUser = async (user: User) => {
    try {
      const willBeBanned = !user.isBanned;
      await updateDoc(doc(db, 'users', user.id), {
        isBanned: willBeBanned,
        bannedUntil: undefined,
        banReason: willBeBanned ? 'مسدود شده توسط مدیر سیستم' : undefined
      });
      loadUsers();
      if (onRefreshData) onRefreshData();
    } catch (e) {
      console.error('Error toggling ban for user:', e);
    }
  };

  const handleApplyTempBan = async () => {
    if (!selectedUserForAction) return;
    try {
      const bannedUntil = Date.now() + tempBanHours * 3600 * 1000;
      await updateDoc(doc(db, 'users', selectedUserForAction.id), {
        isBanned: true,
        bannedUntil,
        banReason: `مسدودیت موقت برای ${tempBanHours} ساعت`
      });
      setActionModalType(null);
      setSelectedUserForAction(null);
      loadUsers();
      if (onRefreshData) onRefreshData();
    } catch (e) {
      console.error('Error applying temp ban:', e);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUserForAction || !newPasswordInput.trim()) return;
    if (newPasswordInput.trim().length < 6) { alert('رمز عبور باید حداقل ۶ کاراکتر باشد.'); return; }
    try {
      await updateDoc(doc(db, 'users', selectedUserForAction.id), {
        password: newPasswordInput.trim()
      });
      setActionModalType(null);
      setSelectedUserForAction(null);
      setNewPasswordInput('');
      loadUsers();
      alert('رمز عبور کاربر با موفقیت تغییر یافت.');
    } catch (e) {
      console.error('Error resetting password:', e);
    }
  };

  const handleDisable2FA = async (user: User) => {
    if (confirm(`آیا تأیید دومرحله‌ای کاربر «${user.displayName}» غیرفعال شود؟`)) {
      try {
        await updateDoc(doc(db, 'users', user.id), {
          twoFactorEnabled: false,
          passcode: undefined
        });
        loadUsers();
        alert('ورود دومرحله‌ای کاربر خاموش شد.');
      } catch (e) {
        console.error('Error disabling 2FA:', e);
      }
    }
  };

  const handleToggleUserRole = async (user: User) => {
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      await updateDoc(doc(db, 'users', user.id), {
        role: nextRole
      });
      loadUsers();
    } catch (e) {
      console.error('Error toggling role:', e);
    }
  };

  // Group & Channel Actions
  const handleToggleLockChat = async (chat: Chat) => {
    const isLocked = !chat.isLockedByAdmin;
    try {
      await updateDoc(doc(db, 'chats', chat.id), {
        isLockedByAdmin: isLocked
      });
      loadChats();
      if (onRefreshData) onRefreshData();
    } catch (e) {
      console.error('Error locking chat:', e);
    }
  };

  const handleDeleteChatForce = async (chat: Chat) => {
    if (confirm(`آیا از حذف اجباری ${chat.type === 'channel' ? 'کانال' : 'گروه'} «${chat.groupName}» اطمینان دارید؟`)) {
      try {
        await deleteDoc(doc(db, 'chats', chat.id));
        loadChats();
        if (onRefreshData) onRefreshData();
      } catch (e) {
        console.error('Error deleting chat force:', e);
      }
    }
  };

  const filteredReports = reports.filter(r => {
    if (reportFilter === 'all') return true;
    return r.status === reportFilter;
  });

  const filteredUsers = usersList.filter(u => {
    if (!userSearchQuery) return true;
    const q = userSearchQuery.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.phone && u.phone.includes(q))
    );
  });

  const filteredChats = chatsList.filter(c => {
    if (!chatSearchQuery) return true;
    const q = chatSearchQuery.toLowerCase();
    return (
      (c.groupName && c.groupName.toLowerCase().includes(q)) ||
      (c.description && c.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl bg-[#17212b] text-white rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh] max-h-[850px] border border-[#242f3d]"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#242f3d] bg-[#0e1621]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#5288c1]/10 rounded-xl border border-[#5288c1]/30">
              <Shield className="w-5 h-5 text-[#5288c1]" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>پنل مدیریت ارشد استارلی (Super Admin)</span>
              </h2>
              <p className="text-xs text-gray-400">کنترل کلان سیستم، مدیریت کاربران، گروه‌ها و رسیدگی به گزارش‌ها</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#242f3d] rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-[#242f3d] bg-[#121b24] overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('system')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
              activeTab === 'system' ? 'bg-[#5288c1] text-white shadow-xs' : 'text-gray-400 hover:text-white hover:bg-[#242f3d]'
            }`}
          >
            <Sliders className="w-4 h-4" />
            تنظیمات کلان سیستم
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
              activeTab === 'reports' ? 'bg-[#5288c1] text-white shadow-xs' : 'text-gray-400 hover:text-white hover:bg-[#242f3d]'
            }`}
          >
            <Flag className="w-4 h-4" />
            گزارش‌های تخلف
            {reports.filter(r => r.status === 'pending').length > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                {reports.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
              activeTab === 'users' ? 'bg-[#5288c1] text-white shadow-xs' : 'text-gray-400 hover:text-white hover:bg-[#242f3d]'
            }`}
          >
            <Users className="w-4 h-4" />
            مدیریت کاربران ({usersList.length || '...'})
          </button>
          <button
            onClick={() => setActiveTab('chats')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
              activeTab === 'chats' ? 'bg-[#5288c1] text-white shadow-xs' : 'text-gray-400 hover:text-white hover:bg-[#242f3d]'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            کانال‌ها و گروه‌ها ({chatsList.length || '...'})
          </button>
        </div>

        {/* Tab 1: System Settings */}
        {activeTab === 'system' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="bg-[#0e1621] border border-[#242f3d] rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-200">سوئیچ‌های دسترسی عمومی پیام‌رسان</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                با خاموش کردن هر قابلیت، دسترسی کاربران عادی به ایجاد بخش‌های جدید به صورت فوری مسدود می‌شود.
              </p>

              <div className="space-y-3 pt-2">
                {/* Group Creation Toggle */}
                <div className="flex items-center justify-between p-4 bg-[#17212b] rounded-xl border border-[#242f3d]">
                  <div>
                    <h4 className="text-sm font-semibold text-white">امکان ایجاد گروه‌های جدید</h4>
                    <p className="text-xs text-gray-400 mt-0.5">کاربران می‌توانند گروه‌های عمومی و خصوصی بسازند.</p>
                  </div>
                  <button
                    onClick={() => handleToggleSystemSetting('allowGroupCreation')}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      cfg.allowGroupCreation ? 'bg-emerald-500' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        cfg.allowGroupCreation ? 'translate-x-0' : '-translate-x-5'
                      }`}
                    />
                  </button>
                </div>

                {/* Channel Creation Toggle */}
                <div className="flex items-center justify-between p-4 bg-[#17212b] rounded-xl border border-[#242f3d]">
                  <div>
                    <h4 className="text-sm font-semibold text-white">امکان ایجاد کانال‌های جدید</h4>
                    <p className="text-xs text-gray-400 mt-0.5">کاربران مجاز به ساخت کانال‌های اطلاع‌رسانی هستند.</p>
                  </div>
                  <button
                    onClick={() => handleToggleSystemSetting('allowChannelCreation')}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      cfg.allowChannelCreation ? 'bg-emerald-500' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        cfg.allowChannelCreation ? 'translate-x-0' : '-translate-x-5'
                      }`}
                    />
                  </button>
                </div>

                {/* Story Posting Toggle */}
                <div className="flex items-center justify-between p-4 bg-[#17212b] rounded-xl border border-[#242f3d]">
                  <div>
                    <h4 className="text-sm font-semibold text-white">امکان انتشار استوری (Stories)</h4>
                    <p className="text-xs text-gray-400 mt-0.5">نمایش دکمه ایجاد استوری برای کاربران در نوار استوری‌ها.</p>
                  </div>
                  <button
                    onClick={() => handleToggleSystemSetting('allowStories')}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      cfg.allowStories ? 'bg-emerald-500' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        cfg.allowStories ? 'translate-x-0' : '-translate-x-5'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Offline Isolation & Cryptography Badge */}
            <div className="bg-[#0e1621] border border-emerald-500/30 rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <Shield className="w-4 h-4" />
                <span>وضعیت امنیتی و استقلال شبکه: ایزوله ۱۰۰٪ (Zero-External)</span>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                تمام اتصالات خارجی به سرورهای ثالث قطع بوده، آواتارها با موتور داخلی SVG تولید می‌شوند و داده‌ها در دیتابیس لوکال با کلید‌های ۲۵۶ بیتی Web Crypto ذخیره می‌گردند.
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Reports Queue */}
        {activeTab === 'reports' && (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col space-y-4">
            {/* Filter and refresh */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setReportFilter('all')}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    reportFilter === 'all' ? 'bg-[#5288c1] text-white' : 'bg-[#242f3d] text-gray-400 hover:text-white'
                  }`}
                >
                  همه گزارش‌ها
                </button>
                <button
                  onClick={() => setReportFilter('pending')}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    reportFilter === 'pending' ? 'bg-[#5288c1] text-white' : 'bg-[#242f3d] text-gray-400 hover:text-white'
                  }`}
                >
                  در انتظار بررسی
                </button>
                <button
                  onClick={() => setReportFilter('resolved')}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    reportFilter === 'resolved' ? 'bg-[#5288c1] text-white' : 'bg-[#242f3d] text-gray-400 hover:text-white'
                  }`}
                >
                  رسیدگی شده
                </button>
              </div>

              <button
                onClick={loadReports}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-[#242f3d] rounded-lg transition-colors flex items-center gap-1 text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                بروزرسانی
              </button>
            </div>

            {loadingReports ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-xs">
                در حال دریافت گزارش‌ها...
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400 space-y-2">
                <Check className="w-10 h-10 text-emerald-400" />
                <p className="text-sm font-semibold text-white">گزارشی در این دسته‌بندی وجود ندارد</p>
                <p className="text-xs">پیام‌های گزارش‌شده توسط کاربران در این بخش نمایان می‌شوند.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReports.map((report) => (
                  <div
                    key={report.id}
                    className="bg-[#0e1621] border border-[#242f3d] rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">گزارش‌دهنده: {report.reporterName}</span>
                        <span className="text-gray-500">·</span>
                        <span className="text-gray-400">کاربر متخلف: <strong className="text-rose-400">{report.reportedUserName}</strong></span>
                      </div>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                        report.status === 'pending'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : report.status === 'resolved'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-gray-700 text-gray-300'
                      }`}>
                        {report.status === 'pending' ? 'در انتظار بررسی' : report.status === 'resolved' ? 'اقدام شده' : 'رد شده'}
                      </span>
                    </div>

                    <div className="bg-[#17212b] p-3 rounded-lg border border-[#242f3d] text-xs space-y-1">
                      <p className="text-gray-400 font-medium">علت گزارش: <span className="text-white">{report.reason}</span></p>
                      <p className="text-gray-300 italic pt-1 border-t border-gray-700/40">
                        متن پیام: "{report.messageText}"
                      </p>
                    </div>

                    {/* Actions */}
                    {report.status === 'pending' && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleResolveReport(report, 'ban')}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          بن دائم کاربر
                        </button>
                        <button
                          onClick={() => handleResolveReport(report, 'tempBan')}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          مسدودیت موقت (۲۴ ساعت)
                        </button>
                        <button
                          onClick={() => handleResolveReport(report, 'deleteMessage')}
                          className="px-3 py-1.5 bg-[#242f3d] hover:bg-[#2e3c4e] text-gray-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          حذف پیام تخلف
                        </button>
                        <button
                          onClick={() => handleResolveReport(report, 'dismiss')}
                          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-medium transition-colors"
                        >
                          رد گزارش
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: User Management */}
        {activeTab === 'users' && (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col space-y-4">
            {/* Search bar */}
            <div className="relative">
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="جستجوی کاربر بر اساس نام، نام کاربری یا شماره..."
                className="w-full bg-[#0e1621] border border-[#242f3d] rounded-xl px-4 py-2.5 text-white text-xs focus:outline-hidden focus:border-[#5288c1] pr-10"
              />
              <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-3" />
            </div>

            {loadingUsers ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-xs">
                در حال بارگذاری لیست کاربران...
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((u) => {
                  const isCurrent = u.id === currentUser.id;
                  const isBanned = u.isBanned;

                  return (
                    <div
                      key={u.id}
                      className="bg-[#0e1621] border border-[#242f3d] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={u.avatar}
                          alt={u.displayName}
                          className="w-11 h-11 rounded-full object-cover border border-[#242f3d]"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-white">{u.displayName}</span>
                            <span className="text-xs text-gray-400">@{u.username}</span>
                            {u.role === 'superadmin' && (
                              <span className="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30">
                                مدیر ارشد
                              </span>
                            )}
                            {u.role === 'admin' && (
                              <span className="bg-blue-500/20 text-blue-300 text-[10px] px-2 py-0.5 rounded-full border border-blue-500/30">
                                ادمین
                              </span>
                            )}
                            {isBanned && (
                              <span className="bg-rose-500/20 text-rose-300 text-[10px] px-2 py-0.5 rounded-full border border-rose-500/30">
                                مسدود شده
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                            <span>شماره: {u.phone || 'ثبت نشده'}</span>
                            <span>·</span>
                            <span>2FA: {u.twoFactorEnabled ? 'روشن' : 'خاموش'}</span>
                            {u.bannedUntil && (
                              <span className="text-amber-400">
                                (تا {new Date(u.bannedUntil).toLocaleTimeString('fa-IR')} مسدود)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* User Actions */}
                      {!isCurrent && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleToggleBanUser(u)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 ${
                              isBanned
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                : 'bg-rose-600/80 hover:bg-rose-600 text-white'
                            }`}
                          >
                            {isBanned ? (
                              <>
                                <UserCheck className="w-3.5 h-3.5" />
                                رفع انسداد
                              </>
                            ) : (
                              <>
                                <Ban className="w-3.5 h-3.5" />
                                مسدود کردن
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => {
                              setSelectedUserForAction(u);
                              setActionModalType('tempBan');
                            }}
                            className="px-2.5 py-1.5 bg-[#242f3d] hover:bg-[#2f3d4e] text-gray-200 text-xs rounded-lg transition-colors flex items-center gap-1"
                            title="مسدودیت موقت با تعیین مدت"
                          >
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            مسدود موقت
                          </button>

                          <button
                            onClick={() => {
                              setSelectedUserForAction(u);
                              setActionModalType('password');
                            }}
                            className="px-2.5 py-1.5 bg-[#242f3d] hover:bg-[#2f3d4e] text-gray-200 text-xs rounded-lg transition-colors flex items-center gap-1"
                            title="تغییر رمز عبور کاربر"
                          >
                            <Key className="w-3.5 h-3.5 text-[#5288c1]" />
                            تغییر رمز
                          </button>

                          {u.twoFactorEnabled && (
                            <button
                              onClick={() => handleDisable2FA(u)}
                              className="px-2.5 py-1.5 bg-[#242f3d] hover:bg-[#2f3d4e] text-rose-300 text-xs rounded-lg transition-colors flex items-center gap-1"
                              title="خاموش کردن تأیید دو مرحله‌ای"
                            >
                              <ShieldOff className="w-3.5 h-3.5" />
                              خاموشی 2FA
                            </button>
                          )}

                          <button
                            onClick={() => handleToggleUserRole(u)}
                            className="px-2.5 py-1.5 bg-[#242f3d] hover:bg-[#2f3d4e] text-gray-200 text-xs rounded-lg transition-colors"
                            title="تغییر نقش کاربری"
                          >
                            {u.role === 'admin' ? 'تنزل به کاربر' : 'ارتقا به ادمین'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Channels & Groups */}
        {activeTab === 'chats' && (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col space-y-4">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                value={chatSearchQuery}
                onChange={(e) => setChatSearchQuery(e.target.value)}
                placeholder="جستجوی کانال یا گروه..."
                className="w-full bg-[#0e1621] border border-[#242f3d] rounded-xl px-4 py-2.5 text-white text-xs focus:outline-hidden focus:border-[#5288c1] pr-10"
              />
              <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-3" />
            </div>

            {loadingChats ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-xs">
                در حال بارگذاری گروه‌ها و کانال‌ها...
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="text-center p-8 text-gray-400 text-xs">
                کانال یا گروهی یافت نشد.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredChats.map((c) => (
                  <div
                    key={c.id}
                    className="bg-[#0e1621] border border-[#242f3d] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={c.groupAvatar}
                        alt={c.groupName}
                        className="w-11 h-11 rounded-full object-cover border border-[#242f3d]"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white">{c.groupName}</span>
                          <span className="text-xs text-gray-400">
                            {c.type === 'channel' ? 'کانال' : 'گروه'}
                          </span>
                          {c.isLockedByAdmin && (
                            <span className="bg-rose-500/20 text-rose-300 text-[10px] px-2 py-0.5 rounded-full border border-rose-500/30">
                              قفل شده توسط مدیریت
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">
                          {c.description || 'بدون توضیحات'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleLockChat(c)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 ${
                          c.isLockedByAdmin
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-amber-600 hover:bg-amber-500 text-white'
                        }`}
                      >
                        {c.isLockedByAdmin ? (
                          <>
                            <Unlock className="w-3.5 h-3.5" />
                            بازگشایی ارسال
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            قفل کردن
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleDeleteChatForce(c)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        حذف اجباری
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal: Change Password */}
        {actionModalType === 'password' && selectedUserForAction && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-[#17212b] border border-[#242f3d] rounded-2xl p-6 w-full max-w-sm space-y-4">
              <h3 className="text-sm font-bold text-white">
                تغییر رمز عبور «{selectedUserForAction.displayName}»
              </h3>
              <input
                type="text"
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                placeholder="رمز عبور جدید را وارد کنید..."
                className="w-full bg-[#0e1621] border border-[#242f3d] rounded-xl px-4 py-2.5 text-white text-xs focus:outline-hidden focus:border-[#5288c1]"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetPassword}
                  disabled={!newPasswordInput.trim()}
                  className="flex-1 bg-[#5288c1] hover:bg-[#4375a8] text-white py-2 rounded-xl text-xs font-medium disabled:opacity-50"
                >
                  ثبت رمز جدید
                </button>
                <button
                  onClick={() => {
                    setActionModalType(null);
                    setSelectedUserForAction(null);
                  }}
                  className="px-4 py-2 bg-[#242f3d] text-gray-300 rounded-xl text-xs"
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Temp Ban Duration */}
        {actionModalType === 'tempBan' && selectedUserForAction && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-[#17212b] border border-[#242f3d] rounded-2xl p-6 w-full max-w-sm space-y-4">
              <h3 className="text-sm font-bold text-white">
                مسدودیت موقت «{selectedUserForAction.displayName}»
              </h3>
              <div>
                <label className="block text-xs text-gray-400 mb-2">مدت زمان مسدودیت:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[6, 24, 72].map(hrs => (
                    <button
                      key={hrs}
                      type="button"
                      onClick={() => setTempBanHours(hrs)}
                      className={`py-2 text-xs rounded-xl border transition-colors ${
                        tempBanHours === hrs
                          ? 'bg-[#5288c1] border-[#5288c1] text-white font-semibold'
                          : 'border-[#242f3d] text-gray-300 hover:bg-[#242f3d]'
                      }`}
                    >
                      {hrs} ساعت
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleApplyTempBan}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-2 rounded-xl text-xs font-medium"
                >
                  اعمال مسدودیت
                </button>
                <button
                  onClick={() => {
                    setActionModalType(null);
                    setSelectedUserForAction(null);
                  }}
                  className="px-4 py-2 bg-[#242f3d] text-gray-300 rounded-xl text-xs"
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
