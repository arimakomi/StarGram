import React from 'react';
import { Story, User } from '../types';
import { Plus } from 'lucide-react';
import { generateLocalAvatarSvg } from '../services/avatarGenerator';

interface StoriesBarProps {
  stories: Story[];
  currentUser: User;
  onOpenCreateStory: () => void;
  onViewStory: (story: Story) => void;
  canCreateStory: boolean;
}

export const StoriesBar: React.FC<StoriesBarProps> = ({
  stories,
  currentUser,
  onOpenCreateStory,
  onViewStory,
  canCreateStory
}) => {
  // Filter active (unexpired) stories
  const now = Date.now();
  const activeStories = stories.filter(s => !s.expiresAt || s.expiresAt > now);

  // Group stories by userId (latest first)
  const userStoryMap = new Map<string, Story[]>();
  for (const s of activeStories) {
    const list = userStoryMap.get(s.userId) || [];
    list.push(s);
    userStoryMap.set(s.userId, list);
  }

  const userStoryGroups = Array.from(userStoryMap.entries()).map(([userId, list]) => {
    list.sort((a, b) => b.timestamp - a.timestamp);
    const latest = list[0];
    const isUnseen = list.some(s => !s.viewers.includes(currentUser.id));
    const isOwn = userId === currentUser.id;
    return { userId, latest, count: list.length, isUnseen, isOwn };
  });

  return (
    <div className="px-3 py-2 border-b border-[#242f3d] bg-[#0e1621]">
      <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5">
        {/* Current user Add Story button */}
        {canCreateStory && (
          <div 
            className="flex flex-col items-center shrink-0 cursor-pointer group select-none" 
            onClick={onOpenCreateStory}
            title="افزودن استوری جدید"
          >
            <div className="relative w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-[#3390ec] to-[#5288c1] group-hover:scale-105 transition-transform flex items-center justify-center">
              <img
                src={currentUser.avatar || generateLocalAvatarSvg(currentUser.displayName, currentUser.id)}
                alt={currentUser.displayName}
                className="w-full h-full rounded-full object-cover border-2 border-[#0e1621]"
              />
              <div className="absolute bottom-0 right-0 w-[18px] h-[18px] bg-[#3390ec] border-2 border-[#0e1621] rounded-full flex items-center justify-center text-white shadow-md group-hover:bg-[#5288c1] transition-colors">
                <Plus className="w-3 h-3 stroke-[3]" />
              </div>
            </div>
            <span className="text-[11px] text-gray-300 group-hover:text-white font-medium mt-1 truncate max-w-[56px] text-center leading-tight">
              استوری من
            </span>
          </div>
        )}

        {/* Other Users' Stories */}
        {userStoryGroups.map(({ userId, latest, count, isUnseen, isOwn }) => (
          <div
            key={userId}
            className="flex flex-col items-center shrink-0 cursor-pointer group select-none"
            onClick={() => onViewStory(latest)}
            title={`${latest.userName} (${count} استوری)`}
          >
            <div
              className={`w-12 h-12 rounded-full p-[2px] transition-transform group-hover:scale-105 flex items-center justify-center ${
                isUnseen
                  ? 'bg-gradient-to-tr from-[#f39c12] via-[#e74c3c] to-[#3390ec] shadow-sm'
                  : 'bg-white/20'
              }`}
            >
              <img
                src={latest.userAvatar || generateLocalAvatarSvg(latest.userName, userId)}
                alt={latest.userName}
                className="w-full h-full rounded-full object-cover border-2 border-[#0e1621]"
              />
            </div>
            <span className={`text-[11px] mt-1 truncate max-w-[56px] text-center leading-tight ${isUnseen ? 'text-white font-medium' : 'text-gray-400 group-hover:text-gray-200'}`}>
              {isOwn ? 'استوری من' : latest.userName.split(' ')[0]}
            </span>
          </div>
        ))}

        {userStoryGroups.length === 0 && !canCreateStory && (
          <div className="text-xs text-gray-500 py-2 px-3 text-center w-full">
            قابلیت استوری موقتاً توسط مدیر سیستم غیرفعال شده است.
          </div>
        )}
      </div>
    </div>
  );
};
