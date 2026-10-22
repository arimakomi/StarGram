
import React, { useState, useEffect } from 'react';
import { User, DEFAULT_AVATAR } from '../types';
import { X, Shield, Key, Check, Smartphone, Lock, Camera, LogOut, ChevronLeft, Eye, Clock, Monitor, User as UserIcon, ArrowRight, Copy, QrCode, RotateCcw } from 'lucide-react';

import { compressImage } from '../services/imageUtils';

interface SettingsModalProps {
  user: User;
  onClose: () => void;
  onUpdateUser: (updated: User) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ user, onClose, onUpdateUser }) => {
  const [tab, setTab] = useState<'profile' | 'security'>('profile');
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio || '');
  
  // Session State
  const [sessionInfo, setSessionInfo] = useState<{os: string, browser: string}>({os: 'Unknown', browser: 'Web'});

  // 2FA Setup State
  const [twoFactorStep, setTwoFactorStep] = useState<0 | 1 | 2>(0);
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [verify2FACode, setVerify2FACode] = useState('');
  const [error2FA, setError2FA] = useState('');

  // Passcode Setup State
  const [passcodeStep, setPasscodeStep] = useState<0 | 1 | 2>(0); // 0: off, 1: enter new, 2: confirm
  const [tempPasscode, setTempPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');

  useEffect(() => {
    // Basic User Agent Parsing for "Real" Session Info
    const ua = navigator.userAgent;
    let os = "Unknown OS";
    if (ua.indexOf("Win") !== -1) os = "Windows";
    if (ua.indexOf("Mac") !== -1) os = "macOS";
    if (ua.indexOf("Linux") !== -1) os = "Linux";
    if (ua.indexOf("Android") !== -1) os = "Android";
    if (ua.indexOf("iOS") !== -1 || ua.indexOf("iPhone") !== -1) os = "iOS";

    let browser = "Web Browser";
    if (ua.indexOf("Chrome") !== -1) browser = "Chrome";
    else if (ua.indexOf("Firefox") !== -1) browser = "Firefox";
    else if (ua.indexOf("Safari") !== -1) browser = "Safari";
    else if (ua.indexOf("Edge") !== -1) browser = "Edge";

    setSessionInfo({ os, browser });
  }, []);

  const save = (changes: Partial<User>) => {
    const updatedUser = { ...user, ...changes };
    onUpdateUser(updatedUser);
    try {
      const users = JSON.parse(localStorage.getItem('starly_users') || '{}');
      if (users[user.username]) {
        users[user.username] = { ...users[user.username], ...changes };
        localStorage.setItem('starly_users', JSON.stringify(users));
      }
    } catch (e) {
      console.warn("Could not save to starly_users localStorage:", e);
    }
  };

  const handleAvatarChange = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const compressed = await compressImage(file, 256, 256, 0.82);
        save({ avatar: compressed });
      } catch (err) {
        console.error("Failed to compress avatar:", err);
      }
    };
    input.click();
  };

  const togglePrivacy = (field: 'showStatus' | 'showAvatar') => {
    const current = user.privacy[field] || 'all';
    const next = current === 'all' ? 'contacts' : (current === 'contacts' ? 'none' : 'all');
    save({ privacy: { ...user.privacy, [field]: next } });
  };

  const generateSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  };

  const start2FASetup = () => {
    if (user.twoFactorEnabled) {
      if(confirm('آیا مطمئن هستید که می‌خواهید تایید دو مرحله‌ای را غیرفعال کنید؟')) {
        save({ twoFactorEnabled: false });
      }
    } else {
      setTwoFactorSecret(generateSecret());
      setTwoFactorStep(1);
    }
  };

  const handle2FAVerify = () => {
    setError2FA('');
    if (!/^\d{6}$/.test(verify2FACode)) {
      return setError2FA('کد وارد شده باید ۶ رقم باشد.');
    }
    save({ twoFactorEnabled: true });
    alert('تایید دو مرحله‌ای با موفقیت فعال شد!');
    setTwoFactorStep(0);
    setVerify2FACode('');
    setTwoFactorSecret('');
  };

  const startPasscodeSetup = () => {
    if (user.passcode) {
      if (confirm('آیا می‌خواهید قفل برنامه را غیرفعال کنید؟')) {
        save({ passcode: undefined });
      }
    } else {
      setPasscodeStep(1);
      setTempPasscode('');
      setConfirmPasscode('');
      setPasscodeError('');
    }
  };

  const handlePasscodeSet = () => {
    setPasscodeError('');
    if (passcodeStep === 1) {
      if (tempPasscode.length < 4) {
        setPasscodeError('رمز عبور باید ۴ رقم باشد.');
        return;
      }
      setPasscodeStep(2);
    } else if (passcodeStep === 2) {
      if (confirmPasscode !== tempPasscode) {
        setPasscodeError('رمز عبور مطابقت ندارد. مجدد تلاش کنید.');
        setPasscodeStep(1);
        setTempPasscode('');
        setConfirmPasscode('');
        return;
      }
      save({ passcode: tempPasscode });
      setPasscodeStep(0);
      alert('قفل برنامه فعال شد.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#17212b] rounded-3xl overflow-hidden border border-white/5 shadow-2xl animate-in zoom-in h-[85vh] flex flex-col relative">
        
        {/* Passcode Setup Overlay */}
        {passcodeStep > 0 && (
          <div className="absolute inset-0 bg-[#17212b] z-50 flex flex-col animate-in slide-in-from-right items-center justify-center p-8 space-y-6">
             <div className="w-20 h-20 bg-[#3390ec]/20 rounded-full flex items-center justify-center text-[#3390ec] mb-4">
                <Lock size={32}/>
             </div>
             <h3 className="font-bold text-white text-lg">
               {passcodeStep === 1 ? 'رمز عبور جدید را وارد کنید' : 'رمز عبور را تایید کنید'}
             </h3>
             <input 
               type="password"
               inputMode="numeric"
               value={passcodeStep === 1 ? tempPasscode : confirmPasscode}
               onChange={e => {
                 const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                 if (passcodeStep === 1) setTempPasscode(val);
                 else setConfirmPasscode(val);
               }}
               className="bg-[#242f3d] text-center text-3xl tracking-[1em] text-white p-4 rounded-xl w-full border border-[#3390ec]/50 outline-none focus:bg-[#2b3949] transition-all placeholder:tracking-normal placeholder:text-sm"
               placeholder="____"
               autoFocus
             />
             {passcodeError && <p className="text-red-400 text-xs">{passcodeError}</p>}
             <div className="flex gap-3 w-full">
                <button onClick={() => setPasscodeStep(0)} className="flex-1 py-3 rounded-xl font-bold text-[#708499] hover:bg-white/5 transition-all">انصراف</button>
                <button onClick={handlePasscodeSet} disabled={(passcodeStep === 1 ? tempPasscode : confirmPasscode).length !== 4} className="flex-1 py-3 bg-[#3390ec] rounded-xl font-bold text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                  {passcodeStep === 1 ? 'ادامه' : 'تایید'}
                </button>
             </div>
          </div>
        )}

        {/* 2FA Wizard Overlay */}
        {twoFactorStep > 0 && (
          <div className="absolute inset-0 bg-[#17212b] z-50 flex flex-col animate-in slide-in-from-right overflow-y-auto no-scrollbar">
             <div className="p-4 flex items-center gap-4 border-b border-white/5 shrink-0">
                <button onClick={() => { 
                  if(twoFactorStep === 1) setTwoFactorStep(0);
                  else setTwoFactorStep(1);
                  setError2FA('');
                }} className="p-2 hover:bg-white/5 rounded-full text-[#708499]"><ArrowRight/></button>
                <h3 className="font-bold text-white">تنظیم Google Authenticator</h3>
             </div>
             
             <div className="flex-1 p-6 flex flex-col items-center text-center space-y-6">
                {twoFactorStep === 1 && (
                  <div className="space-y-6 animate-in fade-in py-10">
                    <div className="w-24 h-24 bg-[#3390ec]/20 rounded-full flex items-center justify-center mx-auto text-[#3390ec] mb-4">
                       <Shield size={48}/>
                    </div>
                    <h2 className="text-xl font-bold text-white">تایید دو مرحله‌ای (2FA)</h2>
                    <p className="text-sm text-[#708499] leading-loose">
                      برای افزایش امنیت حساب خود، از برنامه‌هایی مانند <span className="text-white font-bold">Google Authenticator</span> استفاده کنید. این برنامه‌ها کدهای یک‌بار مصرف تولید می‌کنند که برای ورود به آن نیاز خواهید داشت.
                    </p>
                    <div className="bg-[#242f3d] p-4 rounded-xl text-xs text-[#708499] border border-white/5 w-full text-right">
                       <p className="mb-2 font-bold text-[#3390ec]">مراحل فعال‌سازی:</p>
                       <ul className="list-disc list-inside space-y-1">
                          <li>برنامه Google Authenticator را نصب کنید.</li>
                          <li>در مرحله بعد QR Code را اسکن کنید.</li>
                          <li>کد ۶ رقمی نمایش داده شده را وارد کنید.</li>
                       </ul>
                    </div>
                    <button onClick={() => setTwoFactorStep(2)} className="w-full py-3 bg-[#3390ec] rounded-xl font-bold text-white shadow-lg mt-8">شروع فعال‌سازی</button>
                  </div>
                )}

                {twoFactorStep === 2 && (
                   <div className="w-full space-y-6 animate-in fade-in">
                     <div className="bg-white p-4 rounded-2xl mx-auto w-fit shadow-xl">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`otpauth://totp/StarlyChat:${user.username}?secret=${twoFactorSecret}&issuer=StarlyChat`)}`} 
                          className="w-44 h-44"
                          alt="QR Code"
                        />
                     </div>
                     
                     <div className="space-y-2">
                        <p className="text-xs text-[#708499]">اگر نمی‌توانید اسکن کنید، کد زیر را دستی وارد کنید:</p>
                        <div onClick={() => navigator.clipboard.writeText(twoFactorSecret)} className="bg-[#242f3d] p-3 rounded-xl font-mono text-[#3390ec] tracking-widest text-center cursor-pointer hover:bg-[#2b3949] transition-colors border border-dashed border-[#3390ec]/30 flex items-center justify-center gap-2 group">
                           {twoFactorSecret}
                           <Copy size={14} className="opacity-50 group-hover:opacity-100"/>
                        </div>
                     </div>

                     <div className="w-full h-px bg-white/10 my-4"/>

                     <div className="space-y-3 w-full">
                        <h3 className="font-bold text-white text-sm">کد تایید را وارد کنید</h3>
                        <input 
                          type="number" 
                          value={verify2FACode} 
                          onChange={e=>setVerify2FACode(e.target.value.slice(0,6))}
                          placeholder="کد ۶ رقمی (مثال: 123456)" 
                          className="w-full bg-[#242f3d] p-4 rounded-xl text-center text-white text-lg tracking-[0.5em] outline-none focus:border-[#3390ec] border border-transparent transition-all placeholder:tracking-normal placeholder:text-sm"
                          autoFocus
                          dir="ltr"
                        />
                        {error2FA && <p className="text-red-400 text-xs">{error2FA}</p>}
                     </div>
                     
                     <button onClick={handle2FAVerify} className="w-full py-3 bg-[#3390ec] rounded-xl font-bold text-white shadow-lg">بررسی و فعال‌سازی</button>
                   </div>
                )}
             </div>
          </div>
        )}

        <div className="flex p-4 border-b border-white/5 bg-[#242f3d] shrink-0">
          <h3 className="font-bold flex-1 text-white">تنظیمات استارلی چت</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full text-[#708499]"><X/></button>
        </div>
        
        <div className="flex border-b border-white/5 bg-[#17212b] shrink-0">
          {['profile', 'security'].map((t: any) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-4 text-xs font-bold transition-all relative ${tab===t?'text-[#3390ec]':'text-[#708499]'}`}>
              {t === 'profile' ? 'حساب کاربری' : 'حریم خصوصی و امنیت'}
              {tab === t && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#3390ec] rounded-t-full"/>}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-6 overflow-y-auto no-scrollbar bg-[#17212b] flex-1">
          {tab === 'profile' && (
            <div className="space-y-6 animate-in slide-in-from-left">
              <div className="flex flex-col items-center gap-2">
                <div className="text-center group relative w-28 h-28 mx-auto">
                  <img 
                    src={user.avatar || DEFAULT_AVATAR} 
                    onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                    className="w-28 h-28 rounded-full border-4 border-[#3390ec] object-cover shadow-2xl transition-transform group-hover:scale-105 bg-[#242f3d]"
                  />
                  <div onClick={handleAvatarChange} className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer" title="تغییر عکس پروفایل">
                    <Camera size={32} className="text-white"/>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <button 
                    type="button"
                    onClick={handleAvatarChange}
                    className="text-xs text-[#3390ec] hover:underline font-bold flex items-center gap-1 bg-[#3390ec]/10 px-3 py-1.5 rounded-full"
                  >
                    <Camera size={13}/> تغییر عکس
                  </button>
                  {user.avatar !== DEFAULT_AVATAR && (
                    <button 
                      type="button"
                      onClick={() => save({ avatar: DEFAULT_AVATAR })}
                      className="text-xs text-[#708499] hover:text-white hover:underline flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded-full"
                      title="بازنشانی به عکس دیفالت"
                    >
                      <RotateCcw size={13}/> بازنشانی
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                   <div className="bg-[#242f3d] p-3 rounded-xl flex items-center gap-3 border border-white/5">
                      <div className="p-2 bg-[#3390ec]/20 rounded-full text-[#3390ec]"><UserIcon size={20}/></div>
                      <div className="flex-1">
                         <p className="text-xs text-[#708499]">نام کاربری</p>
                         <p className="text-sm font-bold text-white" dir="ltr">@{user.username}</p>
                      </div>
                   </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#3390ec] mr-1 uppercase tracking-widest">نام نمایشی</label>
                  <input value={displayName} onChange={e=>setDisplayName(e.target.value)} className="w-full bg-[#242f3d] p-4 rounded-xl outline-none border border-white/5 focus:border-[#3390ec] transition-all text-white"/>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#3390ec] mr-1 uppercase tracking-widest">بایوگرافی (درباره شما)</label>
                  <textarea value={bio} onChange={e=>setBio(e.target.value)} className="w-full bg-[#242f3d] p-4 rounded-xl outline-none border border-white/5 h-24 resize-none no-scrollbar focus:border-[#3390ec] transition-all text-white"/>
                </div>
                <button onClick={() => save({displayName, bio})} className="w-full py-4 bg-[#3390ec] rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl hover:bg-[#2881d9] active:scale-95 transition-all text-white"><Check size={20}/> ذخیره پروفایل</button>
              </div>
            </div>
          )}

          {tab === 'security' && (
            <div className="space-y-6 animate-in slide-in-from-left pb-10">
               
               {/* Active Sessions */}
               <section className="space-y-3">
                  <h4 className="text-[#3390ec] font-bold text-xs uppercase tracking-widest px-1">نشست‌های فعال</h4>
                  <div className="bg-[#242f3d] rounded-2xl overflow-hidden border border-white/5">
                     <div className="p-4 border-b border-white/5 flex items-center gap-4">
                        <div className="w-10 h-10 bg-[#3390ec] rounded-full flex items-center justify-center"><Smartphone className="text-white"/></div>
                        <div className="flex-1">
                           <h5 className="font-bold text-white text-sm">دستگاه فعلی</h5>
                           <p className="text-[10px] text-green-400">آنلاین • {sessionInfo.browser} on {sessionInfo.os}</p>
                        </div>
                     </div>
                     <div className="w-full p-3 text-center text-[#708499] text-xs font-bold bg-[#17212b]">
                       سایر نشست‌ها وجود ندارد.
                     </div>
                  </div>
               </section>

               {/* Privacy */}
               <section className="space-y-2">
                  <h4 className="text-[#3390ec] font-bold text-xs uppercase tracking-widest px-1">حریم خصوصی</h4>
                  <SecurityItem 
                    icon={<Clock/>} 
                    label="آخرین بازدید و آنلاین" 
                    extra={user.privacy.showStatus === 'all' ? 'همه' : (user.privacy.showStatus === 'contacts' ? 'مخاطبین من' : 'هیچ‌کس')} 
                    onClick={() => togglePrivacy('showStatus')}
                  />
                  <SecurityItem 
                    icon={<Camera/>} 
                    label="تصویر پروفایل" 
                    extra={user.privacy.showAvatar === 'all' ? 'همه' : (user.privacy.showAvatar === 'contacts' ? 'مخاطبین من' : 'هیچ‌کس')} 
                    onClick={() => togglePrivacy('showAvatar')}
                  />
               </section>

               {/* Advanced Security */}
               <section className="space-y-2">
                  <h4 className="text-[#3390ec] font-bold text-xs uppercase tracking-widest px-1">امنیت پیشرفته</h4>
                  <SecurityItem 
                    icon={<QrCode/>} label="تأیید دو مرحله‌ای (2FA)" 
                    onClick={start2FASetup} 
                    extra={user.twoFactorEnabled ? 'فعال' : 'غیرفعال'} 
                    isActive={user.twoFactorEnabled}
                  />
                  <SecurityItem 
                    icon={<Lock/>} label="قفل برنامه (Passcode)" 
                    onClick={startPasscodeSetup} 
                    extra={user.passcode ? 'فعال' : 'غیرفعال'}
                    isActive={!!user.passcode}
                  />
               </section>

               <div className="pt-4">
                 <button onClick={() => { localStorage.removeItem('starly_session'); window.location.reload(); }} className="w-full py-4 bg-red-500/10 text-red-400 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all active:scale-95 border border-red-500/20">
                   <LogOut size={18}/> خروج از حساب
                 </button>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SecurityItem = ({icon, label, onClick, extra, isActive}: any) => (
  <div onClick={onClick} className="flex items-center justify-between p-4 bg-[#242f3d] rounded-2xl cursor-pointer hover:bg-[#2b3949] transition-all border border-white/5 group shadow-sm select-none">
    <div className="flex items-center gap-4">
      <span className={`transition-colors p-2 rounded-lg ${isActive ? 'bg-[#3390ec]/20 text-[#3390ec]' : 'bg-white/5 text-[#708499]'}`}>{icon}</span>
      <span className="text-sm font-medium text-white">{label}</span>
    </div>
    <div className="flex items-center gap-2">
      {extra && <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${isActive ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-[#708499]'}`}>{extra}</span>}
      <ChevronLeft size={16} className="text-[#708499] group-hover:translate-x-[-4px] transition-all"/>
    </div>
  </div>
);

export default SettingsModal;
