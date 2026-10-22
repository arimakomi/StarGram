import React, { useState, useEffect, useRef } from 'react';
import { Story, User } from '../types';
import { X, ChevronRight, ChevronLeft, Eye, Trash2, Clock, Pause, Play, Volume2, VolumeX } from 'lucide-react';

interface StoryViewerModalProps {
  initialStory: Story;
  allStories: Story[];
  currentUser: User;
  onClose: () => void;
  onStoryViewed: (storyId: string) => void;
  onDeleteStory: (storyId: string) => Promise<void>;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  initialStory,
  allStories,
  currentUser,
  onClose,
  onStoryViewed,
  onDeleteStory
}) => {
  const now = Date.now();
  const validStories = allStories.filter(s => !s.expiresAt || s.expiresAt > now);

  const initialIndex = validStories.findIndex(s => s.id === initialStory.id);
  const [currentIndex, setCurrentIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showViewers, setShowViewers] = useState(false);

  const currentStory = validStories[currentIndex] || initialStory;
  const isOwner = currentStory.userId === currentUser.id;
  const isSuperAdmin = currentUser.role === 'superadmin' || currentUser.role === 'admin';

  const isVideo = currentStory.mediaType === 'video' || 
    (typeof currentStory.mediaUrl === 'string' && currentStory.mediaUrl.startsWith('data:video/'));

  const videoRef = useRef<HTMLVideoElement>(null);

  // Mark viewed
  useEffect(() => {
    if (currentStory) {
      onStoryViewed(currentStory.id);
    }
    setProgress(0);
  }, [currentIndex, currentStory?.id]);

  // Video pause/play sync
  useEffect(() => {
    if (isVideo && videoRef.current) {
      if (isPaused) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isPaused, isVideo]);

  // Timer loop for non-video stories (5000ms total, updates every 50ms)
  useEffect(() => {
    if (isVideo || isPaused) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          if (currentIndex < validStories.length - 1) {
            setCurrentIndex(c => c + 1);
            return 0;
          } else {
            clearInterval(interval);
            onClose();
            return 100;
          }
        }
        return prev + 1;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [currentIndex, validStories.length, isPaused, isVideo]);

  const handleVideoTimeUpdate = () => {
    if (videoRef.current && videoRef.current.duration) {
      const current = videoRef.current.currentTime;
      const duration = videoRef.current.duration;
      setProgress((current / duration) * 100);
    }
  };

  const handleVideoEnded = () => {
    handleNext();
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(c => c - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < validStories.length - 1) {
      setCurrentIndex(c => c + 1);
    } else {
      onClose();
    }
  };

  const handleDelete = async () => {
    if (confirm('آیا از حذف این استوری اطمینان دارید؟')) {
      await onDeleteStory(currentStory.id);
      if (validStories.length <= 1) {
        onClose();
      } else {
        handleNext();
      }
    }
  };

  const formatStoryTime = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 60000);
    if (diff < 1) return 'هم‌اکنون';
    if (diff < 60) return `${diff} دقیقه پیش`;
    const hours = Math.floor(diff / 60);
    return `${hours} ساعت پیش`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-2 sm:p-4 select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm sm:max-w-md h-[88vh] max-h-[820px] bg-[#111827] rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-white/10">
        
        {/* Progress Bars */}
        <div className="absolute top-2 inset-x-3 z-30 flex items-center gap-1.5" dir="ltr">
          {validStories.map((s, idx) => (
            <div key={s.id} className="h-1 flex-1 bg-white/25 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-75"
                style={{
                  width:
                    idx < currentIndex
                      ? '100%'
                      : idx === currentIndex
                      ? `${progress}%`
                      : '0%'
                }}
              />
            </div>
          ))}
        </div>

        {/* Top Header */}
        <div className="absolute top-5 inset-x-3 z-30 flex items-center justify-between text-white drop-shadow-md" dir="rtl">
          <div className="flex items-center gap-2.5">
            <img
              src={currentStory.userAvatar}
              alt={currentStory.userName}
              className="w-9 h-9 rounded-full object-cover border border-white/60 shadow-sm"
            />
            <div>
              <p className="text-xs font-semibold leading-tight">{currentStory.userName}</p>
              <p className="text-[10px] text-white/70">{formatStoryTime(currentStory.timestamp)}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {isVideo && (
              <button
                onClick={() => setIsMuted(m => !m)}
                className="p-1.5 text-white/80 hover:text-white rounded-full transition-colors"
                title={isMuted ? 'روشن کردن صدا' : 'قطع صدا'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={() => setIsPaused(p => !p)}
              className="p-1.5 text-white/80 hover:text-white rounded-full transition-colors"
              title={isPaused ? 'ادامه' : 'توقف'}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            {(isOwner || isSuperAdmin) && (
              <button
                onClick={handleDelete}
                className="p-1.5 text-rose-400 hover:text-rose-300 rounded-full transition-colors"
                title="حذف استوری"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Media Container with touch / click navigation */}
        <div 
          className="relative flex-1 bg-black flex items-center justify-center overflow-hidden cursor-pointer"
          onMouseDown={() => setIsPaused(true)}
          onMouseUp={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          {isVideo ? (
            <video
              ref={videoRef}
              src={currentStory.mediaUrl}
              autoPlay
              playsInline
              muted={isMuted}
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={handleVideoEnded}
              className="w-full h-full object-contain"
            />
          ) : (
            <img
              src={currentStory.mediaUrl}
              alt={currentStory.caption || 'استوری'}
              className="w-full h-full object-contain"
            />
          )}

          {/* Left / Right click zones */}
          <div
            className="absolute inset-y-0 right-0 w-1/3 z-10"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
          />
          <div
            className="absolute inset-y-0 left-0 w-1/3 z-10"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
          />
        </div>

        {/* Caption & Bottom Bar */}
        <div className="absolute bottom-0 inset-x-0 z-30 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent text-white" dir="rtl">
          {currentStory.caption && (
            <p className="text-sm font-medium leading-relaxed drop-shadow-md mb-2 text-center break-words px-2">
              {currentStory.caption}
            </p>
          )}

          {/* Viewer info for owner */}
          {isOwner && (
            <div className="flex items-center justify-between text-xs text-white/75 pt-2 border-t border-white/10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowViewers(v => !v);
                }}
                className="flex items-center gap-1.5 hover:text-white transition-colors"
              >
                <Eye className="w-4 h-4 text-cyan-400" />
                <span>{currentStory.viewers.length} بازدیدکننده</span>
              </button>
              <span className="text-[11px] text-white/60">
                منقضی در {Math.max(1, Math.round(((currentStory.expiresAt || 0) - Date.now()) / 3600000))} ساعت
              </span>
            </div>
          )}

          {/* Viewers modal popup */}
          {showViewers && isOwner && (
            <div
              className="mt-2 bg-[#17212b] border border-white/10 rounded-xl p-3 max-h-36 overflow-y-auto text-xs space-y-1.5 shadow-xl animate-in slide-in-from-bottom-2 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center pb-1 border-b border-gray-700/50">
                <span className="font-semibold text-white">بینندگان استوری</span>
                <button onClick={() => setShowViewers(false)} className="text-gray-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {currentStory.viewers.length === 0 ? (
                <p className="text-gray-400 py-1">هنوز بازدیدی ثبت نشده است.</p>
              ) : (
                currentStory.viewers.map(uid => (
                  <div key={uid} className="flex items-center gap-2 py-0.5 text-gray-200">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span>شناسه کاربر: {uid}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
