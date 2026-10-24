import React, { useState, useEffect, useRef } from 'react';
import { User, DEFAULT_AVATAR } from '../types';
import { 
  X, Shield, ShieldCheck, Key, Check, Smartphone, Camera, LogOut, ChevronLeft, ChevronRight, Eye, Clock, 
  Monitor, ArrowRight, Copy, QrCode, RotateCcw, Palette, Upload,
  Sparkles, Volume2, Bell, CheckCircle2, Image as ImageIcon, Trash2, AlertTriangle,
  HardDrive, Database, Send as SendIcon, CheckSquare, RefreshCw, MessageSquare
} from 'lucide-react';

import { compressImage } from '../services/imageUtils';
import { WALLPAPER_PRESETS, resolveWallpaperStyle } from '../services/wallpaperPresets';
import { playNotificationSound, requestNotificationPermission, isNotificationGranted } from '../services/notificationService';
import { authApi } from '../services/auth';
import { applyAppearancePreferences, PREFERENCE_KEYS, readBooleanPreference, readPreference, writePreference } from '../services/appPreferences';

interface SettingsModalProps {
  user: User;
  onClose: () => void;
  onUpdateUser: (updated: User) => void;
  onDeleteAccount?: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ user, onClose, onUpdateUser, onDeleteAccount }) => {
  const [tab, setTab] = useState<'security' | 'appearance' | 'notifications' | 'storage' | 'chats'>('security');
  const [showPrivacyGuide, setShowPrivacyGuide] = useState(false);
  
  // Advanced Security & Passcode Overlays
  const [showPasscodeSetup, setShowPasscodeSetup] = useState(false);
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');

  // 2FA Wizard State
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [twoFAStep, setTwoFAStep] = useState<1 | 2 | 3>(1);
  const [temp2FASecret, setTemp2FASecret] = useState('');
  const [twoFACodeInput, setTwoFACodeInput] = useState('');
  const [twoFAError, setTwoFAError] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Delete Account Confirmation Modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Appearance & Wallpaper
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState('');
  const wallpaperFileInputRef = useRef<HTMLInputElement>(null);
  const [fontSize, setFontSize] = useState<string>(() => readPreference(PREFERENCE_KEYS.fontSize, '15px'));
  const [bubbleRoundness, setBubbleRoundness] = useState<string>(() => readPreference(PREFERENCE_KEYS.bubbleRoundness, '1rem'));

  // Notifications & Sound
  const [notifGranted, setNotifGranted] = useState(isNotificationGranted());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => readBooleanPreference(PREFERENCE_KEYS.soundEnabled));
  const [previewTextEnabled, setPreviewTextEnabled] = useState<boolean>(() => readBooleanPreference(PREFERENCE_KEYS.previewTextEnabled));

  // Storage & Cache
  const [cacheSize, setCacheSize] = useState<string>('۴.۲ مگابایت');
  const [cacheCleared, setCacheCleared] = useState(false);
  const [autoDownloadPhotos, setAutoDownloadPhotos] = useState<boolean>(() => readBooleanPreference(PREFERENCE_KEYS.autoDownloadPhotos));
  const [autoDownloadVoice, setAutoDownloadVoice] = useState<boolean>(() => readBooleanPreference(PREFERENCE_KEYS.autoDownloadVoice));

  // Chat preferences
  const [sendOnEnter, setSendOnEnter] = useState<boolean>(() => readBooleanPreference(PREFERENCE_KEYS.sendOnEnter));
  const [autoScroll, setAutoScroll] = useState<boolean>(() => readBooleanPreference(PREFERENCE_KEYS.autoScroll));

  // Device & OS detection
  const [sessionInfo, setSessionInfo] = useState({ browser: 'Unknown', os: 'Unknown' });

  useEffect(() => {
    const ua = navigator.userAgent;
    let b = 'مرورگر وب';
    let o = 'سیستم‌عامل';
    if (ua.includes('Chrome')) b = 'گوگل کروم';
    else if (ua.includes('Safari')) b = 'سافاری';
    else if (ua.includes('Firefox')) b = 'فایرفاکس';
    else if (ua.includes('Edge')) b = 'مایکروسافت اج';

    if (ua.includes('Windows')) o = 'ویندوز';
    else if (ua.includes('Android')) o = 'اندروید';
    else if (ua.includes('iPhone') || ua.includes('iPad')) o = 'iOS (آیفون)';
    else if (ua.includes('Mac')) o = 'macOS';
    else if (ua.includes('Linux')) o = 'لینوکس';

    setSessionInfo({ browser: b, os: o });

    void refreshCacheSize();
  }, []);

  const refreshCacheSize = async () => {
    try {
      let totalBytes = 0;
      for (const key of Object.keys(localStorage)) totalBytes += (key.length + (localStorage.getItem(key)?.length || 0)) * 2;
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          const cache = await caches.open(cacheName);
          const entries = await cache.keys();
          for (const request of entries) {
            const response = await cache.match(request);
            if (response) totalBytes += (await response.clone().blob()).size;
          }
        }
      }
      const mb = (totalBytes / (1024 * 1024)).toFixed(1);
      setCacheSize(`${mb} مگابایت`);
    } catch {
      setCacheSize('نامشخص');
    }
  };

  // ESC key handler for SettingsModal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPrivacyGuide) { setShowPrivacyGuide(false); return; }
        if (showDeleteConfirm) { setShowDeleteConfirm(false); return; }
        if (showPasscodeSetup) { setShowPasscodeSetup(false); return; }
        if (show2FASetup) { setShow2FASetup(false); return; }
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showPrivacyGuide, showDeleteConfirm, showPasscodeSetup, show2FASetup, onClose]);

  const togglePrivacy = (key: 'showStatus' | 'showAvatar') => {
    const current = user.privacy[key];
    const order: Array<'all' | 'contacts' | 'none'> = ['all', 'contacts', 'none'];
    const next = order[(order.indexOf(current) + 1) % order.length];
    const updated = {
      ...user,
      privacy: { ...user.privacy, [key]: next }
    };
    onUpdateUser(updated);
  };

  const handleClearCache = async () => {
    try {
      const savedTheme = localStorage.getItem('starly_theme') || user.theme;
      const savedToken = localStorage.getItem('starly_token');
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('cached_') || key.startsWith('draft_')) {
          localStorage.removeItem(key);
        }
      });
      if (savedToken) localStorage.setItem('starly_token', savedToken);
      if (savedTheme) localStorage.setItem('starly_theme', savedTheme);
      if ('caches' in window) {
        await Promise.all((await caches.keys()).map(cacheName => caches.delete(cacheName)));
      }
      await refreshCacheSize();
      setCacheCleared(true);
      setTimeout(() => setCacheCleared(false), 3000);
    } catch (e) {
      console.warn('Clear cache error:', e);
    }
  };

  const handleTestSound = () => {
    playNotificationSound();
  };

  const handleToggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    writePreference(PREFERENCE_KEYS.soundEnabled, enabled ? 'true' : 'false');
  };

  const handleTogglePreview = (enabled: boolean) => {
    setPreviewTextEnabled(enabled);
    writePreference(PREFERENCE_KEYS.previewTextEnabled, enabled ? 'true' : 'false');
  };

  const handleRequestPushNotif = async () => {
    const granted = await requestNotificationPermission();
    setNotifGranted(granted === 'granted');
    if (granted) {
      playNotificationSound();
    }
  };

  // Passcode setup
  const startPasscodeSetup = () => {
    setNewPasscode('');
    setConfirmPasscode('');
    setPasscodeError('');
    setShowPasscodeSetup(true);
  };

  const handleSavePasscode = () => {
    if (newPasscode.length !== 4 || !/^\d{4}$/.test(newPasscode)) {
      setPasscodeError('رمز عبور باید ۴ رقم عددی باشد.');
      return;
    }
    if (newPasscode !== confirmPasscode) {
      setPasscodeError('تکرار رمز عبور مطابقت ندارد.');
      return;
    }
    onUpdateUser({ ...user, passcode: newPasscode });
    setShowPasscodeSetup(false);
  };

  const handleDisablePasscode = () => {
    const { passcode, ...rest } = user;
    onUpdateUser(rest as User);
    setShowPasscodeSetup(false);
  };

  // 2FA Flow
  const start2FASetup = () => {
    if (user.twoFactorEnabled) {
      onUpdateUser({ ...user, twoFactorEnabled: false, twoFactorSecret: undefined });
      return;
    }
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let sec = '';
    for (let i = 0; i < 16; i++) {
      sec += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTemp2FASecret(sec);
    setTwoFACodeInput('');
    setTwoFAError('');
    setTwoFAStep(1);
    setShow2FASetup(true);
  };

  const handleVerify2FACode = () => {
    if (twoFACodeInput.length !== 6 || !/^\d{6}$/.test(twoFACodeInput)) {
      setTwoFAError('لطفاً کد ۶ رقمی را به درستی وارد کنید.');
      return;
    }
    onUpdateUser({
      ...user,
      twoFactorEnabled: true,
      twoFactorSecret: temp2FASecret
    });
    setTwoFAStep(3);
  };

  // Delete Account Confirmation Execution
  const handleExecuteDeleteAccount = async () => {
    if (deleteConfirmText.trim().toLowerCase() !== user.username.trim().toLowerCase()) {
      return;
    }
    setIsDeleting(true);
    try {
      if (onDeleteAccount) {
        await onDeleteAccount();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#17212b] border border-white/10 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        

        {showPrivacyGuide ? (
          <>
            {/* Privacy & Security Guide Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#1e2c3a]/70">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowPrivacyGuide(false)}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#3390ec] hover:text-[#52a5f5] px-2.5 py-1.5 rounded-xl hover:bg-white/5 transition-all active:scale-95"
                >
                  <ChevronRight size={18} />
                  <span>بازگشت به تنظیمات</span>
                </button>
                <div className="h-4 w-px bg-white/10 mx-1" />
                <span className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ShieldCheck size={16} />
                </span>
                <h3 className="font-bold text-white text-sm">حریم خصوصی و معماری امنیت استارلی</h3>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/5 text-[#708499] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Privacy Guide Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-6">
              {/* Hero Banner */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-[#17212b] to-[#1e2c3a] border border-emerald-500/30 text-right space-y-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                    <ShieldCheck size={28} />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">معماری امنیت و حریم خصوصی در پیام‌رسان استارلی</h4>
                    <p className="text-xs text-emerald-300/80 font-medium mt-0.5">اصول حفاظت، رمزنگاری سرتاسری و تعهد عدم دسترسی به داده‌ها</p>
                  </div>
                </div>
                <p className="text-xs text-[#708499] leading-relaxed">
                  پیام‌رسان استارلی بر مبنای محرمانگی محض طراحی شده است. هیچ شخص سومی، نه ارائه‌دهندگان اینترنت، نه دولت‌ها و نه حتی سرورها و توسعه‌دهندگان برنامه، امکان مشاهده، شنود یا تحلیل پیام‌ها و فایل‌های شخصی شما را ندارند.
                </p>
              </div>

              {/* Security Pillars Badges */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-[#242f3d]/80 rounded-2xl border border-white/5 space-y-1">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <ShieldCheck size={16} />
                    <span className="text-xs font-bold text-white">رمزنگاری AES-256-GCM</span>
                  </div>
                  <p className="text-[11px] text-[#708499] leading-relaxed">رمزگذاری مستقل روی دستگاه مبدا با کلیدهای اختصاصی Web Crypto API</p>
                </div>

                <div className="p-3 bg-[#242f3d]/80 rounded-2xl border border-white/5 space-y-1">
                  <div className="flex items-center gap-2 text-[#3390ec]">
                    <Database size={16} />
                    <span className="text-xs font-bold text-white">معماری دانش‌صفر</span>
                  </div>
                  <p className="text-[11px] text-[#708499] leading-relaxed">عدم ذخیره کلیدهای خصوصی در دیتابیس؛ سرور صرفاً رله بسته‌های داده است</p>
                </div>

                <div className="p-3 bg-[#242f3d]/80 rounded-2xl border border-white/5 space-y-1">
                  <div className="flex items-center gap-2 text-purple-400">
                    <Eye size={16} />
                    <span className="text-xs font-bold text-white">بدون شماره تماس</span>
                  </div>
                  <p className="text-[11px] text-[#708499] leading-relaxed">شناسایی انحصاری با نام کاربری (@username) بدون افشای شماره تلفن شخصی</p>
                </div>

                <div className="p-3 bg-[#242f3d]/80 rounded-2xl border border-white/5 space-y-1">
                  <div className="flex items-center gap-2 text-amber-400">
                    <Smartphone size={16} />
                    <span className="text-xs font-bold text-white">امنیت لایه انتقال TLS</span>
                  </div>
                  <p className="text-[11px] text-[#708499] leading-relaxed">اتصال کاملاً امن تحت وب‌سوکت رمزگذاری‌شده بدون امکان نفوذ یا شنود</p>
                </div>
              </div>

              {/* Encryption Flow Diagram */}
              <div className="p-4 rounded-2xl bg-[#242f3d]/50 border border-white/5 space-y-3">
                <h5 className="font-bold text-xs text-[#3390ec] flex items-center gap-2">
                  <Sparkles size={14} />
                  <span>چرخه انتقال پیام در سیستم امنیتی</span>
                </h5>
                <div className="bg-[#17212b] p-3 rounded-xl border border-white/5 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[#708499] text-[11px]">
                    <span className="text-emerald-400 font-bold">۱. دستگاه شما (فرستنده)</span>
                    <span>رمزگذاری با کلید ۲۵۶ بیتی بومی مرورگر</span>
                  </div>
                  <div className="w-full h-px bg-white/5" />
                  <div className="flex items-center justify-between text-[#708499] text-[11px]">
                    <span className="text-[#3390ec] font-bold">۲. کانال انتقال ایمن</span>
                    <span>انتقال بسته رمزشده نامفهوم روی شبکه TLS/WSS</span>
                  </div>
                  <div className="w-full h-px bg-white/5" />
                  <div className="flex items-center justify-between text-[#708499] text-[11px]">
                    <span className="text-amber-400 font-bold">۳. سرور استارلی</span>
                    <span>تنها رله بسته؛ بدون دسترسی به متن یا کلید</span>
                  </div>
                  <div className="w-full h-px bg-white/5" />
                  <div className="flex items-center justify-between text-[#708499] text-[11px]">
                    <span className="text-emerald-400 font-bold">۴. دستگاه مقصد (گیرنده)</span>
                    <span>رمزگشایی انحصاری با کلید تاییدشده و نمایش متن</span>
                  </div>
                </div>
              </div>

              {/* Detailed Technical Principles */}
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#242f3d]/60 border border-white/5 space-y-2">
                  <h5 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>۱. رمزنگاری سرتاسری پیشرفته (End-to-End Encryption)</span>
                  </h5>
                  <p className="text-xs text-[#708499] leading-relaxed">
                    تمام پیام‌های متنی، تصاویر و فایل‌های چندرسانه‌ای پیش از آنکه دستگاه شما را ترک کنند، با استفاده از پروتکل استاندارد رمزنگاری متقارن AES-256-GCM کدگذاری می‌شوند. این فرآیند مستقیماً درون مرورگر شما از طریق موتور امنیتی Web Crypto API اجرا می‌شود و هیچ کلید متقارنی به هیچ سروری فرستاده نمی‌شود.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#242f3d]/60 border border-white/5 space-y-2">
                  <h5 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#3390ec]" />
                    <span>۲. معماری دانش‌صفر (Zero-Knowledge Architecture)</span>
                  </h5>
                  <p className="text-xs text-[#708499] leading-relaxed">
                    سرورهای پیام‌رسان استارلی با اصل دانش‌صفر پیکربندی شده‌اند؛ به این معنا که سرور هیچ درکی از محتوای پیام‌های در حال گردش ندارد و صرفاً به عنوان توزیع‌کننده بسته‌های مبهم عمل می‌کند. حتی اگر سرور مورد حمله یا بازرسی قرار گیرد، هیچ داده خوانایی در پایگاه‌داده وجود ندارد.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#242f3d]/60 border border-white/5 space-y-2">
                  <h5 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    <span>۳. حریم خصوصی شناسه و هویت کاربری</span>
                  </h5>
                  <p className="text-xs text-[#708499] leading-relaxed">
                    در استارلی نیازی به اشتراک‌گذاری یا فاش شدن شماره تلفن خصوصی شما نیست. تعاملات کاربری منحصراً بر پایه شناسه‌های کاربری انتخابی (@username) برقرار می‌شود و افراد غریبه به هیچ عنوان نمی‌توانند شماره تلفن یا موقعیت جغرافیایی شما را به دست آورند.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#242f3d]/60 border border-white/5 space-y-2">
                  <h5 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>۴. کنترل‌های مستقیم حریم خصوصی در دستان کاربر</span>
                  </h5>
                  <ul className="text-xs text-[#708499] space-y-1.5 list-disc list-inside leading-relaxed">
                    <li><strong className="text-white">وضعیت آنلاین و زمان حضور:</strong> کنترل دقیق اینکه چه کسانی می‌توانند حضور شما را ببینند (همه، فقط مخاطبین یا هیچ‌کس).</li>
                    <li><strong className="text-white">نمایش عکس پروفایل:</strong> پنهان‌سازی یا نمایش انحصاری عکس برای مخاطبان مورد اعتماد.</li>
                    <li><strong className="text-white">حذف دوطرفه پیام‌ها:</strong> حذف فوری هر پیام برای همه شرکت‌کنندگان گفتگو بدون باقی ماندن هیچ ردپایی.</li>
                    <li><strong className="text-white">پاکسازی تاریخچه گفتگو:</strong> حذف کامل تمام پیام‌های یک گفتگو با یک کلیک.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-[#242f3d]/60 border border-white/5 space-y-2">
                  <h5 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span>۵. احراز هویت دومرحله‌ای و امنیت نشست‌ها</span>
                  </h5>
                  <p className="text-xs text-[#708499] leading-relaxed">
                    با فعال‌سازی تایید دومرحله‌ای بر پایه پروتکل استاندارد جهانی TOTP، علاوه بر رمز عبور، برای ورود به حساب نیاز به کد پویا از برنامه‌های احراز هویت نظیر Google Authenticator خواهید داشت. همچنین نشست‌های فعال تحت نظر شما هستند و می‌توانید دسترسی سایر دستگاه‌ها را قطع نمایید.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#242f3d]/60 border border-white/5 space-y-2">
                  <h5 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    <span>۶. ضمانت عدم ردیابی و حق فراموش‌شدن دائم</span>
                  </h5>
                  <p className="text-xs text-[#708499] leading-relaxed">
                    استارلی فاقد هرگونه ابزار ردیابی تجاری، کوکی تبلیغاتی یا ماژول‌های تحلیل رفتار کاربر است. همچنین گزینه «حذف دائمی حساب کاربری» در بخش تنظیمات در دسترس است که کلیه سوابق، فایل‌ها و پیام‌های شما را بدون امکان بازیابی از پایگاه داده پاکسازی می‌کند.
                  </p>
                </div>
              </div>

              {/* Close / Return Button */}
              <div className="pt-2">
                <button
                  onClick={() => setShowPrivacyGuide(false)}
                  className="w-full py-3 bg-[#3390ec] hover:bg-[#2b7bc4] text-white rounded-2xl text-xs font-bold transition-all shadow-md active:scale-98 flex items-center justify-center gap-2"
                >
                  <Check size={16} />
                  <span>متوجه شدم، بازگشت به تنظیمات</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#1e2c3a]/50">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-[#3390ec]/20 flex items-center justify-center text-[#3390ec]">
              {tab === 'security' && <Shield size={18}/>}
              {tab === 'appearance' && <Palette size={18}/>}
              {tab === 'notifications' && <Bell size={18}/>}
              {tab === 'storage' && <HardDrive size={18}/>}
              {tab === 'chats' && <MessageSquare size={18}/>}
            </span>
            <h3 className="font-bold text-white text-base">تنظیمات پیام‌رسان</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/5 text-[#708499] hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs (Profile tab completely removed; dedicate to real settings) */}
        <div className="flex border-b border-white/5 bg-[#17212b] px-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'security', label: 'حریم خصوصی و امنیت', icon: <ShieldCheck size={15}/> },
            { id: 'appearance', label: 'ظاهر و گفتگوها', icon: <Palette size={15}/> },
            { id: 'notifications', label: 'اعلان‌ها و صداها', icon: <Bell size={15}/> },
            { id: 'storage', label: 'داده‌ها و حافظه', icon: <HardDrive size={15}/> },
            { id: 'chats', label: 'پیام‌رسانی', icon: <MessageSquare size={15}/> },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex-1 min-w-[100px] py-3.5 px-2 text-xs font-bold transition-all relative flex items-center justify-center gap-1.5 whitespace-nowrap ${
                tab === t.id ? 'text-[#3390ec]' : 'text-[#708499] hover:text-white'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
              {tab === t.id && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#3390ec] rounded-t-full"/>
              )}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-6">
          
          {/* 1. Security & Privacy Tab */}
          {tab === 'security' && (
            <div className="space-y-6 animate-in slide-in-from-left duration-200">
               {/* Comprehensive Privacy & Security Architecture Card */}
               <div 
                 onClick={() => setShowPrivacyGuide(true)}
                 className="p-4 rounded-2xl bg-gradient-to-l from-emerald-500/15 via-[#17212b] to-[#242f3d] border border-emerald-500/30 hover:border-emerald-500/60 cursor-pointer transition-all flex items-center justify-between group shadow-lg"
               >
                 <div className="flex items-center gap-3.5">
                   <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
                     <ShieldCheck size={22} />
                   </div>
                   <div>
                     <div className="flex items-center gap-2">
                       <h5 className="font-bold text-white text-sm">حریم خصوصی و معماری امنیت استارلی</h5>
                       <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">توضیحات کامل</span>
                     </div>
                     <p className="text-[11px] text-[#708499] mt-0.5">مطالعه جزییات کامل رمزنگاری سرتاسری ۲۵۶ بیتی، معماری دانش‌صفر و حفاظت از داده‌ها</p>
                   </div>
                 </div>
                 <ChevronLeft size={18} className="text-[#708499] group-hover:-translate-x-1 group-hover:text-white transition-all shrink-0" />
               </div>

               
               {/* Active Session Card */}
               <section className="space-y-2">
                  <h4 className="text-[#3390ec] font-bold text-xs uppercase tracking-widest px-1">نشست‌ها و دستگاه جاری</h4>
                  <div className="bg-[#242f3d] rounded-2xl overflow-hidden border border-white/5">
                     <div className="p-4 border-b border-white/5 flex items-center gap-3.5">
                        <div className="w-10 h-10 bg-[#3390ec]/20 border border-[#3390ec]/30 rounded-xl flex items-center justify-center text-[#3390ec]">
                          <Smartphone size={20}/>
                        </div>
                        <div className="flex-1">
                           <div className="flex items-center gap-2">
                             <h5 className="font-bold text-white text-sm">دستگاه فعلی شما</h5>
                             <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>
                           </div>
                           <p className="text-[11px] text-[#708499] mt-0.5">{sessionInfo.browser} روی {sessionInfo.os} • نشست امن</p>
                        </div>
                     </div>
                     <div className="w-full p-2.5 text-center text-[#708499] text-xs font-medium bg-[#17212b]/60">
                       سایر دستگاه‌ها یا نشست‌های منقضی شده وجود ندارند.
                     </div>
                  </div>
               </section>

               {/* Privacy Controls */}
               <section className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-[#3390ec] font-bold text-xs uppercase tracking-widest">حریم خصوصی</h4>
                    <button 
                      onClick={() => setShowPrivacyGuide(true)} 
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition-colors"
                    >
                      <ShieldCheck size={13} />
                      <span>توضیحات کامل امنیت</span>
                    </button>
                  </div>
                  <SecurityItem 
                    icon={<ShieldCheck size={18}/>} 
                    label="توضیحات جامع حریم خصوصی و امنیت پیام‌رسان" 
                    extra="مشاهده توضیحات" 
                    onClick={() => setShowPrivacyGuide(true)}
                  />
                  <SecurityItem 
                    icon={<Clock size={18}/>} 
                    label="آخرین زمان حضور و وضعیت آنلاین" 
                    extra={user.privacy.showStatus === 'all' ? 'همه کاربران' : (user.privacy.showStatus === 'contacts' ? 'فقط مخاطبین من' : 'هیچ‌کس')} 
                    onClick={() => togglePrivacy('showStatus')}
                  />
                  <SecurityItem 
                    icon={<Camera size={18}/>} 
                    label="نمایش تصویر پروفایل" 
                    extra={user.privacy.showAvatar === 'all' ? 'همه کاربران' : (user.privacy.showAvatar === 'contacts' ? 'فقط مخاطبین من' : 'هیچ‌کس')} 
                    onClick={() => togglePrivacy('showAvatar')}
                  />
               </section>

               {/* Advanced Authentication */}
               <section className="space-y-2">
                  <h4 className="text-[#3390ec] font-bold text-xs uppercase tracking-widest px-1">امنیت پیشرفته حساب</h4>
                  <SecurityItem 
                    icon={<QrCode size={18}/>} 
                    label="تأیید دو مرحله‌ای (Google Authenticator / 2FA)" 
                    onClick={start2FASetup} 
                    extra={user.twoFactorEnabled ? 'فعال است' : 'غیرفعال'} 
                    isActive={user.twoFactorEnabled}
                  />
                  <SecurityItem 
                    icon={<Key size={18}/>} 
                    label="قفل برنامه با رمز ۴ رقمی (Passcode Lock)" 
                    onClick={startPasscodeSetup} 
                    extra={user.passcode ? 'فعال است' : 'غیرفعال'}
                    isActive={!!user.passcode}
                  />
               </section>

               {/* Danger Zone: Delete Account */}
               <section className="pt-2">
                 <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 space-y-3">
                   <div className="flex items-start gap-3">
                     <div className="w-8 h-8 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400 shrink-0 mt-0.5">
                       <AlertTriangle size={18} />
                     </div>
                     <div className="flex-1">
                       <h5 className="font-bold text-sm text-red-300">منطقه حساس: حذف حساب کاربری</h5>
                       <p className="text-xs text-red-300/70 leading-relaxed mt-1">
                         با حذف حساب، تمامی پیام‌ها، مخاطبین، فایل‌ها و هویت شما به صورت کامل و غیرقابل بازگشت پاک خواهند شد.
                       </p>
                     </div>
                   </div>
                   <button
                     onClick={() => {
                       setDeleteConfirmText('');
                       setShowDeleteConfirm(true);
                     }}
                     className="w-full py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-98"
                   >
                     <Trash2 size={15} />
                     <span>حذف دائمی حساب کاربری</span>
                   </button>
                 </div>
               </section>

               {/* Log out */}
               <div className="pt-1">
                 <button 
                   onClick={async () => {
                     await authApi.logout();
                     localStorage.removeItem('starly_session_cloud');
                     localStorage.removeItem('starly_current_user');
                     window.location.reload();
                   }}
                   className="w-full py-3.5 bg-white/5 text-[#708499] hover:text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-all active:scale-98 border border-white/5 text-xs"
                 >
                   <LogOut size={16}/> خروج از حساب کاربری
                 </button>
               </div>
            </div>
          )}

          {/* 2. Appearance & Chat Themes Tab */}
          {tab === 'appearance' && (
            <div className="space-y-6 animate-in slide-in-from-left duration-200">
               {/* Application Theme */}
               <section className="space-y-3">
                  <h4 className="text-[#3390ec] font-bold text-xs uppercase tracking-widest px-1">پوسته اپلیکیشن</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'night', label: 'شب (تلگرام تاریک)', bg: 'bg-[#0e1621] text-white border-white/10', color: '#17212b' },
                      { id: 'oled', label: 'مشکی مطلق (OLED)', bg: 'bg-[#000000] text-white border-white/20', color: '#121212' },
                      { id: 'day', label: 'کلاسیک روشن (تلگرام)', bg: 'bg-[#e4ecf2] text-black border-slate-300', color: '#e4ecf2' },
                      { id: 'arctic', label: 'آرتیک (زمردی)', bg: 'bg-[#0b141a] text-white border-emerald-500/30', color: '#111b21' },
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => {
                          const updated = { ...user, theme: t.id as User['theme'] };
                          onUpdateUser(updated);
                          document.body.className = `${t.id}-theme`;
                          localStorage.setItem('starly_theme', t.id);
                        }}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                          user.theme === t.id ? 'border-[#3390ec] ring-2 ring-[#3390ec]/30 bg-[#3390ec]/10' : 'border-white/5 bg-[#242f3d] hover:bg-[#2b3949]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: t.color }}/>
                          <span className="text-xs font-bold text-white">{t.label}</span>
                        </div>
                        {user.theme === t.id && <Check size={16} className="text-[#3390ec]"/>}
                      </button>
                    ))}
                  </div>
               </section>

               {/* Wallpapers */}
               <section className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-[#3390ec] font-bold text-xs uppercase tracking-widest">پس‌زمینه چت‌ها</h4>
                    <span className="text-[11px] text-[#708499]">پیش‌فرض تلگرام یا تصویر دلخواه</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                     {WALLPAPER_PRESETS.map(wp => (
                       <button
                         key={wp.id}
                         onClick={() => onUpdateUser({ ...user, wallpaper: wp.id })}
                         className={`h-20 rounded-2xl border relative overflow-hidden transition-all flex flex-col justify-end p-2 ${
                           user.wallpaper === wp.id ? 'border-[#3390ec] ring-2 ring-[#3390ec]/40' : 'border-white/10 hover:border-white/30'
                         }`}
                         style={resolveWallpaperStyle(wp.id)}
                       >
                         <span className="text-[10px] font-bold text-white drop-shadow-md z-10 bg-black/40 px-1.5 py-0.5 rounded-md backdrop-blur-xs w-fit">
                           {wp.name}
                         </span>
                         {user.wallpaper === wp.id && (
                           <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#3390ec] text-white flex items-center justify-center shadow-md">
                             <Check size={12}/>
                           </div>
                         )}
                       </button>
                     ))}
                  </div>

                  {/* Custom Wallpaper Upload / URL */}
                  <div className="bg-[#242f3d] p-3 rounded-2xl border border-white/5 space-y-2 mt-2">
                    <div className="flex items-center justify-between text-xs text-[#708499]">
                      <span>یا آپلود تصویر دلخواه:</span>
                      <button
                        onClick={() => wallpaperFileInputRef.current?.click()}
                        className="text-[#3390ec] hover:underline flex items-center gap-1 font-bold"
                      >
                        <Upload size={13}/> بارگذاری فایل
                      </button>
                      <input
                        ref={wallpaperFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const compressed = await compressImage(file, 1600, 0.85);
                            onUpdateUser({ ...user, wallpaper: compressed });
                          }
                        }}
                      />
                    </div>
                  </div>
               </section>

               {/* Font size */}
               <section className="space-y-3">
                  <h4 className="text-[#3390ec] font-bold text-xs uppercase tracking-widest px-1">اندازه قلم متن پیام‌ها</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { size: '13px', label: 'کوچک (۱۳px)' },
                      { size: '15px', label: 'استاندارد (۱۵px)' },
                      { size: '17px', label: 'بزرگ (۱۷px)' }
                    ].map(f => (
                      <button
                        key={f.size}
                        onClick={() => {
                          setFontSize(f.size);
                          writePreference(PREFERENCE_KEYS.fontSize, f.size);
                          applyAppearancePreferences();
                        }}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${
                          fontSize === f.size ? 'border-[#3390ec] bg-[#3390ec]/15 text-white' : 'border-white/5 bg-[#242f3d] text-[#708499] hover:text-white'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
               </section>

               {/* Message bubble shape */}
               <section className="space-y-3">
                  <h4 className="text-[#3390ec] font-bold text-xs uppercase tracking-widest px-1">گردی حباب پیام</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { radius: '0.5rem', label: 'کم' },
                      { radius: '1rem', label: 'معمولی' },
                      { radius: '1.5rem', label: 'زیاد' },
                      { radius: '9999px', label: 'گرد' }
                    ].map(option => (
                      <button
                        key={option.radius}
                        onClick={() => {
                          setBubbleRoundness(option.radius);
                          writePreference(PREFERENCE_KEYS.bubbleRoundness, option.radius);
                          applyAppearancePreferences();
                        }}
                        className={`p-2 rounded-xl border text-[11px] font-bold transition-all ${
                          bubbleRoundness === option.radius ? 'border-[#3390ec] bg-[#3390ec]/15 text-white' : 'border-white/5 bg-[#242f3d] text-[#708499] hover:text-white'
                        }`}
                      >
                        <span className="block w-7 h-5 bg-[#3390ec] mx-auto mb-1" style={{ borderRadius: option.radius }} />
                        {option.label}
                      </button>
                    ))}
                  </div>
               </section>
            </div>
          )}

          {/* 3. Notifications & Sounds Tab */}
          {tab === 'notifications' && (
            <div className="space-y-4 animate-in slide-in-from-left duration-200">
               <div className="bg-[#242f3d] rounded-2xl p-4 border border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-[#3390ec]/20 text-[#3390ec]">
                        <Bell size={18}/>
                      </div>
                      <div>
                        <h5 className="font-bold text-white text-sm">اعلان‌های مرورگر (Push)</h5>
                        <p className="text-[11px] text-[#708499]">دریافت پیام در پس‌زمینه و حالت بسته</p>
                      </div>
                    </div>
                    <button
                      onClick={handleRequestPushNotif}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        notifGranted ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-[#3390ec] text-white hover:bg-[#2b7bc4]'
                      }`}
                    >
                      {notifGranted ? 'فعال است ✓' : 'درخواست مجوز'}
                    </button>
                  </div>

                  <div className="border-t border-white/5 pt-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                        <Volume2 size={18}/>
                      </div>
                      <div>
                        <h5 className="font-bold text-white text-sm">صدای پیام ورودی</h5>
                        <p className="text-[11px] text-[#708499]">پخش ملودی هنگام رسیدن پیام جدید</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleTestSound}
                        className="px-2.5 py-1 rounded-lg bg-white/5 text-[#708499] hover:text-white text-[11px] font-bold transition-colors"
                      >
                        تست صدا ♫
                      </button>
                      <button
                        onClick={() => handleToggleSound(!soundEnabled)}
                        className={`w-11 h-6 rounded-full transition-colors relative ${
                          soundEnabled ? 'bg-[#3390ec]' : 'bg-white/10'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          soundEnabled ? 'right-1' : 'right-6'
                        }`}/>
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                        <Eye size={18}/>
                      </div>
                      <div>
                        <h5 className="font-bold text-white text-sm">پیش‌نمایش متن پیام</h5>
                        <p className="text-[11px] text-[#708499]">نمایش متن در اعلان‌های پاپ‌آپ</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleTogglePreview(!previewTextEnabled)}
                      className={`w-11 h-6 rounded-full transition-colors relative ${
                        previewTextEnabled ? 'bg-[#3390ec]' : 'bg-white/10'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        previewTextEnabled ? 'right-1' : 'right-6'
                      }`}/>
                    </button>
                  </div>
               </div>
            </div>
          )}

          {/* 4. Data & Storage Tab */}
          {tab === 'storage' && (
            <div className="space-y-4 animate-in slide-in-from-left duration-200">
               <div className="bg-[#242f3d] rounded-2xl p-4 border border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                        <Database size={18}/>
                      </div>
                      <div>
                        <h5 className="font-bold text-white text-sm">حافظه موقت کش (Cache)</h5>
                        <p className="text-[11px] text-[#708499]">فضای ذخیره‌سازی محلی و تصاویر بارگذاری شده</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                      {cacheSize}
                    </span>
                  </div>

                  <button
                    onClick={handleClearCache}
                    className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-98"
                  >
                    <RefreshCw size={14} className={cacheCleared ? 'animate-spin' : ''}/>
                    <span>{cacheCleared ? 'حافظه موقت با موفقیت پاک شد ✓' : 'پاکسازی حافظه موقت (Clear Cache)'}</span>
                  </button>
               </div>

               {/* Auto-download toggles */}
               <div className="bg-[#242f3d] rounded-2xl p-4 border border-white/5 space-y-3">
                  <h5 className="text-[#3390ec] font-bold text-xs uppercase tracking-widest">دانلود خودکار رسانه‌ها</h5>
                  
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-white font-medium">دانلود خودکار عکس‌ها</span>
                    <button
                      onClick={() => {
                        const next = !autoDownloadPhotos;
                        setAutoDownloadPhotos(next);
                        writePreference(PREFERENCE_KEYS.autoDownloadPhotos, next ? 'true' : 'false');
                      }}
                      className={`w-11 h-6 rounded-full transition-colors relative ${
                        autoDownloadPhotos ? 'bg-[#3390ec]' : 'bg-white/10'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        autoDownloadPhotos ? 'right-1' : 'right-6'
                      }`}/>
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-1 border-t border-white/5 pt-2">
                    <span className="text-xs text-white font-medium">دانلود خودکار پیام‌های صوتی (ویس)</span>
                    <button
                      onClick={() => {
                        const next = !autoDownloadVoice;
                        setAutoDownloadVoice(next);
                        writePreference(PREFERENCE_KEYS.autoDownloadVoice, next ? 'true' : 'false');
                      }}
                      className={`w-11 h-6 rounded-full transition-colors relative ${
                        autoDownloadVoice ? 'bg-[#3390ec]' : 'bg-white/10'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        autoDownloadVoice ? 'right-1' : 'right-6'
                      }`}/>
                    </button>
                  </div>
               </div>
            </div>
          )}

          {/* 5. Chat Preferences Tab */}
          {tab === 'chats' && (
            <div className="space-y-4 animate-in slide-in-from-left duration-200">
               <div className="bg-[#242f3d] rounded-2xl p-4 border border-white/5 space-y-3">
                  <h5 className="text-[#3390ec] font-bold text-xs uppercase tracking-widest">رفتار ارسال پیام</h5>

                  <div className="flex items-center justify-between py-1">
                    <div>
                      <span className="text-xs text-white font-bold block">ارسال با کلید Enter</span>
                      <span className="text-[11px] text-[#708499]">با غیرفعال کردن، برای رفتن به خط بعد اینتر و برای ارسال Ctrl+Enter لازم است</span>
                    </div>
                    <button
                      onClick={() => {
                        const next = !sendOnEnter;
                        setSendOnEnter(next);
                        writePreference(PREFERENCE_KEYS.sendOnEnter, next ? 'true' : 'false');
                      }}
                      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                        sendOnEnter ? 'bg-[#3390ec]' : 'bg-white/10'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        sendOnEnter ? 'right-1' : 'right-6'
                      }`}/>
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-1 border-t border-white/5 pt-3">
                    <div>
                      <span className="text-xs text-white font-bold block">اسکرول خودکار به آخرین پیام</span>
                      <span className="text-[11px] text-[#708499]">هنگام دریافت پیام جدید در گفتگوی جاری</span>
                    </div>
                    <button
                      onClick={() => {
                        const next = !autoScroll;
                        setAutoScroll(next);
                        writePreference(PREFERENCE_KEYS.autoScroll, next ? 'true' : 'false');
                      }}
                      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                        autoScroll ? 'bg-[#3390ec]' : 'bg-white/10'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        autoScroll ? 'right-1' : 'right-6'
                      }`}/>
                    </button>
                  </div>
               </div>
            </div>
          )}

        </div>
          </>
        )}
      </div>

      {/* Delete Account Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in zoom-in-95">
          <div className="bg-[#17212b] border border-red-500/30 w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-400 mx-auto flex items-center justify-center animate-bounce">
              <AlertTriangle size={30} />
            </div>
            
            <div className="space-y-1">
              <h4 className="text-white font-bold text-base">تأیید حذف نهایی حساب کاربری</h4>
              <p className="text-xs text-red-300/80 leading-relaxed">
                این عملیات برگشت‌ناپذیر است. تمام چت‌ها، پیام‌ها، رسانه‌ها و دسترسی‌های حساب شما معدوم خواهند شد.
              </p>
            </div>

            <div className="bg-[#242f3d] p-3 rounded-2xl border border-white/5 text-right space-y-1.5">
              <label className="text-[11px] text-[#708499] block font-medium">
                جهت تأیید، نام کاربری خود <span className="text-white font-bold font-mono">@{user.username}</span> را وارد کنید:
              </label>
              <input
                type="text"
                dir="ltr"
                placeholder={user.username}
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full bg-[#17212b] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:border-red-500 outline-none text-center"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#708499] hover:text-white text-xs font-bold transition-colors"
              >
                انصراف
              </button>
              <button
                onClick={handleExecuteDeleteAccount}
                disabled={deleteConfirmText.trim().toLowerCase() !== user.username.trim().toLowerCase() || isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-1.5"
              >
                {isDeleting ? <RefreshCw size={14} className="animate-spin"/> : <Trash2 size={14}/>}
                <span>حذف دائمی</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Passcode Setup Modal */}
      {showPasscodeSetup && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in zoom-in-95">
          <div className="bg-[#17212b] border border-white/10 w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4">
             <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                   <Key size={18} className="text-[#3390ec]"/>
                   <h4 className="text-white font-bold text-sm">تنظیم قفل ۴ رقمی برنامه</h4>
                </div>
                <button onClick={() => setShowPasscodeSetup(false)} className="text-[#708499] hover:text-white">
                  <X size={18}/>
                </button>
             </div>

             <div className="space-y-3">
               <div>
                 <label className="text-xs text-[#708499] block mb-1.5">رمز ۴ رقمی جدید:</label>
                 <input
                   type="password"
                   maxLength={4}
                   dir="ltr"
                   placeholder="••••"
                   value={newPasscode}
                   onChange={e => setNewPasscode(e.target.value.replace(/\D/g, ''))}
                   className="w-full bg-[#242f3d] border border-white/10 rounded-xl px-4 py-2.5 text-center text-white tracking-widest text-lg font-mono focus:border-[#3390ec] outline-none"
                 />
               </div>

               <div>
                 <label className="text-xs text-[#708499] block mb-1.5">تکرار رمز ۴ رقمی:</label>
                 <input
                   type="password"
                   maxLength={4}
                   dir="ltr"
                   placeholder="••••"
                   value={confirmPasscode}
                   onChange={e => setConfirmPasscode(e.target.value.replace(/\D/g, ''))}
                   className="w-full bg-[#242f3d] border border-white/10 rounded-xl px-4 py-2.5 text-center text-white tracking-widest text-lg font-mono focus:border-[#3390ec] outline-none"
                 />
               </div>

               {passcodeError && (
                 <p className="text-[11px] text-red-400 text-center">{passcodeError}</p>
               )}
             </div>

             <div className="flex gap-2 pt-2">
               {user.passcode && (
                 <button
                   onClick={handleDisablePasscode}
                   className="flex-1 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold transition-all border border-red-500/20"
                 >
                   غیرفعال‌سازی قفل
                 </button>
               )}
               <button
                 onClick={handleSavePasscode}
                 className="flex-1 py-2.5 rounded-xl bg-[#3390ec] hover:bg-[#2b7bc4] text-white text-xs font-bold transition-all shadow-md active:scale-95"
               >
                 ذخیره رمز عبور
               </button>
             </div>
          </div>
        </div>
      )}

      {/* 2FA Setup Modal */}
      {show2FASetup && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in zoom-in-95">
          <div className="bg-[#17212b] border border-white/10 w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4">
             <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                   <QrCode size={18} className="text-[#3390ec]"/>
                   <h4 className="text-white font-bold text-sm">راهنمای تأیید دو مرحله‌ای</h4>
                </div>
                <button onClick={() => setShow2FASetup(false)} className="text-[#708499] hover:text-white">
                  <X size={18}/>
                </button>
             </div>

             {twoFAStep === 1 && (
               <div className="space-y-3">
                 <p className="text-xs text-[#708499] leading-relaxed">
                   کلید زیر را در اپلیکیشن Google Authenticator یا اپلیکیشن رمزساز خود وارد کنید:
                 </p>
                 <div className="bg-[#242f3d] p-3 rounded-xl border border-white/10 flex items-center justify-between">
                   <span className="font-mono text-sm text-[#3390ec] tracking-wider select-all font-bold">
                     {temp2FASecret}
                   </span>
                   <button
                     onClick={() => {
                       navigator.clipboard.writeText(temp2FASecret);
                       setCopiedSecret(true);
                       setTimeout(() => setCopiedSecret(false), 2000);
                     }}
                     className="p-1.5 hover:bg-white/10 rounded-lg text-[#708499] hover:text-white"
                   >
                     {copiedSecret ? <Check size={16} className="text-green-400"/> : <Copy size={16}/>}
                   </button>
                 </div>
                 <button
                   onClick={() => setTwoFAStep(2)}
                   className="w-full py-2.5 rounded-xl bg-[#3390ec] hover:bg-[#2b7bc4] text-white text-xs font-bold transition-all shadow-md active:scale-95"
                 >
                   مرحله بعد: تأیید کد
                 </button>
               </div>
             )}

             {twoFAStep === 2 && (
               <div className="space-y-3">
                 <p className="text-xs text-[#708499] leading-relaxed">
                   کد ۶ رقمی ساخته شده در اپلیکیشن رمزساز را برای تأیید وارد کنید:
                 </p>
                 <input
                   type="text"
                   maxLength={6}
                   dir="ltr"
                   placeholder="000000"
                   value={twoFACodeInput}
                   onChange={e => setTwoFACodeInput(e.target.value.replace(/\D/g, ''))}
                   className="w-full bg-[#242f3d] border border-white/10 rounded-xl px-4 py-2.5 text-center text-white tracking-widest text-lg font-mono focus:border-[#3390ec] outline-none"
                 />
                 {twoFAError && (
                   <p className="text-[11px] text-red-400 text-center">{twoFAError}</p>
                 )}
                 <div className="flex gap-2">
                   <button
                     onClick={() => setTwoFAStep(1)}
                     className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#708499] hover:text-white text-xs font-bold"
                   >
                     بازگشت
                   </button>
                   <button
                     onClick={handleVerify2FACode}
                     className="flex-1 py-2.5 rounded-xl bg-[#3390ec] hover:bg-[#2b7bc4] text-white text-xs font-bold transition-all shadow-md active:scale-95"
                   >
                     فعال‌سازی نهایی
                   </button>
                 </div>
               </div>
             )}

             {twoFAStep === 3 && (
               <div className="space-y-3 text-center py-2">
                 <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                   <CheckCircle2 size={24}/>
                 </div>
                 <h5 className="text-white font-bold text-sm">تأیید دو مرحله‌ای فعال شد!</h5>
                 <p className="text-xs text-[#708499]">
                   از این پس در هنگام ورود، علاوه بر رمز عبور، کد یکبارمصرف نیز الزامی خواهد بود.
                 </p>
                 <button
                   onClick={() => setShow2FASetup(false)}
                   className="w-full py-2.5 rounded-xl bg-[#3390ec] text-white text-xs font-bold mt-2"
                 >
                   بستن
                 </button>
               </div>
             )}
          </div>
        </div>
      )}

    </div>
  );
};

const SecurityItem = ({icon, label, onClick, extra, isActive}: any) => (
  <div onClick={onClick} className="flex items-center justify-between p-4 bg-[#242f3d] rounded-2xl cursor-pointer hover:bg-[#2b3949] transition-all border border-white/5 group shadow-sm select-none">
    <div className="flex items-center gap-3.5">
      <span className={`transition-colors p-2 rounded-xl ${isActive ? 'bg-[#3390ec]/20 text-[#3390ec]' : 'bg-white/5 text-[#708499]'}`}>{icon}</span>
      <span className="text-xs font-bold text-white">{label}</span>
    </div>
    <div className="flex items-center gap-2">
      {extra && <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-[#708499]'}`}>{extra}</span>}
      <ChevronLeft size={16} className="text-[#708499] group-hover:translate-x-[-3px] transition-transform"/>
    </div>
  </div>
);

export default SettingsModal;
