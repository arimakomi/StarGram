import React, { useState, useRef } from 'react';
import { User } from '../types';
import { 
  X, Camera, User as UserIcon, Phone, AtSign, Info, 
  Check, Shield, Sparkles, RefreshCw, Image as ImageIcon, FileText, Mic,
  Calendar, Send, Instagram
} from 'lucide-react';
import { compressImage } from '../services/imageUtils';
import { generateLocalAvatarSvg } from '../services/avatarGenerator';

interface MyProfileModalProps {
  user: User;
  onClose: () => void;
  onUpdateUser: (updatedUser: Partial<User>) => Promise<void>;
}

export const MyProfileModal: React.FC<MyProfileModalProps> = ({ user, onClose, onUpdateUser }) => {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [bio, setBio] = useState(user.bio || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [birthday, setBirthday] = useState(user.birthday || '');
  const [telegramId, setTelegramId] = useState(user.telegramId || '');
  const [instagramId, setInstagramId] = useState(user.instagramId || '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [activeTab, setActiveTab] = useState<'media' | 'files' | 'voice'>('media');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    setIsSaving(true);
    try {
      await onUpdateUser({
        displayName: displayName.trim(),
        bio: bio.trim(),
        phone: phone.trim(),
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
        className="w-full max-w-lg bg-[#17212b] text-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-[#242f3d]"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#242f3d] bg-[#0e1621]">
          <div className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-[#5288c1]" />
            <h2 className="text-lg font-semibold">پروفایل من</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#242f3d] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Avatar Area */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group cursor-pointer">
              <img
                src={avatar || user.avatar}
                alt={displayName}
                className="w-24 h-24 rounded-full object-cover border-3 border-[#5288c1] shadow-lg"
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
                className="text-xs text-[#5288c1] hover:underline flex items-center gap-1 bg-[#242f3d]/60 px-3 py-1.5 rounded-lg border border-[#2b5278]"
              >
                <Camera className="w-3.5 h-3.5" />
                بارگذاری تصویر
              </button>
              <button
                type="button"
                onClick={handleGenerateSvgAvatar}
                className="text-xs text-emerald-400 hover:underline flex items-center gap-1 bg-[#242f3d]/60 px-3 py-1.5 rounded-lg border border-[#2b5278]"
                title="تولید آواتار هنری جدید"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                آواتار تصادفی بومی
              </button>
            </div>

            {user.role === 'superadmin' && (
              <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1 mt-1">
                <Shield className="w-3 h-3" />
                مدیر ارشد سیستم
              </span>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">نام و نام خانوادگی</label>
              <div className="relative">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#242f3d] border border-[#2b5278]/40 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-hidden focus:border-[#5288c1] transition-colors pr-10"
                  required
                />
                <UserIcon className="w-4 h-4 text-gray-400 absolute right-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">نام کاربری</label>
              <div className="relative">
                <input
                  type="text"
                  value={user.username}
                  disabled
                  className="w-full bg-[#1b2531] border border-gray-700/50 rounded-xl px-4 py-2.5 text-gray-400 text-sm cursor-not-allowed pr-10"
                />
                <AtSign className="w-4 h-4 text-gray-500 absolute right-3.5 top-3" />
              </div>
              <p className="text-[11px] text-gray-500 mt-1">نام کاربری شناسه یکتای حساب شماست و قابل تغییر نیست.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">شماره تلفن</label>
              <div className="relative">
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+98 912 000 0000"
                  dir="ltr"
                  className="w-full bg-[#242f3d] border border-[#2b5278]/40 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-hidden focus:border-[#5288c1] transition-colors pl-10 text-right"
                />
                <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">بیوگرافی (درباره من)</label>
              <div className="relative">
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={2}
                  maxLength={120}
                  placeholder="چند کلمه درباره خودتان بنویسید..."
                  className="w-full bg-[#242f3d] border border-[#2b5278]/40 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-hidden focus:border-[#5288c1] transition-colors resize-none"
                />
              </div>
              <div className="flex justify-between text-[11px] text-gray-500 mt-0.5">
                <span>نمایش به سایر کاربران (اختیاری)</span>
                <span>{bio.length} / 120</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">شناسه تلگرام</label>
                <div className="relative">
                  <input
                    type="text"
                    value={telegramId}
                    onChange={(e) => setTelegramId(e.target.value)}
                    placeholder="username"
                    dir="ltr"
                    className="w-full bg-[#242f3d] border border-[#2b5278]/40 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-hidden focus:border-[#5288c1] transition-colors pl-9 text-left font-mono"
                  />
                  <Send className="w-4 h-4 text-[#3390ec] absolute left-3 top-3 -rotate-45" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">شناسه اینستاگرام</label>
                <div className="relative">
                  <input
                    type="text"
                    value={instagramId}
                    onChange={(e) => setInstagramId(e.target.value)}
                    placeholder="username"
                    dir="ltr"
                    className="w-full bg-[#242f3d] border border-[#2b5278]/40 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-hidden focus:border-[#5288c1] transition-colors pl-9 text-left font-mono"
                  />
                  <Instagram className="w-4 h-4 text-pink-400 absolute left-3 top-3" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">تاریخ تولد</label>
              <div className="relative">
                <input
                  type="text"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  placeholder="مثال: ۱۳۸۰/۰۶/۱۵ یا 2001-09-06"
                  dir="ltr"
                  className="w-full bg-[#242f3d] border border-[#2b5278]/40 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-hidden focus:border-[#5288c1] transition-colors pl-9 text-right"
                />
                <Calendar className="w-4 h-4 text-amber-400 absolute left-3 top-3" />
              </div>
              <p className="text-[11px] text-gray-500 mt-1">تنها در صورت پر شدن در پروفایل شما برای دیگران نمایش داده می‌شود.</p>
            </div>
          </div>

          {/* Media / Files Tabs Section */}
          <div className="pt-2 border-t border-[#242f3d]">
            <div className="flex items-center gap-2 mb-3 bg-[#0e1621] p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('media')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === 'media' ? 'bg-[#5288c1] text-white shadow-xs' : 'text-gray-400 hover:text-white'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                رسانه‌ها
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('files')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === 'files' ? 'bg-[#5288c1] text-white shadow-xs' : 'text-gray-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                اسناد
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('voice')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === 'voice' ? 'bg-[#5288c1] text-white shadow-xs' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                صوت‌ها
              </button>
            </div>

            <div className="bg-[#0e1621]/40 border border-[#242f3d] rounded-xl p-6 text-center text-xs text-gray-400">
              {activeTab === 'media' && <p>رسانه‌های ارسال شده در چت‌ها اینجا دسته‌بندی می‌شوند.</p>}
              {activeTab === 'files' && <p>فایل‌ها و اسناد مبادله شده اینجا لیست خواهند شد.</p>}
              {activeTab === 'voice' && <p>پیام‌های صوتی ضبط شده در اینجا نگهداری می‌شوند.</p>}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-[#5288c1] hover:bg-[#4375a8] text-white py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
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
              className="px-5 py-2.5 bg-[#242f3d] hover:bg-[#2b3a4a] text-gray-300 hover:text-white rounded-xl text-sm transition-colors"
            >
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
