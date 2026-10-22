import React, { useState } from 'react';
import { Send, User as UserIcon, Lock, ArrowLeft, Loader2 } from 'lucide-react';
import { doc, getDoc, setDoc, db } from '../services/firebase';
import { User, DEFAULT_AVATAR } from '../types';

import { generateLocalAvatarSvg } from '../services/avatarGenerator';

interface LoginProps {
  onLogin: (userData: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [step, setStep] = useState<'username' | 'password' | 'register'>('username');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const proceedToPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().toLowerCase();
    if (cleanUser.length < 3) return setError('نام کاربری باید حداقل ۳ حرف باشد');
    
    setIsLoading(true);
    try {
      const userRef = doc(db, "users", cleanUser);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        setStep('password');
      } else {
        setStep('register');
      }
      setError('');
    } catch (err) {
      console.error(err);
      setError('خطا در دسترسی به داده‌ها.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuth = async (action: 'login' | 'register') => {
    setIsLoading(true);
    setError('');
    const cleanUser = username.trim().toLowerCase();

    try {
      const userRef = doc(db, "users", cleanUser);

      if (action === 'register') {
        const newUser: User = {
          id: cleanUser,
          username: cleanUser,
          displayName: displayName || cleanUser,
          password: password, // In-memory/localStorage encrypted app
          avatar: generateLocalAvatarSvg(displayName || cleanUser, cleanUser),
          status: 'online',
          role: cleanUser === 'support' ? 'superadmin' : 'user',
          phone: `+98 912 ${Math.floor(1000000 + Math.random() * 9000000)}`,
          theme: 'night',
          wallpaper: 'default',
          privacy: { showStatus: 'all', showAvatar: 'all' }
        };
        
        // Save to Firestore
        await setDoc(userRef, newUser);
        
        localStorage.setItem('starly_session_cloud', JSON.stringify(newUser));
        onLogin(newUser);
      } else {
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data() as User;
          if (userData.password === password) {
            // Check ban status
            if (userData.isBanned) {
              if (userData.bannedUntil && userData.bannedUntil < Date.now()) {
                userData.isBanned = false;
                userData.bannedUntil = undefined;
                await setDoc(userRef, userData);
              } else {
                setError(userData.banReason ? `حساب شما مسدود است: ${userData.banReason}` : 'حساب کاربری شما مسدود شده است.');
                return;
              }
            }
            localStorage.setItem('starly_session_cloud', JSON.stringify(userData));
            onLogin(userData);
          } else {
            setError('رمز عبور اشتباه است.');
          }
        } else {
          setError('حساب کاربری یافت نشد.');
          setStep('register');
        }
      }
    } catch (err) {
      console.error(err);
      setError('خطای سیستمی رخ داد.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 'username') {
       proceedToPassword(e);
    } else if (step === 'password') {
       handleAuth('login');
    } else if (step === 'register') {
       if (!displayName) return setError('نام نمایشی الزامی است');
       handleAuth('register');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0e1621] p-6 text-white overflow-hidden font-['Vazirmatn']" dir="rtl">
      <div className="w-full max-w-sm space-y-8 animate-in">
        <div className="text-center">
          <div className="w-20 h-20 bg-[#3390ec] rounded-[28px] mx-auto mb-6 flex items-center justify-center shadow-2xl rotate-3 transform hover:rotate-0 transition-transform">
            <Send size={40} className="text-white -translate-x-1" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">استارلی چت</h1>
          <p className="text-[#708499] text-sm">پیام‌رسان آنلاین (Cloud Based)</p>
        </div>

        <div className="bg-[#17212b] p-8 rounded-3xl border border-white/5 shadow-2xl relative">
          {step !== 'username' && (
            <button onClick={() => { setStep('username'); setError(''); }} className="absolute top-4 left-4 p-2 hover:bg-white/5 rounded-full transition-colors text-[#708499]"><ArrowLeft size={18}/></button>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {step === 'username' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#3390ec] uppercase ml-1">نام کاربری</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-3.5 text-[#708499]" size={20} />
                    <input 
                      value={username} onChange={e=>setUsername(e.target.value)}
                      placeholder="نام کاربری خود را وارد کنید..." 
                      className="w-full bg-[#242f3d] py-3.5 pl-11 pr-4 rounded-xl outline-none border border-transparent focus:border-[#3390ec] transition-all text-left placeholder:text-right"
                      autoFocus
                      dir="ltr"
                    />
                  </div>
                </div>
                <button type="submit" disabled={isLoading} className="w-full py-4 bg-[#3390ec] rounded-xl font-bold hover:bg-[#2881d9] active:scale-95 transition-all shadow-lg shadow-[#3390ec]/20 flex items-center justify-center gap-2">
                  {isLoading && <Loader2 className="animate-spin" size={20}/>}
                  مرحله بعد
                </button>
              </div>
            )}

            {(step === 'password' || step === 'register') && (
              <div className="space-y-4 animate-in">
                {step === 'register' && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[#3390ec] uppercase ml-1">نام نمایشی (در چت)</label>
                    <input 
                      value={displayName} onChange={e=>setDisplayName(e.target.value)}
                      placeholder="مثال: علی محمدی" 
                      className="w-full bg-[#242f3d] py-3.5 px-4 rounded-xl outline-none border border-transparent focus:border-[#3390ec] transition-all"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#3390ec] uppercase ml-1">رمز عبور</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 text-[#708499]" size={20} />
                    <input 
                      type="password" value={password} onChange={e=>setPassword(e.target.value)}
                      placeholder={step === 'register' ? 'یک رمز عبور انتخاب کنید...' : 'رمز عبور خود را وارد کنید...'} 
                      className="w-full bg-[#242f3d] py-3.5 pl-11 pr-4 rounded-xl outline-none border border-transparent focus:border-[#3390ec] transition-all text-left placeholder:text-right"
                      autoFocus
                      dir="ltr"
                    />
                  </div>
                </div>
                <button type="submit" disabled={isLoading} className="w-full py-4 bg-[#3390ec] rounded-xl font-bold hover:bg-[#2881d9] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait">
                  {isLoading && <Loader2 className="animate-spin" size={20}/>}
                  {step === 'password' ? 'ورود به حساب' : 'ایجاد حساب کاربری'}
                </button>
              </div>
            )}

            {error && <p className="text-red-400 text-xs text-center font-medium bg-red-400/10 p-2 rounded-lg border border-red-400/20">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;