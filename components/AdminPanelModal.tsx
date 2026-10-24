import React, { useState, useEffect, useRef } from 'react';
import { User, Chat, MessageReport, SystemConfig } from '../types';
import { 
  X, Shield, AlertOctagon, Sliders, Users, Flag, MessageSquare, AlertTriangle, 
  Check, Ban, UserCheck, Key, ShieldOff, Trash2, Lock, Unlock, 
  Search, RefreshCw, Clock, Filter, Eye, EyeOff, Power,
  Database, Download, Upload, HardDrive, FileJson, RotateCcw, CheckCircle2,
  Bot, Sparkles, Globe
} from 'lucide-react';
import { getToken } from '../services/auth';
import { 
  collection, getDocs, doc, setDoc, updateDoc, deleteDoc, db,
  getAllDatabaseCollectionsData, restoreAllDatabaseCollectionsData, getRawCollectionStore, clearAllDatabaseData
} from '../services/database';

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
  const [activeTab, setActiveTab] = useState<'system' | 'reports' | 'users' | 'chats' | 'database'>('system');
  // Panic Button Wipe state
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [panicConfirmInput, setPanicConfirmInput] = useState('');
  const [isPanicking, setIsPanicking] = useState(false);
  const [panicError, setPanicError] = useState('');

const handleExecutePanic = async () => {
    if (panicConfirmInput.trim().toUpperCase() !== 'PANIC') {
      setPanicError('لطفاً عبارت PANIC را دقیقاً وارد کنید.');
      return;
    }
    setIsPanicking(true);
    setPanicError('');
    try {
      const token = getToken();
      const res = await fetch('/api/admin/panic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'خطا در اجرای عملیات پنیک');
      }

      clearAllDatabaseData();
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}

      alert('تمامی داده‌ها و پایگاه‌داده با موفقیت نابود و پاکسازی گردید. سیستم ریست فکتوری شد.');
      window.location.href = '/';
    } catch (err: any) {
      setPanicError(err.message || 'خطا در ارتباط با سرور.');
      setIsPanicking(false);
    }
  };


  // System Config state
  const [cfg, setCfg] = useState<SystemConfig>(systemConfig);
  const [isSavingCfg, setIsSavingCfg] = useState(false);

  // Gemini AI & Proxy State
  const [geminiEnabled, setGeminiEnabled] = useState<boolean>(systemConfig.geminiEnabled ?? false);
  const [geminiApiKey, setGeminiApiKey] = useState<string>(systemConfig.geminiApiKey || '');
  const [geminiProxyUrl, setGeminiProxyUrl] = useState<string>(systemConfig.geminiProxyUrl || '');
  const [geminiModel, setGeminiModel] = useState<string>(systemConfig.geminiModel || 'gemini-2.5-flash');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSavingAi, setIsSavingAi] = useState(false);
  const [aiSaveSuccess, setAiSaveSuccess] = useState(false);
  const [serverDbType, setServerDbType] = useState<string>('local');

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

  // ESC Key Handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPanicModal) { setShowPanicModal(false); return; }
        if (actionModalType) { setActionModalType(null); return; }
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showPanicModal, actionModalType, onClose]);

  // Chats state (Groups & Channels)
  const [chatsList, setChatsList] = useState<Chat[]>([]);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [loadingChats, setLoadingChats] = useState(false);

  // Database Tab state
  const [selectedDbCollection, setSelectedDbCollection] = useState<'users' | 'chats' | 'stories' | 'reports' | 'system_config'>('users');
  const [dbCollectionStore, setDbCollectionStore] = useState<Record<string, any>>({});
  const [selectedDbDocId, setSelectedDbDocId] = useState<string | null>(null);
  const [dbSearchQuery, setDbSearchQuery] = useState('');
  const [dbSuccessNotice, setDbSuccessNotice] = useState<string | null>(null);
  const [dbErrorNotice, setDbErrorNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshDbStore = () => {
    const raw = getRawCollectionStore(selectedDbCollection);
    setDbCollectionStore(raw);
    const keys = Object.keys(raw);
    if (keys.length > 0 && (!selectedDbDocId || !raw[selectedDbDocId])) {
      setSelectedDbDocId(keys[0]);
    } else if (keys.length === 0) {
      setSelectedDbDocId(null);
    }
  };

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(d => { if (d.dbType) setServerDbType(d.dbType); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'database') {
      refreshDbStore();
    }
  }, [activeTab, selectedDbCollection]);

  const handleSaveAiSettings = async () => {
    setIsSavingAi(true);
    setAiSaveSuccess(false);
    try {
      await onUpdateSystemConfig({
        geminiEnabled,
        geminiApiKey: geminiApiKey.trim(),
        geminiProxyUrl: geminiProxyUrl.trim(),
        geminiModel
      });
      setAiSaveSuccess(true);
      setTimeout(() => setAiSaveSuccess(false), 3500);
    } catch (e) {
      console.error('Error saving AI settings:', e);
    } finally {
      setIsSavingAi(false);
    }
  };

  const handleTestAiConnection = async () => {
    setIsTestingAi(true);
    setAiTestResult(null);
    try {
      const token = localStorage.getItem('stargram_token');
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          apiKey: geminiApiKey.trim(),
          proxyUrl: geminiProxyUrl.trim(),
          model: geminiModel
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAiTestResult({ success: true, message: data.message || 'اتصال موفقیت‌آمیز بود!' });
      } else {
        setAiTestResult({ success: false, message: data.message || 'خطا در اتصال به سرور جمنای/پروکسی' });
      }
    } catch (e: any) {
      setAiTestResult({ success: false, message: e.message || 'خطای شبکه در تست اتصال' });
    } finally {
      setIsTestingAi(false);
    }
  };

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

  // Database Operations Handlers
  const handleExportFullBackup = () => {
    try {
      const allData = getAllDatabaseCollectionsData();
      const backupPayload = {
        app: 'Starly Messenger',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        timestamp: Date.now(),
        collections: allData
      };
      const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `starly_db_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDbSuccessNotice('فایل پشتیبان کامل دیتابیس با موفقیت دانلود شد.');
      setTimeout(() => setDbSuccessNotice(null), 3000);
    } catch (err) {
      console.error(err);
      setDbErrorNotice('خطا در تهیه فایل پشتیبان.');
      setTimeout(() => setDbErrorNotice(null), 3000);
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const text = loadEvent.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed.collections || typeof parsed.collections !== 'object') {
          throw new Error('فرمت فایل نامعتبر است. شیء collections یافت نشد.');
        }

        if (confirm('آیا از بازگردانی این فایل مطمئن هستید؟ تمامی اطلاعات دیتابیس فعلی با این فایل جایگزین خواهند شد.')) {
          restoreAllDatabaseCollectionsData(parsed.collections);
          refreshDbStore();
          if (onRefreshData) onRefreshData();
          setDbSuccessNotice('پایگاه‌داده با موفقیت از فایل پشتیبان بازگردانی شد.');
          setTimeout(() => setDbSuccessNotice(null), 3500);
        }
      } catch (err: any) {
        console.error('Restore Error:', err);
        setDbErrorNotice(err.message || 'خطا در بارگذاری و پردازش فایل پشتیبان.');
        setTimeout(() => setDbErrorNotice(null), 3500);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteDbDoc = async (docId: string) => {
    if (confirm(`آیا از حذف رکورد «${docId}» از کالکشن «${selectedDbCollection}» مطمئن هستید؟`)) {
      try {
        await deleteDoc(doc(db, selectedDbCollection, docId));
        refreshDbStore();
        if (onRefreshData) onRefreshData();
        setDbSuccessNotice(`رکورد «${docId}» با موفقیت حذف شد.`);
        setTimeout(() => setDbSuccessNotice(null), 3000);
      } catch (err) {
        console.error(err);
        setDbErrorNotice('خطا در حذف رکورد.');
        setTimeout(() => setDbErrorNotice(null), 3000);
      }
    }
  };

  const dbAllData = activeTab === 'database' ? getAllDatabaseCollectionsData() : {};
  const dbTotalDocsCount = Object.values(dbAllData).reduce((acc, col) => acc + Object.keys(col || {}).length, 0);
  const dbEstimatedBytes = JSON.stringify(dbAllData).length;
  const dbEstimatedSizeKb = (dbEstimatedBytes / 1024).toFixed(1);

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
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-4xl bg-[#17212b] text-white rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh] max-h-[850px] border border-[#242f3d]"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
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
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setPanicConfirmInput('');
                setPanicError('');
                setShowPanicModal(true);
              }}
              className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 group"
              title="دکمه پنیک: پاکسازی و انهدام اضطراری کل پایگاه‌داده"
            >
              <AlertOctagon className="w-4 h-4 text-red-400 group-hover:text-white transition-colors" />
              <span>دکمه پنیک (Wipe)</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#242f3d] rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-[#242f3d] bg-[#121b24]">
          <p className="px-5 pt-2 text-[10px] text-gray-500">
            برای دیدن همه بخش‌ها، نوار منو را افقی پیمایش کنید.
          </p>
          <div
            role="group"
            aria-label="بخش‌های پنل مدیریت"
            tabIndex={0}
            className="flex w-full flex-nowrap items-center gap-2 overflow-x-scroll overflow-y-hidden overscroll-x-contain px-4 py-3 touch-pan-x focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5288c1]"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#5288c1 #121b24', WebkitOverflowScrolling: 'touch' }}
          >
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
            <button
              onClick={() => setActiveTab('database')}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
                activeTab === 'database' ? 'bg-[#5288c1] text-white shadow-xs' : 'text-gray-400 hover:text-white hover:bg-[#242f3d]'
              }`}
            >
              <Database className="w-4 h-4 text-emerald-400" />
              مدیریت پایگاه‌داده
            </button>
          </div>
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

            {/* Gemini AI & Proxy Settings Card */}
            <div className="bg-[#0e1621] border border-[#242f3d] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-linear-to-br from-[#5288c1]/20 to-purple-500/20 flex items-center justify-center text-[#5288c1]">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                      دستیار هوش مصنوعی و تنظیمات جمنای (Gemini & Proxy)
                      <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                        کاملاً اختیاری
                      </span>
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      برنامه بدون نیاز به این کلید کار می‌کند. در صورت نیاز به ربات هوش مصنوعی، توکن و پروکسی اختصاصی خود را وارد نمایید.
                    </p>
                  </div>
                </div>

                {/* Enable / Disable Toggle */}
                <button
                  type="button"
                  onClick={() => setGeminiEnabled(!geminiEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    geminiEnabled ? 'bg-purple-500' : 'bg-gray-600'
                  }`}
                  title={geminiEnabled ? 'هوش مصنوعی فعال است' : 'هوش مصنوعی غیرفعال است'}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      geminiEnabled ? 'translate-x-0' : '-translate-x-5'
                    }`}
                  />
                </button>
              </div>

              <div className="space-y-3 pt-2">
                {/* API Key Input */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-[#5288c1]" />
                    کلید اختصاصی Gemini API Key:
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      placeholder="AIzaSy..."
                      dir="ltr"
                      className="w-full bg-[#17212b] border border-[#242f3d] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-hidden focus:border-[#5288c1] font-mono pl-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white transition-colors"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    کلید تنها روی سرور ذخیره می‌شود و در مرورگر کلاینت‌ها لو نمی‌رود.
                  </p>
                </div>

                {/* Proxy URL Input */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-emerald-400" />
                    آدرس پروکسی واسط / Base URL (برای عبور از تحریم یا فیلترینگ):
                  </label>
                  <input
                    type="text"
                    value={geminiProxyUrl}
                    onChange={(e) => setGeminiProxyUrl(e.target.value)}
                    placeholder="https://generativelanguage.googleapis.com یا پروکسی اختصاصی شما"
                    dir="ltr"
                    className="w-full bg-[#17212b] border border-[#242f3d] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-hidden focus:border-[#5288c1] font-mono"
                  />
                  <p className="text-[11px] text-gray-400">
                    اگر در سرور ایران یا محیط محدود هستید، آدرس ریورس پروکسی یا ورکر کلودفلر خود را بگذارید (خالی = پیش‌فرض گوگل).
                  </p>
                </div>

                {/* Model Selector */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    مدل هوش مصنوعی:
                  </label>
                  <select
                    value={geminiModel}
                    onChange={(e) => setGeminiModel(e.target.value)}
                    className="w-full bg-[#17212b] border border-[#242f3d] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-[#5288c1]"
                  >
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (سریع، بهینه و پیشنهادی)</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro (پیشرفته با تحلیل عمیق)</option>
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  </select>
                </div>

                {/* Test Feedback Notice */}
                {aiTestResult && (
                  <div
                    className={`flex items-center gap-2 p-3 rounded-xl text-xs animate-in fade-in duration-200 border ${
                      aiTestResult.success
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {aiTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    )}
                    <span>{aiTestResult.message}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleTestAiConnection}
                    disabled={isTestingAi || !geminiApiKey.trim()}
                    className="px-4 py-2 bg-[#242f3d] hover:bg-[#2f3d4e] disabled:opacity-40 text-gray-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-2"
                  >
                    {isTestingAi ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5 text-[#5288c1]" />}
                    {isTestingAi ? 'در حال تست اتصال…' : 'تست اتصال آنلاین'}
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveAiSettings}
                    disabled={isSavingAi}
                    className="px-5 py-2 bg-[#5288c1] hover:bg-[#4375a8] disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-2 shadow-xs shadow-[#5288c1]/30 active:scale-95"
                  >
                    {isSavingAi ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    {aiSaveSuccess ? 'ذخیره شد!' : 'ذخیره تنظیمات هوش مصنوعی'}
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
                تمام اتصالات سرورهای ثالث قطع بوده، آواتارها با موتور داخلی SVG تولید می‌شوند و داده‌ها در دیتابیس لوکال با کلید‌های ۲۵۶ بیتی Web Crypto ذخیره می‌گردند.
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

        {/* Tab 5: Database Operations & Document Explorer */}
        {activeTab === 'database' && (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col space-y-5">
            {/* Notification Alerts */}
            {dbSuccessNotice && (
              <div className="flex items-center gap-2 p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{dbSuccessNotice}</span>
              </div>
            )}
            {dbErrorNotice && (
              <div className="flex items-center gap-2 p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs animate-in fade-in duration-200">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{dbErrorNotice}</span>
              </div>
            )}

            
            {/* Panic Wipe Danger Zone */}
            <div className="bg-red-500/10 border-2 border-red-500/30 rounded-2xl p-4.5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center shrink-0">
                  <AlertOctagon size={22} className="animate-pulse" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-red-300">عملیات اضطراری: دکمه پنیک (System Panic & Wipe)</h4>
                    <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full font-bold">بحرانی</span>
                  </div>
                  <p className="text-xs text-red-300/80 leading-relaxed mt-0.5">
                    با فشردن این دکمه و تأیید نهایی، تمامی پایگاه‌داده (شامل کل گفتگوها، پیام‌ها، کاربران، فایل‌ها، گزارش‌ها و نشست‌ها) بدون امکان بازگشت نابود و پاکسازی کامل می‌شوند.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setPanicConfirmInput('');
                  setPanicError('');
                  setShowPanicModal(true);
                }}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-98 flex items-center justify-center gap-2"
              >
                <AlertOctagon size={16}/> اجرای عملیات پنیک و نابودی کل دیتابیس
              </button>
            </div>

            {/* Active Database Engine Badge */}
            <div className="flex items-center justify-between p-3.5 bg-[#0e1621] border border-[#242f3d] rounded-xl text-xs">
              <div className="flex items-center gap-2.5">
                <div className={`w-2.5 h-2.5 rounded-full ${serverDbType === 'postgres' ? 'bg-sky-400' : serverDbType === 'mysql' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                <span className="text-gray-400 font-medium">موتور فعال پایگاه‌داده:</span>
                <span className="font-bold text-white font-mono uppercase tracking-wide">
                  {serverDbType === 'postgres' ? 'PostgreSQL (pg)' : serverDbType === 'mysql' ? 'MySQL / MariaDB' : 'Local Storage Engine (JSON)'}
                </span>
              </div>
              <span className="text-[11px] text-gray-400">
                پشتیبانی کامل از هر دو پایگاه داده رابطه‌ای (Dual-SQL) و حافظه محلی
              </span>
            </div>

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#0e1621] border border-[#242f3d] p-3.5 rounded-xl">
                <div className="flex items-center justify-between text-gray-400 mb-1">
                  <span className="text-[11px] font-medium">کل رکوردهای دیتابیس</span>
                  <Database className="w-4 h-4 text-[#5288c1]" />
                </div>
                <p className="text-xl font-bold text-white tabular-nums">{dbTotalDocsCount}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">در ۵ کالکشن اصلی</p>
              </div>

              <div className="bg-[#0e1621] border border-[#242f3d] p-3.5 rounded-xl">
                <div className="flex items-center justify-between text-gray-400 mb-1">
                  <span className="text-[11px] font-medium">حجم تخمینی داده‌ها</span>
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-xl font-bold text-emerald-300 tabular-nums" dir="ltr">{dbEstimatedSizeKb} KB</p>
                <p className="text-[10px] text-gray-400 mt-0.5">کامپکت و بهینه‌سازی شده</p>
              </div>

              <div className="bg-[#0e1621] border border-[#242f3d] p-3.5 rounded-xl">
                <div className="flex items-center justify-between text-gray-400 mb-1">
                  <span className="text-[11px] font-medium">تعداد کل گفتگوها</span>
                  <MessageSquare className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-xl font-bold text-white tabular-nums">
                  {Object.keys(dbAllData.chats || {}).length}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">خصوصی، گروه‌ها و کانال‌ها</p>
              </div>

              <div className="bg-[#0e1621] border border-[#242f3d] p-3.5 rounded-xl">
                <div className="flex items-center justify-between text-gray-400 mb-1">
                  <span className="text-[11px] font-medium">کاربران ثبت‌شده</span>
                  <Users className="w-4 h-4 text-purple-400" />
                </div>
                <p className="text-xl font-bold text-white tabular-nums">
                  {Object.keys(dbAllData.users || {}).length}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">با دسترسی مجاز و مسدود</p>
              </div>
            </div>

            {/* Quick Operations Toolbar */}
            <div className="bg-[#0e1621] border border-[#242f3d] p-4 rounded-2xl space-y-3">
              <h3 className="text-xs font-bold text-gray-200 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#5288c1]" />
                عملیات جامع پایگاه داده (Backup & Restore)
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                می‌توانید تمامی جداول و اطلاعات سیستم را به عنوان یک فایل پشتیبان استاندارد JSON دانلود کرده یا فایل قبلی را بازگردانی نمایید.
              </p>

              <div className="flex items-center gap-3 pt-1 flex-wrap">
                <button
                  onClick={handleExportFullBackup}
                  className="px-4 py-2.5 bg-[#5288c1] hover:bg-[#4375a8] text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-2 shadow-sm shadow-[#5288c1]/30 active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  دانلود نسخه پشتیبان کامل (JSON Backup)
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 bg-[#242f3d] hover:bg-[#2e3c4e] text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 active:scale-95"
                >
                  <Upload className="w-4 h-4" />
                  بازگردانی دیتابیس از فایل JSON
                </button>

                <button
                  onClick={refreshDbStore}
                  className="px-3.5 py-2.5 bg-[#17212b] hover:bg-[#242f3d] text-gray-300 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 mr-auto"
                  title="تازه‌سازی محتویات"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  بروزرسانی زنده
                </button>

                {/* Hidden File Input for Restore */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleImportBackup}
                />
              </div>
            </div>

            {/* Collection Document Explorer */}
            <div className="bg-[#0e1621] border border-[#242f3d] rounded-2xl overflow-hidden flex flex-col flex-1 min-h-[350px]">
              <div className="p-3.5 border-b border-[#242f3d] flex items-center justify-between flex-wrap gap-2 bg-[#121b24]">
                <div className="flex items-center gap-2">
                  <FileJson className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">مرورگر اسناد و داده‌های خام کالکشن‌ها</span>
                </div>

                {/* Collection Switcher Tabs */}
                <div className="flex items-center gap-1 bg-[#17212b] p-1 rounded-xl border border-[#242f3d]">
                  {[
                    { id: 'users', label: 'کاربران' },
                    { id: 'chats', label: 'چت‌ها' },
                    { id: 'stories', label: 'استوری‌ها' },
                    { id: 'reports', label: 'گزارش‌ها' },
                    { id: 'system_config', label: 'پیکربندی' }
                  ].map(c => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedDbCollection(c.id as any);
                        setSelectedDbDocId(null);
                      }}
                      className={`px-3 py-1 text-xs rounded-lg transition-colors font-medium ${
                        selectedDbCollection === c.id
                          ? 'bg-[#5288c1] text-white shadow-xs'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {c.label} ({Object.keys(dbAllData[c.id] || {}).length})
                    </button>
                  ))}
                </div>
              </div>

              {/* Explorer Split View */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-[300px]">
                {/* Doc Keys List (Right Pane in RTL) */}
                <div className="md:col-span-5 border-l border-[#242f3d] p-3 flex flex-col space-y-2 bg-[#17212b]/40">
                  <div className="relative">
                    <input
                      type="text"
                      value={dbSearchQuery}
                      onChange={(e) => setDbSearchQuery(e.target.value)}
                      placeholder="جستجوی شناسه سند (ID)..."
                      className="w-full bg-[#0e1621] border border-[#242f3d] rounded-xl px-3 py-1.5 text-white text-xs focus:outline-hidden focus:border-[#5288c1] pr-8"
                    />
                    <Search className="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-2.5" />
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1 max-h-[320px] custom-scrollbar">
                    {Object.keys(dbCollectionStore)
                      .filter(k => !dbSearchQuery || k.toLowerCase().includes(dbSearchQuery.toLowerCase()))
                      .map(docKey => {
                        const isSelected = selectedDbDocId === docKey;
                        return (
                          <div
                            key={docKey}
                            onClick={() => setSelectedDbDocId(docKey)}
                            className={`p-2.5 rounded-xl cursor-pointer transition-colors flex items-center justify-between text-xs ${
                              isSelected
                                ? 'bg-[#5288c1] text-white font-semibold shadow-xs'
                                : 'bg-[#0e1621] hover:bg-[#242f3d] text-gray-300'
                            }`}
                          >
                            <span className="truncate max-w-[200px]" dir="ltr">#{docKey}</span>
                            <span className="text-[10px] opacity-70">
                              {Object.keys(dbCollectionStore[docKey] || {}).length} فیلد
                            </span>
                          </div>
                        );
                      })}

                    {Object.keys(dbCollectionStore).length === 0 && (
                      <div className="text-center text-gray-500 py-8 text-xs">
                        هیچ سندی در این کالکشن ثبت نشده است.
                      </div>
                    )}
                  </div>
                </div>

                {/* Doc Content Viewer (Left Pane in RTL) */}
                <div className="md:col-span-7 p-4 flex flex-col space-y-2 bg-[#0e1621]">
                  {selectedDbDocId && dbCollectionStore[selectedDbDocId] ? (
                    <>
                      <div className="flex items-center justify-between pb-2 border-b border-[#242f3d]">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">سند انتخاب شده:</span>
                          <span className="text-xs font-mono font-bold text-white bg-[#17212b] px-2 py-0.5 rounded-md border border-[#242f3d]" dir="ltr">
                            {selectedDbDocId}
                          </span>
                        </div>

                        <button
                          onClick={() => handleDeleteDbDoc(selectedDbDocId)}
                          className="px-2.5 py-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                          title="حذف این سند از دیتابیس"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          حذف رکورد
                        </button>
                      </div>

                      <pre 
                        className="flex-1 p-3.5 bg-[#121b24] border border-[#242f3d] rounded-xl text-xs font-mono text-emerald-300 overflow-x-auto max-h-[300px] custom-scrollbar select-text leading-relaxed" 
                        dir="ltr"
                      >
                        {JSON.stringify(dbCollectionStore[selectedDbDocId], null, 2)}
                      </pre>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-500 space-y-2">
                      <FileJson className="w-10 h-10 text-gray-600" />
                      <p className="text-xs">سندی را از لیست سمت راست برای مشاهده انتخاب نمایید.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
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
      
      {/* Panic Confirmation Dialog */}
      {showPanicModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in zoom-in-95">
          <div className="bg-[#17212b] border-2 border-red-500/50 w-full max-w-md rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 border-2 border-red-500/40 text-red-400 mx-auto flex items-center justify-center animate-bounce">
              <AlertOctagon size={36} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-white font-bold text-lg">⚠️ هشدار اضطراری: دکمه پنیک (Panic Wipe)</h3>
              <p className="text-xs text-red-300/90 leading-relaxed">
                شما در حال پاکسازی کامل کل پایگاه‌داده سیستم هستید! تمامی کاربران، گفتگوها، پیام‌ها، گزارش‌ها و فایل‌ها بلافاصله و برای همیشه حذف خواهند شد و این عملیات قابل بازگشت نیست.
              </p>
            </div>

            <div className="bg-[#242f3d] p-3.5 rounded-2xl border border-white/5 text-right space-y-2">
              <label className="text-xs text-gray-300 block font-medium">
                جهت تایید قطعی، عبارت انگلیسی <span className="font-mono text-red-400 font-bold bg-black/40 px-2 py-0.5 rounded">PANIC</span> را با حروف بزرگ وارد نمایید:
              </label>
              <input
                type="text"
                dir="ltr"
                placeholder="PANIC"
                value={panicConfirmInput}
                onChange={(e) => setPanicConfirmInput(e.target.value)}
                className="w-full bg-[#17212b] border border-red-500/40 rounded-xl px-4 py-2.5 text-center text-red-300 text-sm font-mono tracking-widest uppercase focus:border-red-500 outline-none"
              />
            </div>

            {panicError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-xl">
                {panicError}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowPanicModal(false)}
                disabled={isPanicking}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-bold transition-colors"
              >
                انصراف
              </button>
              <button
                onClick={handleExecutePanic}
                disabled={panicConfirmInput.trim().toUpperCase() !== 'PANIC' || isPanicking}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2"
              >
                {isPanicking ? <RefreshCw size={15} className="animate-spin" /> : <AlertOctagon size={15} />}
                <span>تأیید و انهدام کامل سیستم</span>
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
};
