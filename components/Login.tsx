import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, User as UserIcon, Lock, ArrowLeft, Loader2, Phone, 
  Smartphone, CheckCircle, RefreshCw, Sparkles, AlertCircle
} from 'lucide-react';
import { authApi } from '../services/auth';
import { User, DEFAULT_AVATAR, SystemConfig } from '../types';
import { generateLocalAvatarSvg } from '../services/avatarGenerator';
import { StarChatLogo } from './StarChatLogo';
import { cleanIranPhone, isValidIranPhone, sanitizeOtpCode, isValidOtpCode } from '../services/otpUtils';

interface LoginProps {
  onLogin: (userData: User) => void | Promise<void>;
  systemConfig?: SystemConfig;
}

export const Login: React.FC<LoginProps> = ({ onLogin, systemConfig }) => {
  const isOtpEnabled = systemConfig?.smsOtpEnabled !== false;

  // Login Mode: 'credentials' (ID + Password) or 'otp' (Phone + SMS OTP)
  const [loginMode, setLoginMode] = useState<'credentials' | 'otp'>('credentials');

  useEffect(() => {
    if (!isOtpEnabled && loginMode === 'otp') {
      setLoginMode('credentials');
    }
  }, [isOtpEnabled, loginMode]);

  // Credentials Mode State
  const [credStep, setCredStep] = useState<'username' | 'password' | 'register'>('username');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  // OTP Mode State
  const [otpStep, setOtpStep] = useState<'phone' | 'code' | 'complete_profile'>('phone');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpUsername, setOtpUsername] = useState('');
  const [otpDisplayName, setOtpDisplayName] = useState('');
  const [simulatedCode, setSimulatedCode] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const expectedOtpLength = systemConfig?.otpCodeLength === 5 ? 5 : 6;

  // General State
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Countdown timer for OTP
  useEffect(() => {
    if (timerSeconds <= 0) return;
    const interval = setInterval(() => {
      setTimerSeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerSeconds]);

  // --- 1. CREDENTIALS FLOW (ID + Password only) ---
  const proceedToPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().toLowerCase();
    if (cleanUser.length < 3) return setError('نام کاربری باید حداقل ۳ حرف باشد');

    setIsLoading(true);
    setError('');
    try {
      const exists = await authApi.exists(cleanUser);
      setCredStep(exists ? 'password' : 'register');
    } catch (err) {
      console.error(err);
      setError('خطا در دسترسی به داده‌ها.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCredentialsAuth = async (action: 'login' | 'register') => {
    setIsLoading(true);
    setError('');
    const cleanUser = username.trim().toLowerCase();

    try {
      const r = action === 'register'
        ? await authApi.register(cleanUser, password, displayName || cleanUser, generateLocalAvatarSvg(displayName || cleanUser, cleanUser))
        : await authApi.login(cleanUser, password);
      if (!r.success) {
        setError(r.message || 'خطا در ورود. دوباره تلاش کنید.');
        return;
      }
      const user: User = { 
        ...r.user, 
        avatar: r.user.avatar || generateLocalAvatarSvg(r.user.displayName || cleanUser, r.user.id) 
      };
      localStorage.setItem('starly_session_cloud', JSON.stringify(user));
      await onLogin(user);
    } catch (err) {
      console.error(err);
      setError('خطای سیستمی رخ داد.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- 2. OTP FLOW (Mobile Phone + SMS only) ---
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const normalized = cleanIranPhone(phone);
    if (!isValidIranPhone(normalized)) {
      return setError('شماره همراه نامعتبر است (مثال: 09123456789)');
    }

    setIsLoading(true);
    setError('');
    setSuccessMsg('');
    setSimulatedCode(null);

    try {
      const res = await authApi.sendOtp(normalized, 'login');
      if (!res.success) {
        setError(res.message || 'خطا در ارسال کد تایید');
        return;
      }

      setPhone(normalized);
      setOtpStep('code');
      setTimerSeconds(Number(res.expiresInSeconds) || (Number(systemConfig?.otpExpiresInMinutes || 2) * 60));
      if (res.simulated && res.simulatedOtp) {
        setSimulatedCode(String(res.simulatedOtp));
        setOtpCode(String(res.simulatedOtp));
      } else {
        setOtpCode('');
      }
      setSuccessMsg(res.message || 'کد تایید با موفقیت ارسال شد.');
    } catch (err) {
      console.error(err);
      setError('خطا در ارتباط با سرور.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = cleanIranPhone(phone);
    const cleanCode = sanitizeOtpCode(otpCode, expectedOtpLength);

    if (!isValidOtpCode(cleanCode)) {
      return setError(`کد تایید ${expectedOtpLength} رقمی را به طور کامل وارد کنید`);
    }

    setIsLoading(true);
    setError('');

    try {
      const payload: any = {
        phone: normalized,
        code: cleanCode,
        purpose: 'login'
      };

      if (otpStep === 'complete_profile') {
        const cUser = otpUsername.trim().toLowerCase();
        if (cUser.length < 3) {
          setIsLoading(false);
          return setError('نام کاربری باید حداقل ۳ کاراکتر باشد');
        }
        payload.username = cUser;
        payload.displayName = otpDisplayName.trim() || cUser;
      }

      const res = await authApi.verifyOtp(payload);

      if (!res.success) {
        setError(res.message || 'کد تایید اشتباه است.');
        return;
      }

      if (res.isNewUser) {
        // Phone is verified, user does not exist yet -> prompt for username and display name
        setOtpStep('complete_profile');
        setSuccessMsg('شماره تایید شد. لطفاً نام و نام کاربری دلخواه خود را وارد نمایید.');
        return;
      }

      // Successful login
      const user: User = { 
        ...res.user, 
        avatar: res.user.avatar || generateLocalAvatarSvg(res.user.displayName || res.user.username, res.user.id) 
      };
      localStorage.setItem('starly_session_cloud', JSON.stringify(user));
      await onLogin(user);
    } catch (err) {
      console.error(err);
      setError('خطای سیستمی رخ داد.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetAll = () => {
    setError('');
    setSuccessMsg('');
    setSimulatedCode(null);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0e1621] p-6 text-white overflow-hidden font-['Vazirmatn']" dir="rtl">
      <div className="w-full max-w-sm space-y-6 animate-in">
        
        {/* App Branding Header */}
        <div className="text-center flex flex-col items-center">
          <div className="relative mb-2 group cursor-pointer w-full flex items-center justify-center">
            <div className="absolute -inset-6 bg-gradient-to-r from-red-500/20 via-[#3390ec]/25 to-blue-600/20 rounded-full blur-2xl opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <StarChatLogo 
              variant="full" 
              height={170} 
              src={systemConfig?.customLogoUrl}
              className="relative max-w-full transform hover:scale-105 transition-transform drop-shadow-xl" 
            />
          </div>
          <h1 className="text-2xl font-black tracking-tight mb-1 text-white">{systemConfig?.appName || 'استارلی چت'}</h1>
          <p className="text-[#708499] text-xs">{systemConfig?.appSlogan || 'پیام‌رسان ابری، امن و پرسرعت'}</p>
        </div>

        {/* Main Auth Card */}
        <div className="bg-[#17212b] p-7 rounded-3xl border border-white/5 shadow-2xl relative">
          
          {/* Back Button for sub-steps */}
          {((loginMode === 'credentials' && credStep !== 'username') || 
            (loginMode === 'otp' && otpStep !== 'phone')) && (
            <button 
              onClick={() => {
                if (loginMode === 'credentials') {
                  setCredStep('username');
                } else {
                  setOtpStep('phone');
                }
                resetAll();
              }} 
              className="absolute top-4 left-4 p-2 hover:bg-white/5 rounded-full transition-colors text-[#708499]"
              title="بازگشت"
            >
              <ArrowLeft size={18}/>
            </button>
          )}

          {/* Mode Switcher Tabs (Only at step 0 and when OTP is enabled in systemConfig) */}
          {isOtpEnabled && ((loginMode === 'credentials' && credStep === 'username') || 
            (loginMode === 'otp' && otpStep === 'phone')) && (
            <div className="grid grid-cols-2 p-1 bg-[#0e1621] rounded-2xl mb-6 border border-white/5 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setLoginMode('credentials');
                  resetAll();
                }}
                className={`py-2.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  loginMode === 'credentials' 
                    ? 'bg-[#3390ec] text-white shadow-md' 
                    : 'text-[#708499] hover:text-white'
                }`}
              >
                <UserIcon size={14} />
                <span>نام کاربری و رمز</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginMode('otp');
                  resetAll();
                }}
                className={`py-2.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  loginMode === 'otp' 
                    ? 'bg-[#3390ec] text-white shadow-md' 
                    : 'text-[#708499] hover:text-white'
                }`}
              >
                <Phone size={14} />
                <span>شماره موبایل</span>
              </button>
            </div>
          )}

          {/* ═══════════ TAB 1: CREDENTIALS (ID + PASSWORD) ═══════════ */}
          {loginMode === 'credentials' && (
            <form onSubmit={e => {
              e.preventDefault();
              if (credStep === 'username') proceedToPassword(e);
              else if (credStep === 'password') handleCredentialsAuth('login');
              else if (credStep === 'register') {
                if (!displayName.trim()) return setError('نام نمایشی الزامی است');
                handleCredentialsAuth('register');
              }
            }} className="space-y-5">
              
              {credStep === 'username' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[#3390ec] uppercase ml-1">نام کاربری (شناسه)</label>
                    <div className="relative">
                      <UserIcon className="absolute left-3.5 top-3.5 text-[#708499]" size={18} />
                      <input 
                        value={username} 
                        onChange={e => setUsername(e.target.value)}
                        placeholder="نام کاربری..." 
                        className="w-full bg-[#242f3d] py-3 pl-11 pr-4 rounded-xl outline-none border border-transparent focus:border-[#3390ec] transition-all text-left placeholder:text-right text-sm"
                        autoFocus
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isLoading} 
                    className="w-full py-3.5 bg-[#3390ec] rounded-xl font-bold hover:bg-[#2881d9] active:scale-95 transition-all shadow-lg shadow-[#3390ec]/20 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                  >
                    {isLoading && <Loader2 className="animate-spin" size={18}/>}
                    مرحله بعد
                  </button>
                </div>
              )}

              {(credStep === 'password' || credStep === 'register') && (
                <div className="space-y-4 animate-in">
                  {credStep === 'register' && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-[#3390ec] uppercase ml-1">نام نمایشی (در چت)</label>
                      <input 
                        value={displayName} 
                        onChange={e => setDisplayName(e.target.value)}
                        placeholder="مثال: علی محمدی" 
                        className="w-full bg-[#242f3d] py-3 px-4 rounded-xl outline-none border border-transparent focus:border-[#3390ec] transition-all text-sm"
                        autoFocus
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[#3390ec] uppercase ml-1">رمز عبور</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 text-[#708499]" size={18} />
                      <input 
                        type="password" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)}
                        placeholder={credStep === 'register' ? 'یک رمز عبور انتخاب کنید...' : 'رمز عبور...'} 
                        className="w-full bg-[#242f3d] py-3 pl-11 pr-4 rounded-xl outline-none border border-transparent focus:border-[#3390ec] transition-all text-left placeholder:text-right text-sm"
                        autoFocus={credStep === 'password'}
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isLoading} 
                    className="w-full py-3.5 bg-[#3390ec] rounded-xl font-bold hover:bg-[#2881d9] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 text-sm shadow-lg shadow-[#3390ec]/20"
                  >
                    {isLoading && <Loader2 className="animate-spin" size={18}/>}
                    {credStep === 'password' ? 'ورود به حساب' : 'ایجاد حساب کاربری'}
                  </button>
                </div>
              )}
            </form>
          )}

          {/* ═══════════ TAB 2: MOBILE OTP (IRAN PAYAMAK) ═══════════ */}
          {loginMode === 'otp' && (
            <div className="space-y-5 animate-in">
              {otpStep === 'phone' && (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-[11px] font-bold text-[#3390ec] uppercase">شماره تلفن همراه</label>
                      <span className="text-[10px] text-[#708499]">فرمت ایران (۰۹xxxxxxxxx)</span>
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-3.5 text-[#708499]" size={18} />
                      <input 
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="09123456789"
                        className="w-full bg-[#242f3d] py-3 pl-11 pr-4 rounded-xl outline-none border border-transparent focus:border-[#3390ec] transition-all text-left placeholder:text-right text-sm font-mono tracking-wider"
                        autoFocus
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-[#708499] leading-relaxed">
                    یک پیامک حاوی کد تایید یک‌بار مصرف به شماره همراه شما ارسال خواهد شد.
                  </p>

                  <button 
                    type="submit" 
                    disabled={isLoading} 
                    className="w-full py-3.5 bg-[#3390ec] rounded-xl font-bold hover:bg-[#2881d9] active:scale-95 transition-all shadow-lg shadow-[#3390ec]/20 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                  >
                    {isLoading && <Loader2 className="animate-spin" size={18}/>}
                    دریافت کد تایید پیامکی
                  </button>
                </form>
              )}

              {otpStep === 'code' && (
                <form onSubmit={handleVerifyOtp} className="space-y-4 animate-in">
                  <div className="p-3 bg-[#0e1621] rounded-2xl border border-white/5 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-[#708499] block">کد به شماره زیر ارسال شد:</span>
                      <span className="font-mono font-bold text-white text-sm" dir="ltr">{cleanIranPhone(phone)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setOtpStep('phone'); resetAll(); }}
                      className="text-[#3390ec] hover:underline text-[11px] font-bold"
                    >
                      ویرایش شماره
                    </button>
                  </div>

                  {simulatedCode && (
                    <div 
                      data-testid="login-simulated-otp-box"
                      onClick={() => setOtpCode(simulatedCode)}
                      className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center justify-between animate-in cursor-pointer hover:bg-emerald-500/20 transition-colors"
                      title="کلیک برای درج خودکار کد"
                    >
                      <span>کد آزمایشی (شبیه‌ساز پیامک):</span>
                      <span data-testid="login-simulated-otp-code" className="font-mono font-black text-sm bg-black/40 px-2.5 py-0.5 rounded-lg text-white" dir="ltr">{simulatedCode}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[#3390ec] uppercase ml-1">کد {expectedOtpLength === 5 ? '۵' : '۶'} رقمی دریافتی</label>
                    <input 
                      data-testid="login-otp-code-input"
                      type="text" 
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={otpCode} 
                      onChange={e => setOtpCode(sanitizeOtpCode(e.target.value, expectedOtpLength))}
                      placeholder={expectedOtpLength === 5 ? '-----' : '------'} 
                      maxLength={expectedOtpLength}
                      className="w-full bg-[#242f3d] py-3 px-4 rounded-xl outline-none border border-transparent focus:border-[#3390ec] transition-all text-center text-lg font-mono tracking-[0.5em] font-black text-white"
                      autoFocus
                      dir="ltr"
                    />
                  </div>

                  {/* Countdown Timer & Resend Button */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    {timerSeconds > 0 ? (
                      <span className="text-[#708499] text-[11px]">
                        امکان ارسال مجدد تا {Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, '0')} دیگر
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendOtp()}
                        className="text-[#3390ec] hover:underline text-[11px] font-bold flex items-center gap-1"
                      >
                        <RefreshCw size={12} />
                        <span>ارسال مجدد پیامک کد</span>
                      </button>
                    )}
                  </div>

                  <button 
                    data-testid="login-otp-verify-btn"
                    type="submit" 
                    disabled={isLoading || !isValidOtpCode(otpCode, expectedOtpLength)} 
                    className="w-full py-3.5 bg-[#3390ec] rounded-xl font-bold hover:bg-[#2881d9] active:scale-95 transition-all shadow-lg shadow-[#3390ec]/20 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                  >
                    {isLoading && <Loader2 className="animate-spin" size={18}/>}
                    تایید و ورود
                  </button>
                </form>
              )}

              {otpStep === 'complete_profile' && (
                <form onSubmit={handleVerifyOtp} className="space-y-4 animate-in">
                  <div className="p-3 bg-[#3390ec]/15 border border-[#3390ec]/30 rounded-2xl text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-[#3390ec]">
                      <Sparkles size={15} />
                      <span>خوش آمدید! ثبت‌نام حساب جدید</span>
                    </div>
                    <p className="text-[11px] text-[#708499]">
                      این شماره همراه برای اولین بار است که وارد می‌شود. لطفاً نام و نام کاربری دلخواه خود را مشخص فرمایید:
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[#3390ec] uppercase ml-1">نام و نام خانوادگی (نمایشی)</label>
                    <input 
                      value={otpDisplayName} 
                      onChange={e => setOtpDisplayName(e.target.value)}
                      placeholder="مثال: رضا صادقی" 
                      className="w-full bg-[#242f3d] py-3 px-4 rounded-xl outline-none border border-transparent focus:border-[#3390ec] transition-all text-sm"
                      autoFocus
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[#3390ec] uppercase ml-1">نام کاربری دلخواه (انگلیسی)</label>
                    <div className="relative">
                      <UserIcon className="absolute left-3.5 top-3.5 text-[#708499]" size={18} />
                      <input 
                        value={otpUsername} 
                        onChange={e => setOtpUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                        placeholder="reza_sadeghi" 
                        className="w-full bg-[#242f3d] py-3 pl-11 pr-4 rounded-xl outline-none border border-transparent focus:border-[#3390ec] transition-all text-left placeholder:text-right text-sm font-mono"
                        dir="ltr"
                        required
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isLoading} 
                    className="w-full py-3.5 bg-[#3390ec] rounded-xl font-bold hover:bg-[#2881d9] active:scale-95 transition-all shadow-lg shadow-[#3390ec]/20 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                  >
                    {isLoading && <Loader2 className="animate-spin" size={18}/>}
                    تکمیل ثبت‌نام و ورود به چت
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Feedback messages */}
          {successMsg && (
            <p className="mt-4 text-emerald-400 text-xs text-center font-medium bg-emerald-400/10 p-2.5 rounded-xl border border-emerald-400/20 animate-in">
              {successMsg}
            </p>
          )}
          {error && (
            <p className="mt-4 text-red-400 text-xs text-center font-medium bg-red-400/10 p-2.5 rounded-xl border border-red-400/20 animate-in flex items-center justify-center gap-1.5">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </p>
          )}

        </div>
      </div>
    </div>
  );
};

export default Login;