import React, { useState, useRef } from 'react';
import { User } from '../types';
import { X, Image as ImageIcon, Video as VideoIcon, Send, Sparkles, Clock, Palette, AlertCircle, Play, Pause } from 'lucide-react';
import { compressImage } from '../services/imageUtils';

interface CreateStoryModalProps {
  currentUser: User;
  onClose: () => void;
  onSubmitStory: (
    mediaUrl: string, 
    caption: string, 
    durationHours: number, 
    mediaType?: 'image' | 'video' | 'text',
    durationSeconds?: number
  ) => Promise<void>;
}

const GRADIENT_PRESETS = [
  'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
  'linear-gradient(135deg, #134e5e 0%, #71b280 100%)',
  'linear-gradient(135deg, #4b1248 0%, #f0c27b 100%)',
  'linear-gradient(135deg, #09203f 0%, #537895 100%)',
  'linear-gradient(135deg, #232526 0%, #414345 100%)',
];

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({
  currentUser,
  onClose,
  onSubmitStory
}) => {
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [durationHours, setDurationHours] = useState<number>(24);
  const [selectedGradient, setSelectedGradient] = useState<string>(GRADIENT_PRESETS[0]);
  const [storyType, setStoryType] = useState<'image' | 'video' | 'text'>('image');
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoElementRef = useRef<HTMLVideoElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('فقط فایل‌های تصویری (JPG, PNG, WebP) مجاز هستند.');
      return;
    }

    try {
      const compressed = await compressImage(file, 800, 1200, 0.85);
      setMediaUrl(compressed);
      setStoryType('image');
    } catch (err) {
      console.error('Error compressing story image:', err);
      setErrorMsg('خطا در پردازش تصویر.');
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setErrorMsg('فقط فایل‌های ویدیویی (MP4, WebM) مجاز هستند.');
      return;
    }

    // Limit video file size to 25MB for smooth local storage
    if (file.size > 25 * 1024 * 1024) {
      setErrorMsg('حجم ویدیو نمی‌تواند بیش از ۲۵ مگابایت باشد.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.src = objectUrl;

    tempVideo.onloadedmetadata = () => {
      const duration = tempVideo.duration;
      if (duration > 30) {
        setErrorMsg(`مدت زمان ویدیو نمی‌تواند بیش از ۳۰ ثانیه باشد. (مدت این ویدیو: ${Math.round(duration)} ثانیه)`);
        URL.revokeObjectURL(objectUrl);
        return;
      }

      setVideoDuration(Math.round(duration) || 15);

      // Read as Base64 data URL
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        if (loadEvent.target?.result) {
          setMediaUrl(loadEvent.target.result as string);
          setStoryType('video');
        }
      };
      reader.onerror = () => {
        setErrorMsg('خطا در خواندن فایل ویدیویی.');
      };
      reader.readAsDataURL(file);
    };

    tempVideo.onerror = () => {
      setErrorMsg('فرمت ویدیویی انتخاب شده پشتیبانی نمی‌شود.');
      URL.revokeObjectURL(objectUrl);
    };
  };

  const generateTextCanvasImage = (): string => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1e3c72" />
          <stop offset="100%" stop-color="#2a5298" />
        </linearGradient>
      </defs>
      <rect width="600" height="900" fill="url(#bg)" />
      <text x="300" y="450" font-family="'Vazirmatn', sans-serif" font-size="28" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">
        ${caption || 'استوری جدید در استارلی'}
      </text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalMedia = mediaUrl;
    let actualType = storyType;
    let durationSec = storyType === 'video' ? (videoDuration || 15) : 5;

    if (storyType === 'text' || !finalMedia) {
      if (!caption.trim()) {
        setErrorMsg('لطفاً متن استوری را وارد کنید.');
        return;
      }
      finalMedia = generateTextCanvasImage();
      actualType = 'text';
    }

    setIsSubmitting(true);
    try {
      await onSubmitStory(finalMedia, caption.trim(), durationHours, actualType, durationSec);
      onClose();
    } catch (err) {
      console.error('Error publishing story:', err);
      setErrorMsg('خطا در انتشار استوری.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#17212b] text-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-[#242f3d]"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#242f3d] bg-[#0e1621]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-semibold">ایجاد استوری جدید</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#242f3d] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {/* Mode Switcher: Strictly Image, Video (<=30s), Text */}
          <div className="flex bg-[#0e1621] p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setStoryType('image');
                setErrorMsg('');
                if (!mediaUrl || storyType !== 'image') imageInputRef.current?.click();
              }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                storyType === 'image' ? 'bg-[#5288c1] text-white shadow-xs' : 'text-gray-400 hover:text-white'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              تصویر
            </button>
            <button
              type="button"
              onClick={() => {
                setStoryType('video');
                setErrorMsg('');
                if (!mediaUrl || storyType !== 'video') videoInputRef.current?.click();
              }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                storyType === 'video' ? 'bg-[#5288c1] text-white shadow-xs' : 'text-gray-400 hover:text-white'
              }`}
            >
              <VideoIcon className="w-3.5 h-3.5" />
              ویدیو (تا ۳۰ ثانیه)
            </button>
            <button
              type="button"
              onClick={() => {
                setStoryType('text');
                setErrorMsg('');
              }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                storyType === 'text' ? 'bg-[#5288c1] text-white shadow-xs' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              متن با گرادیان
            </button>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Preview Container */}
          <div className="relative aspect-9/13 max-h-[320px] rounded-xl overflow-hidden border border-[#2b5278]/40 bg-[#0e1621] flex items-center justify-center mx-auto w-full">
            {storyType === 'image' && mediaUrl ? (
              <img src={mediaUrl} alt="Story Preview" className="w-full h-full object-contain" />
            ) : storyType === 'video' && mediaUrl ? (
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                <video
                  ref={videoElementRef}
                  src={mediaUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (videoElementRef.current) {
                      if (videoElementRef.current.paused) {
                        videoElementRef.current.play();
                        setIsVideoPlaying(true);
                      } else {
                        videoElementRef.current.pause();
                        setIsVideoPlaying(false);
                      }
                    }
                  }}
                  className="absolute bottom-3 left-3 p-2 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
                >
                  {isVideoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <div className="absolute top-3 right-3 bg-black/70 px-2 py-0.5 rounded-full text-[10px] text-white tabular-nums border border-white/10">
                  {videoDuration} ثانیه
                </div>
              </div>
            ) : storyType === 'text' ? (
              <div
                className="w-full h-full flex flex-col items-center justify-center p-6 text-center"
                style={{ background: selectedGradient }}
              >
                <p className="text-base sm:text-lg font-bold text-white drop-shadow-md break-words max-w-full leading-relaxed">
                  {caption || 'متن استوری خود را در کادر زیر بنویسید...'}
                </p>
              </div>
            ) : (
              <div className="text-center p-6 space-y-2">
                {storyType === 'video' ? (
                  <>
                    <VideoIcon className="w-10 h-10 text-gray-500 mx-auto" />
                    <p className="text-xs text-gray-400">ویدیویی انتخاب نشده است</p>
                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      className="mt-2 text-xs bg-[#5288c1] hover:bg-[#4375a8] text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      انتخاب ویدیو (حداکثر ۳۰ ثانیه)
                    </button>
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-10 h-10 text-gray-500 mx-auto" />
                    <p className="text-xs text-gray-400">تصویری انتخاب نشده است</p>
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="mt-2 text-xs bg-[#5288c1] hover:bg-[#4375a8] text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      انتخاب تصویر (JPG, PNG)
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Hidden inputs strictly accepting images or videos */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleImageUpload}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm"
              className="hidden"
              onChange={handleVideoUpload}
            />
          </div>

          {/* Change Media Buttons */}
          {storyType === 'image' && mediaUrl && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="text-xs text-[#5288c1] hover:underline"
              >
                تغییر تصویر انتخابی
              </button>
            </div>
          )}

          {storyType === 'video' && mediaUrl && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="text-xs text-[#5288c1] hover:underline"
              >
                تغییر ویدیوی انتخابی
              </button>
            </div>
          )}

          {/* Preset Gradients (for text mode) */}
          {storyType === 'text' && (
            <div className="flex items-center gap-2 justify-center py-1">
              {GRADIENT_PRESETS.map((g, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedGradient(g)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${
                    selectedGradient === g ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ background: g }}
                />
              ))}
            </div>
          )}

          {/* Caption Field */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              {storyType === 'text' ? 'متن اصلی استوری' : 'توضیحات یا کپشن (اختیاری)'}
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="نوشتن پیام استوری..."
              className="w-full bg-[#242f3d] border border-[#2b5278]/40 rounded-xl px-4 py-2.5 text-white text-xs sm:text-sm focus:outline-hidden focus:border-[#5288c1] transition-colors"
              maxLength={150}
            />
          </div>

          {/* Expiration Duration */}
          <div className="flex items-center justify-between bg-[#0e1621] p-3 rounded-xl border border-[#242f3d]">
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <Clock className="w-4 h-4 text-[#5288c1]" />
              <span>مدت زمان نمایش:</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDurationHours(24)}
                className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                  durationHours === 24
                    ? 'bg-[#5288c1] text-white font-medium'
                    : 'text-gray-400 hover:text-white bg-[#242f3d]'
                }`}
              >
                ۲۴ ساعت
              </button>
              <button
                type="button"
                onClick={() => setDurationHours(48)}
                className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                  durationHours === 48
                    ? 'bg-[#5288c1] text-white font-medium'
                    : 'text-gray-400 hover:text-white bg-[#242f3d]'
                }`}
              >
                ۴۸ ساعت
              </button>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={isSubmitting || (storyType === 'text' && !caption.trim()) || ((storyType === 'image' || storyType === 'video') && !mediaUrl)}
              className="flex-1 bg-[#5288c1] hover:bg-[#4375a8] text-white py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 shadow-md disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'در حال ارسال...' : 'انتشار استوری'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-[#242f3d] hover:bg-[#2b3a4a] text-gray-300 hover:text-white rounded-xl text-xs sm:text-sm transition-colors"
            >
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
