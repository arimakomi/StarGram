import React, { useState, useRef, useEffect } from 'react';
import { User, SystemConfig } from '../types';
import { 
  X, Camera, User as UserIcon, Phone, AtSign, Info, 
  Check, Shield, Sparkles, RefreshCw, Image as ImageIcon, FileText, Mic,
  Calendar, Send, Instagram, CheckCircle2, AlertCircle, Loader2,
  ShieldCheck, Smartphone
} from 'lucide-react';
import { compressImage } from '../services/imageUtils';
import { generateLocalAvatarSvg } from '../services/avatarGenerator';
import { authApi } from '../services/auth';

interface MyProfileModalProps {
  user: User;
  onClose: () => void;
  onUpdateUser: (updatedUser: Partial<User>) => Promise<void>;
  systemConfig?: SystemConfig;
}

export const MyProfileModal: React.FC<MyProfileModalProps> = ({ user, onClose, onUpdateUser, systemConfig }) => {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [bio, setBio] = useState(user.bio || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [isPhoneVerified, setIsPhoneVerified] = useState(Boolean(user.isPhoneVerified && user.phone));
  const [birthday, setBirthday] = useState(user.birthday || '');
  const [telegramId, setTelegramId] = useState(user.telegramId || '');
  const [instagramId, setInstagramId] = useState(user.instagramId || '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [activeTab, setActiveTab] = useState<'media' | 'files' | 'voice'>('media');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // OTP Popup State for Phone Verification & Change
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [newPhoneInput, setNewPhoneInput] = useState('');
  const [otpCodeInput, setOtpCodeInput] = useState('');
  const [otpModalStep, setOtpModalStep] = useState<'phone' | 'code'>('phone');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSimulated, setOtpSimulated] = useState<string | null>(null);
  const [otpTimer, setOtpTimer] = useState(0);
  const [otpSuccessToast, setOtpSuccessToast] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // OTP countdown timer
  useEffect(() => {
    if (otpTimer <= 0) return;
    const interval = setInterval(() => {
      setOtpTimer(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [otpTimer]);

  const cleanIranPhone = (raw: string): string => {
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    let val = raw.trim();
    for (let i = 0; i < 10; i++) {
      val = val.split(persianDigits[i]).join(String(i)).split(arabicDigits[i]).join(String(i));
    }
    val = val.replace(/[^0-9+]/g, '');
    if (val.startsWith('+98')) val = '0' + val.slice(3);
    else if (val.startsWith('0098')) val = '0' + val.slice(4);
    else if (val.startsWith('98')) val = '0' + val.slice(2);
    else if (val.startsWith('9') && val.length === 10) val = '0' + val;
    return val;
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const maxMb = systemConfig?.maxUploadSizeMb || 15;
      if (file.size > maxMb * 1024 * 1024) {
        alert(`حجم تصویر انتخابی (${(file.size / (1024 * 1024)).toFixed(1)} مگابایت) از سقف مجاز (${maxMb} مگابایت) بیشتر است.`);
        if (e.target) e.target.value = '';
        return;
      }
      try {
        const compressed = await compressImage(file, 400, 400, 0.85);
        setAvatar(compressed);
      } catch (err) {
        console.error('Error compressing avatar:', err);
      }
    }
  };

  const handleGenerateSvgAvatar = () => {
    const newSvg = generateLocalAvatarSvg(displayName || user.username, String(Date.now()));
    setAvatar(newSvg);
  };

  // Open OTP Modal to add or change phone
  const handleOpenPhoneVerification = () => {
    setNewPhoneInput(phone || '');
    setOtpCodeInput('');
    setOtpError('');
    setOtpSimulated(null);
    setOtpModalStep('phone');
    setShowOtpModal(true);
  };

  // Send OTP from popup
  const handleSendOtpInModal = async () => {
    const normalized = cleanIranPhone(newPhoneInput);
    if (!/^09\d{9}$/.test(normalized)) {
      setOtpError('شماره همراه نامعتبر است (مثال: 09121234567)');
      return;
    }

    setOtpLoading(true);
    setOtpError('');
    setOtpSimulated(null);

    try {
      // 1. بررسی عدم تکراری بودن شماره
      const checkRes = await authApi.checkPhone(normalized, user.id);
      if (!checkRes.available) {
        setOtpError(checkRes.message || 'این شماره همراه قبلاً توسط کاربر دیگری ثبت شده است.');
        setOtpLoading(false);
        return;
      }

      // 2. ارسال کد OTP
      const res = await authApi.sendOtp(normalized, 'verify', user.id);
      if (!res.success) {
        setOtpError(res.message || 'خطا در ارسال کد تایید');
        setOtpLoading(false);
        return;
      }

      setOtpModalStep('code');
      setOtpTimer(120);
      if (res.simulated && res.simulatedOtp) {
        setOtpSimulated(res.simulatedOtp);
        setOtpCodeInput(res.simulatedOtp);
      }
    } catch (err) {
      console.error(err);
      setOtpError('خطا در برقراری ارتباط با سرور.');
    } finally {
      setOtpLoading(false);
    }
  };

  // Verify OTP code in popup
  const handleVerifyOtpInModal = async () => {
    const normalized = cleanIranPhone(newPhoneInput);
    const code = otpCodeInput.trim();
    if (!code || code.length < 5) {
      setOtpError('کد ۶ رقمی را وارد کنید');
      return;
    }

    setOtpLoading(true);
    setOtpError('');

    try {
      const res = await authApi.verifyOtp({
        phone: normalized,
        code,
        purpose: 'verify',
        userId: user.id
      });

      if (!res.success) {
        setOtpError(res.message || 'کد تایید نادرست است.');
        return;
      }

      // موفقیت‌آمیز
      setPhone(normalized);
      setIsPhoneVerified(true);
      await onUpdateUser({
        phone: normalized,
        isPhoneVerified: true
      });

      setShowOtpModal(false);
      setOtpSuccessToast('شماره همراه شما با موفقیت تایید و ثبت شد!');
      setTimeout(() => setOtpSuccessToast(null), 3500);
    } catch (err) {
      console.error(err);
      setOtpError('خطا در تایید شماره.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    setIsSaving(true);
    try {
      await onUpdateUser({
        displayName: displayName.trim(),
        bio: bio.trim(),
        phone: phone.trim(),
        isPhoneVerified: systemConfig?.smsOtpEnabled === false ? Boolean(phone.trim()) : isPhoneVerified,
        birthday: birthday.trim(),
        telegramId: telegramId.trim().replace(/^@/, ''),
        instagramId: instagramId.trim().replace(/^@/, ''),
        avatar: avatar
      });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 700);
    } catch (err) {
      console.error('Error updating user profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-[#17212b] text-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-[#242f3d]"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#242f3d] bg-[#0e1621]">
          <div className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-[#3390ec]" />
            <h2 className="text-base font-bold">پروفایل من</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#242f3d] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          
          {/* Success Toast */}
          {otpSuccessToast && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs font-bold flex items-center gap-2 animate-in">
              <CheckCircle2 size={16} />
              <span>{otpSuccessToast}</span>
            </div>
          )}

          {/* Avatar Area */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group cursor-pointer">
              <img
                src={avatar || user.avatar}
                alt={displayName}
                className="w-24 h-24 rounded-full object-cover border-3 border-[#3390ec] shadow-lg"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="تغییر تصویر"
              >
                <Camera className="w-6 h-6 text-white" />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs bg-[#242f3d] hover:bg-[#2c394b] text-[#3390ec] px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 font-bold"
              >
                <Camera className="w-3.5 h-3.5" />
                آپلود تصویر
              </button>
              <button
                type="button"
                onClick={handleGenerateSvgAvatar}
                className="text-xs bg-[#242f3d] hover:bg-[#2c394b] text-amber-300 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 font-bold"
                title="تولید خودکار بر اساس نام"
              >
                <Sparkles className="w-3.5 h-3.5" />
                تولید آواتار
              </button>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1.5">نام و نام خانوادگی</label>
              <div className="relative">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#242f3d] border border-white/5 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-hidden focus:border-[#3390ec] transition-colors pr-10"
                  required
                />
                <UserIcon className="w-4 h-4 text-gray-400 absolute right-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1.5">نام کاربری</label>
              <div className="relative">
                <input
                  type="text"
                  value={user.username}
                  disabled
                  className="w-full bg-[#1b2531] border border-gray-700/50 rounded-xl px-4 py-2.5 text-gray-400 text-sm cursor-not-allowed pr-10 font-mono"
                  dir="ltr"
                />
                <AtSign className="w-4 h-4 text-gray-500 absolute right-3.5 top-3" />
              </div>
              <p className="text-[11px] text-gray-500 mt-1">نام کاربری شناسه یکتای حساب شماست و قابل تغییر نیست.</p>
            </div>

            {/* ═══ PHONE NUMBER SECTION WITH OTP VERIFICATION & CHANGE ═══ */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-gray-400">شماره تلفن همراه</label>
                {systemConfig?.smsOtpEnabled === false ? (
                  <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                    ثبت آزاد شماره (بدون OTP)
                  </span>
                ) : (
                  isPhoneVerified && phone && (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldCheck size={12} />
                      تایید شده با پیامک
                    </span>
                  )
                )}
              </div>

              {systemConfig?.smsOtpEnabled === false ? (
                /* Free phone entry when OTP is disabled by admin */
                <div className="space-y-1.5">
                  <div className="relative">
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="09121234567"
                      dir="ltr"
                      className="w-full bg-[#242f3d] border border-white/5 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-hidden focus:border-[#3390ec] transition-colors pl-10 font-mono tracking-wider text-right"
                    />
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  </div>
                  <p className="text-[10px] text-gray-400">
                    سیستم تایید پیامکی (OTP) توسط مدیریت غیرفعال شده است. می‌توانید شماره همراه خود را مستقیماً ثبت یا تغییر دهید.
                  </p>
                </div>
              ) : isPhoneVerified && phone ? (
                /* Verified Phone View with "Change Phone" Button */
                <div className="p-3 bg-[#0e1621] border border-emerald-500/30 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                      <Phone size={16} />
                    </div>
                    <div>
                      <span className="text-sm font-mono font-bold text-white tracking-wider" dir="ltr">{phone}</span>
                      <span className="text-[10px] text-[#708499] block">این شماره متعلق به حساب شماست</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenPhoneVerification}
                    className="px-3 py-1.5 bg-[#3390ec]/15 hover:bg-[#3390ec]/25 border border-[#3390ec]/30 text-[#3390ec] rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <RefreshCw size={12} />
                    <span>تعویض شماره</span>
                  </button>
                </div>
              ) : (
                /* Unverified Phone View */
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="09121234567"
                      dir="ltr"
                      className="w-full bg-[#242f3d] border border-white/5 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-hidden focus:border-[#3390ec] transition-colors pl-10 font-mono tracking-wider text-right"
                    />
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenPhoneVerification}
                    className="w-full py-2 px-3 bg-[#3390ec]/15 hover:bg-[#3390ec]/25 border border-[#3390ec]/30 text-[#3390ec] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Smartphone size={14} />
                    <span>تایید و فعال‌سازی شماره با پیامک (OTP)</span>
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1.5">بیوگرافی (درباره من)</label>
              <div className="relative">
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={2}
                  maxLength={120}
                  placeholder="چند کلمه درباره خودتان بنویسید..."
                  className="w-full bg-[#242f3d] border border-white/5 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-hidden focus:border-[#3390ec] transition-colors resize-none"
                />
              </div>
              <div className="flex justify-between text-[11px] text-gray-500 mt-0.5">
                <span>نمایش به سایر کاربران (اختیاری)</span>
                <span>{bio.length} / 120</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1.5">شناسه تلگرام</label>
                <div className="relative">
                  <input
                    type="text"
                    value={telegramId}
                    onChange={(e) => setTelegramId(e.target.value)}
                    placeholder="username"
                    dir="ltr"
                    className="w-full bg-[#242f3d] border border-white/5 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-hidden focus:border-[#3390ec] transition-colors pl-8 text-right"
                  />
                  <Send className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1.5">شناسه اینستاگرام</label>
                <div className="relative">
                  <input
                    type="text"
                    value={instagramId}
                    onChange={(e) => setInstagramId(e.target.value)}
                    placeholder="username"
                    dir="ltr"
                    className="w-full bg-[#242f3d] border border-white/5 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-hidden focus:border-[#3390ec] transition-colors pl-8 text-right"
                  />
                  <Instagram className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1.5">تاریخ تولد</label>
              <div className="relative">
                <input
                  type="text"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  placeholder="مثال: ۱۳۷۵/۰۸/۱۵"
                  dir="ltr"
                  className="w-full bg-[#242f3d] border border-white/5 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-hidden focus:border-[#3390ec] transition-colors pl-8 text-right"
                />
                <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-[#3390ec] hover:bg-[#2881d9] text-white py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 disabled:opacity-50"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  ذخیره شد
                </>
              ) : isSaving ? (
                <span>در حال ذخیره...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  ذخیره تغییرات
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-[#242f3d] hover:bg-[#2b3a4a] text-gray-300 hover:text-white rounded-xl text-sm font-bold transition-colors"
            >
              انصراف
            </button>
          </div>
        </form>
      </div>

      {/* ═══════════ OTP POPUP MODAL (تایید و تعویض شماره همراه) ═══════════ */}
      {showOtpModal && (
        <div 
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowOtpModal(false)}
        >
          <div 
            className="w-full max-w-sm bg-[#17212b] rounded-3xl overflow-hidden shadow-2xl border border-white/10 p-6 space-y-4 animate-pop text-right"
            dir="rtl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <Smartphone className="text-[#3390ec]" size={18} />
                <span>{phone && isPhoneVerified ? 'تعویض شماره همراه' : 'تایید شماره همراه با OTP'}</span>
              </div>
              <button 
                type="button"
                onClick={() => setShowOtpModal(false)} 
                className="p-1 hover:bg-white/10 rounded-full text-gray-400"
              >
                <X size={18}/>
              </button>
            </div>

            {/* Step 1: Input Phone */}
            {otpModalStep === 'phone' && (
              <div className="space-y-4">
                <p className="text-xs text-[#708499] leading-relaxed">
                  شماره همراه خود را با فرمت استاندارد ایران وارد کنید. هر شماره فقط به یک حساب کاربری تعلق دارد:
                </p>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#3390ec]">شماره همراه (۰۹xxxxxxxxx)</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3.5 text-[#708499]" size={16} />
                    <input 
                      type="tel"
                      value={newPhoneInput}
                      onChange={e => setNewPhoneInput(e.target.value)}
                      placeholder="09123456789"
                      className="w-full bg-[#0e1621] py-2.5 pl-10 pr-3 rounded-xl border border-white/10 focus:border-[#3390ec] text-white text-sm font-mono tracking-wider outline-none text-left"
                      dir="ltr"
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={otpLoading}
                  onClick={handleSendOtpInModal}
                  className="w-full py-3 bg-[#3390ec] hover:bg-[#2881d9] active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-[#3390ec]/25 disabled:opacity-50"
                >
                  {otpLoading && <Loader2 className="animate-spin" size={16}/>}
                  <span>ارسال پیامک کد تایید</span>
                </button>
              </div>
            )}

            {/* Step 2: Input OTP Code */}
            {otpModalStep === 'code' && (
              <div className="space-y-4 animate-in">
                <div className="p-3 bg-[#0e1621] rounded-2xl border border-white/5 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-[#708499] block">پیامک ارسال شده به:</span>
                    <span className="font-mono font-bold text-white text-xs" dir="ltr">{cleanIranPhone(newPhoneInput)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setOtpModalStep('phone'); setOtpError(''); }}
                    className="text-[#3390ec] hover:underline text-[11px] font-bold"
                  >
                    تغییر شماره
                  </button>
                </div>

                {otpSimulated && (
                  <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center justify-between">
                    <span>کد شبیه‌ساز (محیط تست):</span>
                    <span className="font-mono font-black text-sm bg-black/40 px-2 py-0.5 rounded-lg text-white" dir="ltr">{otpSimulated}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#3390ec]">کد ۶ رقمی پیامک شده</label>
                  <input 
                    type="text"
                    value={otpCodeInput}
                    onChange={e => setOtpCodeInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    placeholder="------"
                    maxLength={6}
                    className="w-full bg-[#0e1621] py-3 px-3 rounded-xl border border-white/10 focus:border-[#3390ec] text-white text-lg font-mono tracking-[0.5em] font-black outline-none text-center"
                    dir="ltr"
                    autoFocus
                  />
                </div>

                {/* Countdown Timer & Resend Button */}
                <div className="flex items-center justify-between text-xs">
                  {otpTimer > 0 ? (
                    <span className="text-[#708499] text-[11px]">
                      ارسال مجدد تا {Math.floor(otpTimer / 60)}:{(otpTimer % 60).toString().padStart(2, '0')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtpInModal}
                      className="text-[#3390ec] hover:underline text-[11px] font-bold flex items-center gap-1"
                    >
                      <RefreshCw size={12} />
                      <span>ارسال مجدد پیامک</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  disabled={otpLoading || otpCodeInput.length < 5}
                  onClick={handleVerifyOtpInModal}
                  className="w-full py-3 bg-[#3390ec] hover:bg-[#2881d9] active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-[#3390ec]/25 disabled:opacity-50"
                >
                  {otpLoading && <Loader2 className="animate-spin" size={16}/>}
                  <span>تایید و ثبت شماره</span>
                </button>
              </div>
            )}

            {/* Error Message */}
            {otpError && (
              <p className="text-red-400 text-xs text-center font-medium bg-red-400/10 p-2 rounded-xl border border-red-400/20 flex items-center justify-center gap-1">
                <AlertCircle size={14} className="shrink-0" />
                <span>{otpError}</span>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyProfileModal;
