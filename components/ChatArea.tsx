import { generateLocalAvatarSvg } from '../services/avatarGenerator';
import { GroupEditModal } from './GroupEditModal';
import { ChannelEditModal } from './ChannelEditModal';
import { StarChatLogo } from './StarChatLogo';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Chat, User, Message, Poll, DEFAULT_AVATAR, AdminPermissions, SystemConfig } from '../types';
import { 
  Send, Paperclip, Smile, MessageCircle, Trash, Mic, Info, X, 
  ChevronLeft, UserMinus, UserPlus, Image as ImageIcon, 
  Pin, Reply, BarChart2, Volume2, Square, Plus, CheckCheck, MoreVertical,
  Link as LinkIcon, Edit3, Shield, ShieldCheck, Copy, Users, Bookmark, RotateCcw, Clock, 
  ArrowRight, Search, Play, Pause, Download, Share2, Globe, Heart, ThumbsUp, Flame, Check,
  ZoomIn, ZoomOut, Phone, Bell, BellOff, Trash2, AtSign, FileText, CheckCircle2, Flag,
  Eye, Calendar, Instagram, Palette, CheckCircle, RefreshCw, Camera, AlertTriangle
} from 'lucide-react';
import { compressImage } from '../services/imageUtils';
import { validateFileSize, formatFileSize, normalizeMaxUploadMb } from '../services/fileUploadUtils';
import { encryptMessage } from '../services/cryptoUtils';
import { getUserPresence, formatSeenTime } from '../services/presenceUtils';
import { resolveWallpaperStyle, WALLPAPER_PRESETS } from '../services/wallpaperPresets';
import { APP_PREFERENCES_CHANGED, PREFERENCE_KEYS, readBooleanPreference } from '../services/appPreferences';
import {
  LONG_PRESS_DELAY_MS,
  shouldCancelLongPressOnMove,
  shouldCancelLongPressOnScroll,
  shouldSuppressClickAfterLongPress,
  shouldAllowContextMenuEvent,
  clampContextMenuPosition,
} from '../services/longPressUtils';

interface ChatAreaProps {
  chat: Chat | null;
  currentUser: User;
  isTyping: boolean;
  onAction: (action: string, payload: any) => void;
  onDeleteChat: () => void;
  onBack: () => void;
  onUsernameClick: (username: string) => void;
  onToggleContact?: (user: User) => void;
  chats?: Chat[];
  onOpenSavedMessages?: () => void;
  onReportMessage?: (message: Message) => void;
  systemConfig?: SystemConfig;
  highlightedMessageId?: string | null;
  onClearHighlightedMessage?: () => void;
}

const POPULAR_REACTIONS = ['❤️', '👍', '🔥', '😂', '👏', '🎉'];

const SENDER_NAME_COLORS = [
  '#faa774', // warm peach (like Baghani)
  '#a695e7', // purple (like Hosein Molaee)
  '#7bc862', // emerald green
  '#6ec9cb', // turquoise cyan
  '#e17076', // coral rose
  '#65aadd', // sky blue
  '#ee7aae'  // magenta pink
];

function getSenderColor(idOrName: string = ''): string {
  let hash = 0;
  for (let i = 0; i < idOrName.length; i++) {
    hash = (hash << 5) - hash + idOrName.charCodeAt(i);
    hash |= 0;
  }
  return SENDER_NAME_COLORS[Math.abs(hash) % SENDER_NAME_COLORS.length];
}

const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    name: 'لبخندها',
    icon: '😀',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥹', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🫢', '🫣', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '😵‍💫', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐']
  },
  {
    id: 'gestures',
    name: 'اشاره‌ها',
    icon: '👍',
    emojis: ['👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '🫵', '✋', '🤚', '🖐️', '🖖', '👋', '🤝', '👏', '🙌', '👐', '🤲', '🙏', '✍️', '💪', '🦾']
  },
  {
    id: 'hearts',
    name: 'قلب‌ها',
    icon: '❤️',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️']
  },
  {
    id: 'celebrate',
    name: 'جشن و نمادها',
    icon: '🔥',
    emojis: ['🔥', '✨', '🎉', '🎊', '🎁', '🎈', '⭐', '🌟', '💫', '💥', '💯', '💢', '💤', '👑', '🏆', '🥇', '🥈', '🥉', '🎯', '🚀', '⚡', '☀️', '🌙', '☁️', '☕', '🍕', '🍔', '🍟']
  }
];

const DEFAULT_ADMIN_PERMISSIONS: AdminPermissions = {
  canChangeInfo: true,
  canDeleteMessages: true,
  canBanUsers: true,
  canInviteUsers: true,
  canPinMessages: true,
  canAddAdmins: false
};


const ChatArea: React.FC<ChatAreaProps> = ({ 
  chat, currentUser, isTyping, onAction, onDeleteChat, onBack, onUsernameClick, onToggleContact,
  chats = [], onOpenSavedMessages, onReportMessage, systemConfig,
  highlightedMessageId, onClearHighlightedMessage
}) => {
  const [inputText, setInputText] = useState('');
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightedMessageId || !chat) return;
    setActiveHighlightId(highlightedMessageId);
    const scrollTimer = setTimeout(() => {
      const el = document.getElementById(highlightedMessageId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 80);
    const clearTimer = setTimeout(() => {
      setActiveHighlightId(null);
      if (onClearHighlightedMessage) onClearHighlightedMessage();
    }, 3200);
    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [highlightedMessageId, chat?.id]);
  const [showInfo, setShowInfo] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedEmojiTab, setSelectedEmojiTab] = useState('smileys');

  // Group / Channel Management Modals
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [showPhoneVerifyRequiredModal, setShowPhoneVerifyRequiredModal] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDesc, setEditGroupDesc] = useState('');
  const [editGroupAvatar, setEditGroupAvatar] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [editPublicHandle, setEditPublicHandle] = useState('');

  // Admin Permissions Management Modal
  const [managingAdminUser, setManagingAdminUser] = useState<User | null>(null);
  const [editingAdminPerms, setEditingAdminPerms] = useState<AdminPermissions>(DEFAULT_ADMIN_PERMISSIONS);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  // Message Forwarding Modal State
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [forwardSearch, setForwardSearch] = useState('');
  const [selectedForwardChatIds, setSelectedForwardChatIds] = useState<string[]>([]);
  const [forwardSuccessToast, setForwardSuccessToast] = useState<string | null>(null);
  
  // Right-Click & Mobile Long-Press Context Menu State
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [uploadErrorToast, setUploadErrorToast] = useState<string | null>(null);
  const uploadErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showUploadError = (msg: string) => {
    setUploadErrorToast(msg);
    if (uploadErrorTimerRef.current) clearTimeout(uploadErrorTimerRef.current);
    uploadErrorTimerRef.current = setTimeout(() => {
      setUploadErrorToast(null);
    }, 6000);
  };

  useEffect(() => {
    const handleServerUploadError = (e: Event) => {
      const customEvent = e as CustomEvent<{ message?: string }>;
      if (customEvent.detail?.message) {
        showUploadError(customEvent.detail.message);
      }
    };
    window.addEventListener('starly:upload-error', handleServerUploadError);
    return () => {
      window.removeEventListener('starly:upload-error', handleServerUploadError);
      if (uploadErrorTimerRef.current) clearTimeout(uploadErrorTimerRef.current);
    };
  }, []);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    message: Message;
    targetRect: {
      top: number;
      left: number;
      width: number;
      height: number;
      bottom: number;
      right: number;
    };
    placement: 'above' | 'below';
  } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const touchStartScrollTopRef = useRef<number | null>(null);
  const isTouchActiveRef = useRef<boolean>(false);
  const touchMovedRef = useRef<boolean>(false);
  const isLongPressActiveRef = useRef<boolean>(false);
  const isInitialLongPressTouchRef = useRef<boolean>(false);
  const lastLongPressTimeRef = useRef<number>(0);
  const messagesContainerRef = useRef<HTMLElement | null>(null);

  const cancelLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cancelLongPressTimer();
    };
  }, [chat?.id]);

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Poll Creation Modal
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollMultiple, setPollMultiple] = useState(false);

  // In-Chat Search State
  const [showSearch, setShowSearch] = useState(false);
  const [searchInChat, setSearchInChat] = useState('');

  // Media Lightbox & Interactive Zoom Suite
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Notifications Muted state per-chat
  const [isMuted, setIsMuted] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Private chat media tabs: 'photos' | 'voice' | 'links'
  const [privateMediaTab, setPrivateMediaTab] = useState<'photos' | 'voice' | 'links'>('photos');

  // Per-chat wallpaper modal & Group seen submenu state
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);
  const [showSeenSubmenu, setShowSeenSubmenu] = useState(false);
  const [customChatWallpaperUrl, setCustomChatWallpaperUrl] = useState('');
  const chatWallpaperFileRef = useRef<HTMLInputElement>(null);
  const drawerAvatarInputRef = useRef<HTMLInputElement>(null);
  const [isUpdatingDrawerAvatar, setIsUpdatingDrawerAvatar] = useState(false);

  const handleDrawerAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chat) return;
    const sizeCheck = validateFileSize(file.size, systemConfig?.maxUploadSizeMb);
    if (!sizeCheck.valid) {
      showUploadError(sizeCheck.message!);
      if (e.target) e.target.value = '';
      return;
    }
    try {
      setIsUpdatingDrawerAvatar(true);
      const compressed = await compressImage(file, 512, 512, 0.85);
      onAction('updateChatInfo', {
        groupName: chat.groupName,
        description: chat.description,
        groupAvatar: compressed,
        isPublic: chat.isPublic,
        publicHandle: chat.publicHandle,
        slowMode: chat.slowMode
      });
    } catch (err) {
      console.error('Failed to upload chat avatar from drawer:', err);
      showUploadError('خطا در پردازش و بارگذاری تصویر');
    } finally {
      setIsUpdatingDrawerAvatar(false);
      if (e.target) e.target.value = '';
    }
  };

  // Auto-mark unseen messages as seen by currentUser
  useEffect(() => {
    if (!chat || !currentUser || chat.type === 'saved') return;
    const unseenIds: string[] = [];
    (chat.messages || []).forEach(m => {
      if (m.senderId === currentUser.id) return;
      const seen = m.seenBy?.some(s => s.userId === currentUser.id);
      if (!seen) unseenIds.push(m.id);
    });
    if (unseenIds.length > 0) {
      onAction('markSeen', { messageIds: unseenIds });
    }
  }, [chat?.id, chat?.messages?.length, currentUser?.id]);

  const handleZoomIn = () => {
    setZoomScale(prev => Math.min(Number((prev + 0.35).toFixed(2)), 4));
  };

  const handleZoomOut = () => {
    setZoomScale(prev => {
      const next = Math.max(Number((prev - 0.35).toFixed(2)), 0.5);
      if (next <= 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleWheelZoom = (e: React.WheelEvent) => {
    e.stopPropagation();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const handleDoubleTapZoom = () => {
    if (zoomScale > 1) {
      handleResetZoom();
    } else {
      setZoomScale(2);
      setPanOffset({ x: 0, y: 0 });
    }
  };

  const handleZoomMouseDown = (e: React.MouseEvent) => {
    if (zoomScale <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...panOffset };
  };

  const handleZoomMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomScale <= 1) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPanOffset({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy
    });
  };

  const handleZoomMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomTouchStart = (e: React.TouchEvent) => {
    if (zoomScale <= 1 || e.touches.length !== 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    panStartRef.current = { ...panOffset };
  };

  const handleZoomTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || zoomScale <= 1 || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStartRef.current.x;
    const dy = e.touches[0].clientY - dragStartRef.current.y;
    setPanOffset({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy
    });
  };

  const handleZoomTouchEnd = () => {
    setIsDragging(false);
  };

  const handleCopyText = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Mention State
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStartIndex, setMentionStartIndex] = useState<number>(-1);

  // Reaction popover target
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);

  // Escape key handler: close inner overlays/dialogs or exit chat to main page
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxImage) { setLightboxImage(null); return; }
        if (showEmojiPicker) { setShowEmojiPicker(false); return; }
        if (contextMenu) { setContextMenu(null); return; }
        if (activeReactionMsgId) { setActiveReactionMsgId(null); return; }
        if (showPollModal) { setShowPollModal(false); return; }
        if (showWallpaperModal) { setShowWallpaperModal(false); return; }
        if (showSeenSubmenu) { setShowSeenSubmenu(false); return; }
        if (showEditGroupModal) { setShowEditGroupModal(false); return; }
        if (showInfo) { setShowInfo(false); return; }
        if (replyingTo) { setReplyingTo(null); return; }
        if (editingMessage) { setEditingMessage(null); return; }
        if (showSearch) { setShowSearch(false); return; }
        // If nothing local is open, back out of the chat
        onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    lightboxImage, showEmojiPicker, contextMenu, activeReactionMsgId,
    showPollModal, showWallpaperModal, showSeenSubmenu, showEditGroupModal, showInfo,
    replyingTo, editingMessage, showSearch, onBack
  ]);

  // Info Drawer Tab
  const [infoTab, setInfoTab] = useState<'members' | 'media'>('members');

  const msgEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<any>(null);
  const previousChatIdRef = useRef<string | null>(null);
  const [preferencesRevision, setPreferencesRevision] = useState(0);
  const [revealedImages, setRevealedImages] = useState<Set<string>>(() => new Set());

  const autoDownloadPhotos = readBooleanPreference(PREFERENCE_KEYS.autoDownloadPhotos);
  const autoDownloadVoice = readBooleanPreference(PREFERENCE_KEYS.autoDownloadVoice);

  useEffect(() => {
    const handlePreferencesChanged = () => setPreferencesRevision(revision => revision + 1);
    window.addEventListener(APP_PREFERENCES_CHANGED, handlePreferencesChanged);
    return () => window.removeEventListener(APP_PREFERENCES_CHANGED, handlePreferencesChanged);
  }, []);

  useEffect(() => {
    const chatChanged = previousChatIdRef.current !== (chat?.id || null);
    if (chatChanged || readBooleanPreference(PREFERENCE_KEYS.autoScroll)) {
      msgEndRef.current?.scrollIntoView({ behavior: chatChanged ? 'auto' : 'smooth' });
    }
    previousChatIdRef.current = chat?.id || null;
  }, [chat?.messages.length, isTyping, chat?.id, preferencesRevision]);

  useEffect(() => {
    if (!autoDownloadVoice || !chat) return;
    const preloadedAudio = chat.messages
      .filter(message => !!message.audioUrl)
      .slice(-5)
      .map(message => {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.src = message.audioUrl!;
        return audio;
      });
    return () => {
      preloadedAudio.forEach(audio => {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      });
    };
  }, [autoDownloadVoice, chat?.id, chat?.messages.length, preferencesRevision]);

  // Voice recording timer
  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setRecordingSeconds(0);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecording]);


  const handleInsertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setInputText(prev => prev + emoji);
      return;
    }
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const newText = inputText.substring(0, start) + emoji + inputText.substring(end);
    setInputText(newText);
    setTimeout(() => {
      textarea.focus();
      const newPos = start + emoji.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

    // Mention Detection Logic
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);

    const cursor = e.target.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursor);
    const lastAtMatch = textBeforeCursor.match(/@([a-zA-Z0-9_\u0600-\u06FF]*)$/);

    if (lastAtMatch && chat?.type === 'group') {
      setMentionQuery(lastAtMatch[1].toLowerCase());
      setMentionStartIndex(lastAtMatch.index !== undefined ? lastAtMatch.index : -1);
    } else {
      setMentionQuery(null);
      setMentionStartIndex(-1);
    }
  };

  // Filter group members for mentions
  const matchingMembers = useMemo(() => {
    if (mentionQuery === null || !chat || chat.type !== 'group') return [];
    return chat.participants.filter(p => 
      p.id !== currentUser.id && (
        p.username.toLowerCase().includes(mentionQuery) ||
        p.displayName.toLowerCase().includes(mentionQuery)
      )
    );
  }, [mentionQuery, chat, currentUser.id]);

  const insertMention = (user: User) => {
    if (mentionStartIndex === -1) return;
    const before = inputText.slice(0, mentionStartIndex);
    const cursor = textareaRef.current?.selectionStart || inputText.length;
    const after = inputText.slice(cursor);
    const newText = `${before}@${user.username} ${after}`;
    setInputText(newText);
    setMentionQuery(null);
    setMentionStartIndex(-1);
    textareaRef.current?.focus();
  };

  // Derived State for Chat Info
  const chatInfo = useMemo(() => {
    if (!chat) return null;
    if (chat.type === 'saved') {
      return {
        title: 'پیام‌های ذخیره شده',
        avatar: null,
        status: 'فضای شخصی شما',
        isSaved: true,
        isOnline: false
      };
    }
    const otherParticipant = chat.participants.find(p => p.id !== currentUser.id);
    const isContact = Boolean(otherParticipant && (currentUser.contacts || []).includes(otherParticipant.id));
    if (chat.type === 'private') {
      const presence = otherParticipant ? getUserPresence(otherParticipant, isContact) : { isOnline: false, label: '' };
      return {
        title: otherParticipant?.displayName || 'کاربر استارلی',
        avatar: otherParticipant?.avatar,
        status: isTyping ? 'درحال نوشتن...' : presence.label,
        isSaved: false,
        isOnline: presence.isOnline
      };
    }
    const onlineCount = chat.participants.filter(p => getUserPresence(p).isOnline).length;
    return {
      title: chat.groupName || (chat.type === 'channel' ? 'کانال استارلی' : 'گروه استارلی'),
      avatar: chat.groupAvatar,
      status: isTyping ? 'درحال نوشتن...' : (chat.type === 'channel' ? `${chat.participants.length} مشترک` : `${chat.participants.length} عضو${onlineCount > 0 ? `، ${onlineCount} آنلاین` : ''}`),
      isSaved: false,
      isOnline: false
    };
  }, [chat, currentUser, isTyping]);

  if (!chat || !chatInfo) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0e1621] text-[#708499] p-6 relative overflow-hidden select-none empty-chat-container">
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute w-[450px] h-[450px] bg-[#3390ec]/10 rounded-full blur-3xl pointer-events-none -top-20 -right-20 animate-pulse" />
        <div className="absolute w-[350px] h-[350px] bg-red-500/5 rounded-full blur-3xl pointer-events-none -bottom-10 -left-10" />

        <div className="relative z-10 max-w-md w-full flex flex-col items-center text-center space-y-6">
          {/* Logo with Ambient Glow (Clean, No Square Box, Large and Centered) */}
          <div className="relative group cursor-pointer flex flex-col items-center justify-center my-2">
            <div className="absolute -inset-8 bg-gradient-to-r from-red-500/20 via-[#3390ec]/25 to-blue-600/20 rounded-full blur-2xl opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <StarChatLogo
              variant="symbol"
              size={135}
              src={systemConfig?.customSymbolUrl}
              className="relative drop-shadow-2xl animate-pop transition-transform hover:scale-105"
            />
          </div>

          {/* Heading with Generous Spacing */}
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white tracking-wide">
              {systemConfig?.appName ? `پیام‌رسان ${systemConfig.appName}` : 'پیام‌رسان استارلی چت'}
            </h2>
            <p className="text-xs text-[#708499] leading-relaxed">
              {systemConfig?.appSlogan || 'ارتباطی امن، ابری و بدون محدودیت با رمزنگاری پیشرفته سراسری'}
            </p>
          </div>

          {/* Feature Badges with clean spacing */}
          <div className="grid grid-cols-1 gap-2.5 w-full pt-2">
            <div className="flex items-center gap-3 p-3 bg-[#17212b]/80 border border-white/5 rounded-2xl text-right empty-chat-card">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-white">رمزنگاری سرتاسری</h4>
                <p className="text-[11px] text-[#708499]">محافظت کامل از پیام‌ها با کلیدهای امنیتی اختصاصی</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-[#17212b]/80 border border-white/5 rounded-2xl text-right empty-chat-card">
              <div className="w-8 h-8 rounded-xl bg-[#3390ec]/10 flex items-center justify-center text-[#3390ec] shrink-0">
                <Shield size={16} />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-white">حریم خصوصی شناسه کاربری</h4>
                <p className="text-[11px] text-[#708499]">جستجو و ارتباط اختصاصی تنها با آیدی دقیق</p>
              </div>
            </div>
          </div>

          {/* Call to action instruction */}
          <div className="pt-2">
            <span className="inline-block px-4 py-2 bg-[#242f3d]/70 text-[#3390ec] border border-[#3390ec]/20 rounded-full text-xs font-medium shadow-xs">
              یک گفتگو را از فهرست سمت راست برای شروع انتخاب کنید
            </span>
          </div>
        </div>
      </div>
    );
  }

  const isCreator = chat.adminId === currentUser.id;
  const userAdminPerms = chat.admins?.[currentUser.id];
  const isAdmin = isCreator || Boolean(userAdminPerms);
  const canChangeInfo = isCreator || Boolean(userAdminPerms?.canChangeInfo);
  const canDeleteAnyMsg = isCreator || Boolean(userAdminPerms?.canDeleteMessages);
  const canBanMembers = isCreator || Boolean(userAdminPerms?.canBanUsers);
  const canInvite = isCreator || Boolean(userAdminPerms?.canInviteUsers);
  const canAddAdmins = isCreator || Boolean(userAdminPerms?.canAddAdmins);

  const isChannel = chat.type === 'channel';
  const isGroup = chat.type === 'group';

  // Member granular permissions for group
  const memberCanSendMessages = isCreator || isAdmin || !isGroup || (chat.permissions?.canSendMessages !== false);
  const memberCanSendMedia = isCreator || isAdmin || !isGroup || (chat.permissions?.canSendMedia !== false);
  const memberCanSendVoice = isCreator || isAdmin || !isGroup || (chat.permissions?.canSendVoice !== false);
  const memberCanSendPolls = isCreator || isAdmin || !isGroup || (chat.permissions?.canSendPolls !== false);
  const memberCanPinMessages = isCreator || isAdmin || (isGroup && Boolean(chat.permissions?.canPinMessages));

  // Allowed reactions for group & channel (no hook after early return)
  const allowedChatEmojis = (!isGroup && !isChannel)
    ? POPULAR_REACTIONS 
    : chat.reactionsSetting === 'off' 
      ? [] 
      : (chat.reactionsSetting === 'some' && chat.allowedReactions && chat.allowedReactions.length > 0)
        ? chat.allowedReactions
        : POPULAR_REACTIONS;

  // Filter messages based on search
  const clearTimestamp = chat.clearedAt?.[currentUser.id] || 0;
  const filteredMessages = chat.messages
    .filter(m => !clearTimestamp || m.timestamp > clearTimestamp)
    .filter(m => {
    if (!searchInChat.trim()) return true;
    return m.text.toLowerCase().includes(searchInChat.toLowerCase());
  });

  // Pinned messages
  const pinnedMessages = (chat.pinnedMessageIds || [])
    .map(id => chat.messages.find(m => m.id === id))
    .filter(Boolean) as Message[];

  const isBlockedByUnverifiedPhone = Boolean(
    systemConfig?.requireVerifiedPhoneForMessaging && 
    systemConfig?.smsOtpEnabled !== false && 
    !currentUser.isPhoneVerified
  );

  const handleSend = async () => {
    if (isBlockedByUnverifiedPhone) {
      setShowPhoneVerifyRequiredModal(true);
      return;
    }
    if (!inputText.trim()) return;

    if (editingMessage) {
      onAction('edit', { id: editingMessage.id, text: inputText.trim() });
      setEditingMessage(null);
    } else {
      const plainText = inputText.trim();
      // Derive local chat key from chat.id
      const secretKey = chat.id;
      const { ciphertext, iv } = await encryptMessage(plainText, secretKey);

      onAction('send', { 
        text: plainText, 
        isEncrypted: true,
        encryptedPayload: ciphertext,
        encryptedIv: iv,
        replyToId: replyingTo?.id 
      });
      setReplyingTo(null);
    }
    setInputText('');
    setMentionQuery(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isBlockedByUnverifiedPhone) {
      setShowPhoneVerifyRequiredModal(true);
      if (e.target) e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeCheck = validateFileSize(file.size, systemConfig?.maxUploadSizeMb);
    if (!sizeCheck.valid) {
      showUploadError(sizeCheck.message!);
      if (e.target) e.target.value = '';
      return;
    }

    try {
      if (file.type.startsWith('image/')) {
        // Compress to lightweight canvas image (max 800px, 0.8 quality ~40KB)
        const compressedDataUrl = await compressImage(file, 800, 800, 0.8);
        onAction('send', { 
          text: inputText.trim() || '', 
          imageUrl: compressedDataUrl,
          fileName: file.name,
          fileSize: file.size,
          fileMimeType: file.type,
          replyToId: replyingTo?.id 
        });
        setInputText('');
        setReplyingTo(null);
      } else {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('خطا در خواندن فایل'));
          reader.readAsDataURL(file);
        });
        onAction('send', {
          text: inputText.trim() || '',
          fileUrl: dataUrl,
          fileName: file.name,
          fileSize: file.size,
          fileMimeType: file.type || 'application/octet-stream',
          replyToId: replyingTo?.id
        });
        setInputText('');
        setReplyingTo(null);
      }
    } catch (err) {
      console.error("File upload error:", err);
      showUploadError("خطا در پردازش و بارگذاری فایل انتخابی");
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const toggleRecording = async () => {
    if (isBlockedByUnverifiedPhone) {
      setShowPhoneVerifyRequiredModal(true);
      return;
    }
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const sizeCheck = validateFileSize(blob.size, systemConfig?.maxUploadSizeMb);
          if (!sizeCheck.valid) {
            showUploadError(sizeCheck.message!);
            stream.getTracks().forEach(t => t.stop());
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
            onAction('send', { 
              text: inputText.trim() || '', 
              audioUrl: reader.result,
              fileSize: blob.size,
              replyToId: replyingTo?.id 
            });
            setInputText('');
            setReplyingTo(null);
          };
          reader.readAsDataURL(blob);
          stream.getTracks().forEach(t => t.stop());
        };
        recorder.start();
        setIsRecording(true);
      } catch (err) {
        showUploadError('دسترسی به میکروفون مسدود است.');
      }
    } else {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    }
  };

  const handlePlayAudio = (msgId: string, url: string) => {
    if (playingAudioId === msgId) {
      audioPlayerRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const audio = new Audio(url);
      audioPlayerRef.current = audio;
      audio.play();
      setPlayingAudioId(msgId);
      audio.onended = () => setPlayingAudioId(null);
    }
  };

  const handleCreatePoll = () => {
    if (isBlockedByUnverifiedPhone) {
      setShowPhoneVerifyRequiredModal(true);
      return;
    }
    if (!pollQuestion.trim()) return alert("لطفا سوال نظرسنجی را وارد کنید");
    const validOptions = pollOptions.filter(o => o.trim().length > 0);
    if (validOptions.length < 2) return alert("حداقل دو گزینه برای نظرسنجی وارد کنید");

    const newPoll: Poll = {
      question: pollQuestion.trim(),
      options: validOptions.map((opt, i) => ({
        id: `opt_${Date.now()}_${i}`,
        text: opt.trim(),
        votes: []
      })),
      isMultipleChoice: pollMultiple,
      totalVotes: 0
    };

    onAction('send', {
      text: '',
      poll: newPoll,
      replyToId: replyingTo?.id
    });

    setShowPollModal(false);
    setPollQuestion('');
    setPollOptions(['', '']);
    setReplyingTo(null);
  };

  // Context Menu Handlers (Desktop Right-Click & Mobile Long-Press with Telegram-Style Focus)
  const openFocusedContextMenu = (targetEl: HTMLElement, msg: Message) => {
    if (!targetEl || !targetEl.isConnected) return;
    const rect = targetEl.getBoundingClientRect();
    const isMe = msg.senderId === currentUser.id;
    const menuWidth = 232;
    const estimatedMenuHeight = 310;
    
    // Vertical placement (above vs below bubble)
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    let placement: 'above' | 'below' = 'below';
    let y = rect.bottom + 8;

    if (spaceBelow < estimatedMenuHeight && spaceAbove >= estimatedMenuHeight) {
      placement = 'above';
      y = Math.max(12, rect.top - estimatedMenuHeight - 8);
    } else if (spaceBelow < estimatedMenuHeight && spaceAbove < estimatedMenuHeight) {
      placement = spaceBelow >= spaceAbove ? 'below' : 'above';
      y = Math.max(12, Math.min(window.innerHeight - estimatedMenuHeight - 12, spaceBelow >= spaceAbove ? rect.bottom + 6 : rect.top - estimatedMenuHeight - 6));
    }

    // Horizontal placement aligned with message bubble
    let x = isMe ? (rect.right - menuWidth) : rect.left;
    const clamped = clampContextMenuPosition(
      { x, y },
      { width: menuWidth, height: estimatedMenuHeight },
      { width: window.innerWidth, height: window.innerHeight },
      12
    );

    setContextMenu({
      x: clamped.x,
      y: clamped.y,
      message: msg,
      targetRect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        right: rect.right
      },
      placement
    });
  };

  const handleContextMenu = (e: React.MouseEvent, msg: Message) => {
    e.preventDefault();
    e.stopPropagation();
    if (
      !shouldAllowContextMenuEvent(
        isTouchActiveRef.current,
        touchMovedRef.current,
        contextMenu?.message.id === msg.id
      )
    ) {
      return;
    }
    const targetEl = e.currentTarget as HTMLElement;
    openFocusedContextMenu(targetEl, msg);
  };

  const handleTouchStart = (e: React.TouchEvent, msg: Message) => {
    if (e.touches.length !== 1) {
      touchMovedRef.current = true;
      cancelLongPressTimer();
      return;
    }
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    touchStartScrollTopRef.current = messagesContainerRef.current?.scrollTop ?? 0;
    isTouchActiveRef.current = true;
    touchMovedRef.current = false;
    isLongPressActiveRef.current = false;
    isInitialLongPressTouchRef.current = false;
    cancelLongPressTimer();

    const targetEl = e.currentTarget as HTMLElement;
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      const currentScrollTop = messagesContainerRef.current?.scrollTop ?? 0;
      if (
        touchMovedRef.current ||
        shouldCancelLongPressOnScroll(touchStartScrollTopRef.current, currentScrollTop) ||
        !targetEl.isConnected
      ) {
        return;
      }
      isLongPressActiveRef.current = true;
      isInitialLongPressTouchRef.current = true;
      lastLongPressTimeRef.current = Date.now();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(35); } catch {}
      }
      openFocusedContextMenu(targetEl, msg);
    }, LONG_PRESS_DELAY_MS);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      touchMovedRef.current = true;
      cancelLongPressTimer();
      return;
    }
    if (!touchStartPosRef.current) return;
    const touch = e.touches[0];
    const currentScrollTop = messagesContainerRef.current?.scrollTop ?? 0;
    if (
      shouldCancelLongPressOnMove(touchStartPosRef.current, { x: touch.clientX, y: touch.clientY }) ||
      shouldCancelLongPressOnScroll(touchStartScrollTopRef.current, currentScrollTop)
    ) {
      touchMovedRef.current = true;
      cancelLongPressTimer();
    }
  };

  const handleTouchEnd = () => {
    cancelLongPressTimer();
    isTouchActiveRef.current = false;
    if (isLongPressActiveRef.current) {
      lastLongPressTimeRef.current = Date.now();
      isLongPressActiveRef.current = false;
      setTimeout(() => {
        isInitialLongPressTouchRef.current = false;
      }, 80);
    }
    touchStartPosRef.current = null;
    touchStartScrollTopRef.current = null;
  };

  const handleTouchCancel = () => {
    cancelLongPressTimer();
    isTouchActiveRef.current = false;
    touchMovedRef.current = false;
    isLongPressActiveRef.current = false;
    isInitialLongPressTouchRef.current = false;
    touchStartPosRef.current = null;
    touchStartScrollTopRef.current = null;
  };

  const handleBubbleClickCapture = (e: React.MouseEvent) => {
    if (shouldSuppressClickAfterLongPress(isLongPressActiveRef.current, lastLongPressTimeRef.current)) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressActiveRef.current = false;
      lastLongPressTimeRef.current = 0;
    }
  };

  const handleMessagesScroll = () => {
    touchMovedRef.current = true;
    cancelLongPressTimer();
    if (contextMenu) setContextMenu(null);
    if (activeReactionMsgId) setActiveReactionMsgId(null);
  };

  const renderMessageText = (text: string) => {
    const parts = text.split(/(@[a-zA-Z0-9_\u0600-\u06FF]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span 
            key={index} 
            className="mention-tag"
            onClick={(e) => {
              e.stopPropagation();
              onUsernameClick(part);
            }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Helper: should we render the text paragraph for this message?
  const shouldRenderText = (text?: string) => {
    if (!text) return false;
    const trimmed = text.trim();
    if (!trimmed) return false;
    // Do NOT show placeholder dummy text!
    if (trimmed === 'تصویر' || trimmed === 'تصویر ارسالی' || trimmed === 'پیام صوتی') {
      return false;
    }
    return true;
  };

  // Reusable Message Bubble Content Renderer (used in feed and in the focused context overlay)
  const renderMessageBubbleContent = (msg: Message, options?: { isFocusedOverlay?: boolean }) => {
    const isMe = msg.senderId === currentUser.id;
    const sender = chat.participants.find(p => p.id === msg.senderId);
    const isGroup = chat.type === 'group';
    const isChannel = chat.type === 'channel';

    const index = filteredMessages.findIndex(m => m.id === msg.id);
    const prevMsg = index > 0 ? filteredMessages[index - 1] : null;
    const nextMsg = index >= 0 && index < filteredMessages.length - 1 ? filteredMessages[index + 1] : null;

    const isSameSenderAsPrev = Boolean(prevMsg && prevMsg.senderId === msg.senderId && (msg.timestamp - prevMsg.timestamp < 5 * 60 * 1000));
    const isSameSenderAsNext = Boolean(nextMsg && nextMsg.senderId === msg.senderId && (nextMsg.timestamp - msg.timestamp < 5 * 60 * 1000));

    const isFirstInCluster = !isSameSenderAsPrev;
    const isLastInCluster = !isSameSenderAsNext;

    return (
      <div className={`message-bubble ${isMe ? 'bubble-sent bg-[#2b5278] rounded-tr-none text-white' : 'bubble-received bg-[#182533] text-white'} ${
        isGroup && !isMe 
          ? (isLastInCluster ? 'rounded-bl-none' : 'rounded-bl-xl') 
          : (isMe ? 'rounded-tr-none' : 'rounded-tl-none')
      } p-2.5 md:p-3.5 relative rounded-2xl max-w-full break-words transition-all duration-300 ${
        options?.isFocusedOverlay
          ? 'shadow-2xl ring-2 ring-white/20 select-text scale-[1.01]'
          : activeHighlightId === msg.id
          ? 'ring-2 ring-[#3390ec] shadow-[0_0_24px_rgba(51,144,236,0.65)] scale-[1.015]'
          : 'shadow-md'
      }`}>
        {/* Telegram-style organic speech bubble tail emerging from avatar */}
        {isGroup && !isMe && isLastInCluster && (
          <svg 
            className="message-tail-received absolute -left-[7px] bottom-0 w-[8px] h-[16px] text-[#182533] pointer-events-none drop-shadow-xs" 
            viewBox="0 0 8 16" 
            fill="none"
          >
            <path 
              d="M8 0 C8 8, 2 13, 0 16 L8 16 Z" 
              fill="currentColor" 
            />
          </svg>
        )}

        {/* Sender Name in Groups (Displayed only on First Message of cluster with distinctive colors) */}
        {isGroup && !isMe && sender && isFirstInCluster && (
          <div 
            className="text-[12px] font-bold mb-1 cursor-pointer hover:underline flex items-center gap-1.5 transition-colors"
            style={{ color: getSenderColor(sender.id || sender.username) }}
            onClick={() => onUsernameClick(sender.username)}
          >
            <span>{sender.displayName}</span>
          </div>
        )}

        {/* Sender Profile in Channel when showAuthorsProfiles is enabled */}
        {isChannel && chat.showAuthorsProfiles && sender && (
          <div 
            className="flex items-center gap-1.5 mb-1.5 cursor-pointer group/author"
            onClick={() => onUsernameClick(sender.username)}
          >
            <img 
              src={sender.avatar || DEFAULT_AVATAR} 
              className="w-4 h-4 rounded-full object-cover border border-[#3390ec]/30" 
            />
            <span className="text-[11px] font-bold text-[#3390ec] group-hover/author:underline">
              {sender.displayName}
            </span>
            <span className="text-[8px] bg-[#3390ec]/15 text-[#3390ec] px-1.5 py-0.5 rounded-md font-semibold">
              نویسنده
            </span>
          </div>
        )}

        {/* Forwarded Tag */}
        {msg.forwardedFrom && (
          <div className="text-[10px] text-[#708499] mb-1 flex items-center gap-1 italic">
            <Share2 size={11} /> هدایت شده از {msg.forwardedFrom}
          </div>
        )}

        {/* Reply Quote Card */}
        {msg.replyToId && (
          <div className="mb-2 p-2 bg-black/25 rounded-xl border-r-3 border-[#3390ec] text-[11px] opacity-90 cursor-pointer hover:bg-black/40 transition-colors">
            <span className="text-[#3390ec] font-bold block mb-0.5">پاسخ</span>
            <span className="truncate block opacity-80">{chat.messages.find(m => m.id === msg.replyToId)?.text || 'پیام'}</span>
          </div>
        )}

        {/* Image Attachment (Clean without 'تصویر' text + Instant Interactive Zoom) */}
        {msg.imageUrl && (
          <div 
            onClick={() => {
              if (!autoDownloadPhotos && !revealedImages.has(msg.id)) {
                setRevealedImages(current => new Set(current).add(msg.id));
                return;
              }
              setLightboxImage(msg.imageUrl || null);
              setZoomScale(1);
              setPanOffset({ x: 0, y: 0 });
            }}
            className="rounded-xl overflow-hidden cursor-pointer group/img relative mb-1.5 bg-white shadow-xs"
            title="کلیک برای بزرگنمایی کامل تصویر"
          >
            {autoDownloadPhotos || revealedImages.has(msg.id) ? (
              <img
                src={msg.imageUrl}
                loading={autoDownloadPhotos ? 'eager' : 'lazy'}
                className="max-h-[360px] w-full object-cover rounded-xl transition-transform duration-200 group-hover/img:scale-[1.02] bg-white"
              />
            ) : (
              <button
                type="button"
                className="w-full min-h-28 flex items-center justify-center gap-2 text-white text-xs bg-black/20"
                onClick={event => {
                  event.stopPropagation();
                  setRevealedImages(current => new Set(current).add(msg.id));
                }}
              >
                <Download size={16} /> برای بارگیری عکس بزنید
              </button>
            )}
            <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-xs gap-1.5 font-bold pointer-events-none">
              <ZoomIn size={16} /> بزرگنمایی تصویر
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxImage(msg.imageUrl || null);
                setZoomScale(1);
                setPanOffset({ x: 0, y: 0 });
              }}
              className="absolute top-2.5 left-2.5 p-1.5 bg-black/60 hover:bg-[#3390ec] text-white rounded-full backdrop-blur-xs transition-all shadow-md active:scale-90"
              title="بزرگنمایی"
            >
              <ZoomIn size={15}/>
            </button>
          </div>
        )}

        {/* Voice Message Player (Clean without 'پیام صوتی' text) */}
        {msg.audioUrl && (
          <div className="flex items-center gap-3 min-w-[200px] py-1 px-1">
            <button 
              onClick={() => handlePlayAudio(msg.id, msg.audioUrl!)}
              className="bg-[#3390ec] p-2.5 rounded-full text-white shadow-lg hover:bg-[#2881d9] active:scale-95 transition-all"
            >
              {playingAudioId === msg.id ? <Pause size={17}/> : <Play size={17} className="mr-0.5"/>}
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-1 h-6">
                {[12, 18, 8, 22, 14, 20, 10, 16, 24, 12, 18].map((h, i) => (
                  <div 
                    key={i} 
                    style={{ height: playingAudioId === msg.id ? undefined : `${h}px` }}
                    className={`w-1 rounded-full transition-all ${playingAudioId === msg.id ? 'bg-[#3390ec] wave-bar' : 'bg-white/40'}`} 
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* General File Attachment Card */}
        {msg.fileUrl && (
          <div
            data-testid="message-file-attachment"
            className="flex items-center gap-3 p-2.5 rounded-xl bg-black/20 border border-white/10 min-w-[220px] max-w-[320px] my-1"
          >
            <a
              href={msg.fileUrl}
              download={msg.fileName || 'attachment'}
              onClick={(e) => e.stopPropagation()}
              className="w-10 h-10 rounded-xl bg-[#3390ec] hover:bg-[#2881d9] text-white flex items-center justify-center shrink-0 shadow-md transition-transform active:scale-95"
              title="دانلود فایل"
            >
              <Download size={18} />
            </a>
            <div className="flex-1 min-w-0 text-right">
              <p className="text-xs font-bold text-white truncate" dir="ltr">
                {msg.fileName || 'فایل پیوست'}
              </p>
              <p className="text-[10px] text-white/70 font-mono tabular-nums mt-0.5" dir="ltr">
                {msg.fileSize ? formatFileSize(msg.fileSize) : 'فایل قابل دانلود'}
              </p>
            </div>
          </div>
        )}

        {/* Interactive Poll */}
        {msg.poll && (
          <div className="space-y-2 py-1 min-w-[240px]">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white mb-1">
              <BarChart2 size={16} className="text-[#3390ec]" />
              <span>{msg.poll.question}</span>
            </div>
            <div className="space-y-1.5">
              {msg.poll.options.map(opt => {
                const hasVoted = opt.votes.includes(currentUser.id);
                const total = msg.poll!.totalVotes || 0;
                const percent = total > 0 ? Math.round((opt.votes.length / total) * 100) : 0;

                return (
                  <button
                    key={opt.id}
                    onClick={() => onAction('votePoll', { messageId: msg.id, optionId: opt.id })}
                    className={`w-full p-2.5 rounded-xl border text-right transition-all relative overflow-hidden text-xs flex items-center justify-between ${hasVoted ? 'border-[#3390ec] bg-[#3390ec]/20' : 'border-white/10 hover:bg-white/5'}`}
                  >
                    <div 
                      className="absolute top-0 bottom-0 right-0 bg-[#3390ec]/15 transition-all duration-300" 
                      style={{ width: `${percent}%` }}
                    />
                    <div className="relative z-10 flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${hasVoted ? 'border-[#3390ec] bg-[#3390ec]' : 'border-white/30'}`}>
                        {hasVoted && <Check size={11} className="text-white"/>}
                      </div>
                      <span className="text-white font-medium">{opt.text}</span>
                    </div>
                    <span className="relative z-10 text-[11px] text-[#708499] tabular-nums font-bold">
                      {percent}% ({opt.votes.length})
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] text-[#708499] text-left tabular-nums pt-1">
              مجموع آرا: {msg.poll.totalVotes}
            </div>
          </div>
        )}

        {/* Text Content (Rendered only if real text exists, not placeholders) */}
        {shouldRenderText(msg.text) && (
          <p className="chat-message-text leading-relaxed whitespace-pre-wrap font-normal break-words">
            {renderMessageText(msg.text)}
          </p>
        )}

        {/* Reactions Tally Badges */}
        {msg.reactions && msg.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {msg.reactions.map(r => {
              const hasReacted = r.users.includes(currentUser.id);
              return (
                <button
                  key={r.emoji}
                  onClick={() => onAction('react', { messageId: msg.id, emoji: r.emoji })}
                  className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 border transition-all ${hasReacted ? 'bg-[#3390ec]/20 border-[#3390ec] text-white' : 'bg-black/20 border-white/10 text-white/80 hover:bg-black/40'}`}
                >
                  <span>{r.emoji}</span>
                  <span className="text-[10px] tabular-nums font-bold">{r.count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Metadata (Time & Delivery Ticks / Channel Views) */}
        <div className="bubble-meta flex items-center justify-end gap-1.5 mt-1 opacity-70 select-none text-[10px]">
          {/* Channel Views Count */}
          {isChannel && (
            <span className="flex items-center gap-1 text-[10px] text-[#708499] font-mono mr-1" title="تعداد مشاهده">
              <Eye size={12} className="text-[#708499]" />
              <span className="tabular-nums">{msg.viewsCount || 1}</span>
            </span>
          )}

          {/* Sign messages in Channel */}
          {isChannel && chat.signMessages && sender && (
            <span className="text-[10px] text-[#3390ec] font-medium mr-1 select-none" title="امضای نویسنده">
              {sender.displayName}
            </span>
          )}
          {msg.isEdited && <span className="text-[9px]">ویرایش شده</span>}
          <span className="text-[9px] tabular-nums">
            {new Date(msg.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
          </span>
          {isMe && !isChannel && (
            (() => {
              const isSeenByOthers = (msg.seenBy && msg.seenBy.some(s => s.userId !== currentUser.id)) || msg.isRead;
              return isSeenByOthers ? (
                <span title="دیده‌شده" className="inline-flex items-center text-[#3390ec]">
                  <CheckCheck size={13} />
                </span>
              ) : (
                <span title="ارسال شده" className="inline-flex items-center text-white/60">
                  <Check size={13} />
                </span>
              );
            })()
          )}
        </div>
      </div>
    );
  };

  return (
    <div 
      className="flex-1 flex flex-col h-screen bg-[#0e1621] relative overflow-hidden chat-wallpaper font-['Vazirmatn']"
      style={resolveWallpaperStyle(chat.wallpaper || currentUser.wallpaper)}
    >
      <audio ref={audioPlayerRef} className="hidden" />

      {/* Header */}
      <header className="h-16 flex items-center justify-between px-3 md:px-4 bg-[#17212b]/95 backdrop-blur-md border-b border-black/20 z-20 shrink-0 shadow-sm">
        <div className="flex items-center gap-1.5 md:gap-2 overflow-hidden flex-1">
          {/* Mobile Back Button (Optimized 44px touch target) */}
          <button 
            onClick={onBack} 
            className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center text-[#708499] hover:text-white transition-colors active:scale-95"
            title="بازگشت"
          >
            <ArrowRight size={22} />
          </button>
          
          <div className="flex items-center gap-3 cursor-pointer group flex-1 min-w-0" onClick={() => setShowInfo(true)}>
            <div className="relative shrink-0">
              {chatInfo.isSaved ? (
                <div className="w-10 h-10 rounded-full bg-[#3390ec] flex items-center justify-center shadow-md">
                  <Bookmark size={20} className="text-white fill-current"/>
                </div>
              ) : (
                <img 
                  src={chatInfo.avatar || DEFAULT_AVATAR} 
                  onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                  className="w-10 h-10 rounded-full object-cover border border-white/10 group-hover:scale-105 transition-transform" 
                />
              )}
              {chat.type === 'private' && chatInfo.isOnline && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#17212b]" />
              )}
            </div>
            <div className="overflow-hidden min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-[15px] text-white truncate">{chatInfo.title}</h3>
                {chat.isPublic && (
                  <span title="گروه عمومی" className="shrink-0 flex items-center">
                    <Globe size={13} className="text-[#3390ec]" />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <p className={`text-[11px] font-medium truncate ${chatInfo.isOnline ? 'text-green-400 font-bold' : 'text-[#3390ec]'}`}>
                  {chatInfo.status}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button 
            onClick={() => setShowWallpaperModal(true)} 
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#708499] hover:text-white hover:bg-white/5 rounded-full transition-colors"
            title="پس‌زمینه این گفتگو"
          >
            <Palette size={19}/>
          </button>
          <button 
            onClick={() => setShowSearch(!showSearch)} 
            className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full transition-colors ${showSearch ? 'text-[#3390ec] bg-white/10' : 'text-[#708499] hover:text-white hover:bg-white/5'}`}
            title="جستجو در پیام‌ها"
          >
            <Search size={20}/>
          </button>
          <button 
            onClick={() => setShowInfo(true)} 
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#708499] hover:text-white hover:bg-white/5 rounded-full transition-colors"
            title="اطلاعات گفتگو"
          >
            <Info size={20}/>
          </button>
        </div>
      </header>

      {/* In-Chat Search Bar */}
      {showSearch && (
        <div className="px-4 py-2 bg-[#17212b] border-b border-white/5 flex items-center gap-2 animate-in slide-in-from-top duration-150 z-20">
          <Search size={16} className="text-[#708499]" />
          <input 
            value={searchInChat}
            onChange={e => setSearchInChat(e.target.value)}
            placeholder="جستجو در گفتگو..."
            className="flex-1 bg-transparent text-xs text-white outline-none"
            autoFocus
          />
          {searchInChat && (
            <span className="text-[11px] text-[#708499] tabular-nums">
              {filteredMessages.length} مورد
            </span>
          )}
          <button onClick={() => { setShowSearch(false); setSearchInChat(''); }} className="p-1 text-[#708499] hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Pinned Messages Banner */}
      {pinnedMessages.length > 0 && (
        <div className="bg-[#17212b]/90 backdrop-blur-sm px-4 py-2 border-b border-white/5 flex items-center justify-between z-10 animate-in slide-in-from-top">
          <div className="flex items-center gap-2.5 overflow-hidden flex-1 cursor-pointer" onClick={() => {
            const el = document.getElementById(pinnedMessages[0].id);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}>
            <Pin size={16} className="text-[#3390ec] shrink-0" />
            <div className="overflow-hidden">
              <span className="text-[11px] text-[#3390ec] font-bold block">پیام سنجاق شده</span>
              <p className="text-xs text-white/80 truncate">{pinnedMessages[0].text || 'رسانه'}</p>
            </div>
          </div>
          <button 
            onClick={() => onAction('pin', { messageId: pinnedMessages[0].id })} 
            className="p-1 hover:bg-white/5 rounded-full text-[#708499] hover:text-white"
            title="برداشتن سنجاق"
          >
            <X size={14}/>
          </button>
        </div>
      )}

      {/* Messages Feed */}
      <main 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 custom-scrollbar pb-8 touch-pan-y"
        onScroll={handleMessagesScroll}
      >
        {filteredMessages.map((msg, index) => {
          const isMe = msg.senderId === currentUser.id;
          const sender = chat.participants.find(p => p.id === msg.senderId);
          const isPinned = chat.pinnedMessageIds?.includes(msg.id);

          // Group clustering logic (Telegram style)
          const prevMsg = index > 0 ? filteredMessages[index - 1] : null;
          const nextMsg = index < filteredMessages.length - 1 ? filteredMessages[index + 1] : null;

          const isSameSenderAsPrev = Boolean(prevMsg && prevMsg.senderId === msg.senderId && (msg.timestamp - prevMsg.timestamp < 5 * 60 * 1000));
          const isSameSenderAsNext = Boolean(nextMsg && nextMsg.senderId === msg.senderId && (nextMsg.timestamp - msg.timestamp < 5 * 60 * 1000));

          const isFirstInCluster = !isSameSenderAsPrev;
          const isLastInCluster = !isSameSenderAsNext;

          // Render Desktop Hover Actions Menu
          const renderHoverActions = () => (
            <div className="hidden md:flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-center shrink-0">
              <button 
                onClick={() => setReplyingTo(msg)} 
                className="p-1.5 bg-[#17212b]/80 hover:bg-[#3390ec] rounded-full text-[#708499] hover:text-white transition-all shadow-sm"
                title="پاسخ"
              >
                <Reply size={13} className="scale-x-[-1]" />
              </button>
              <button 
                onClick={() => {
                  setForwardingMessage(msg);
                  setSelectedForwardChatIds([]);
                  setForwardSearch('');
                }} 
                className="p-1.5 bg-[#17212b]/80 hover:bg-[#3390ec] rounded-full text-[#708499] hover:text-white transition-all shadow-sm"
                title="هدایت پیام (Forward)"
              >
                <Share2 size={13} />
              </button>
              {(allowedChatEmojis.length > 0 || isAdmin) && (
                <button 
                  onClick={() => setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id)} 
                  className="p-1.5 bg-[#17212b]/80 hover:bg-[#3390ec] rounded-full text-[#708499] hover:text-white transition-all shadow-sm"
                  title="واکنش"
                >
                  <Smile size={13} />
                </button>
              )}
            </div>
          );

          return (
            <div 
              key={msg.id} 
              id={msg.id}
              className={`flex w-full animate-msg ${isMe ? 'justify-start' : 'justify-end'} ${isFirstInCluster && index > 0 ? 'mt-3' : 'mt-0.5'}`}
            >
              <div 
                dir={isMe ? 'rtl' : 'ltr'}
                className="flex items-end gap-2 max-w-[96%] md:max-w-[88%] group"
              >
                {/* For currentUser: Hover actions on left */}
                {isMe && renderHoverActions()}

                {/* For other users in groups: Sender avatar on outer side aligned with bottom of cluster */}
                {isGroup && !isMe && (
                  isLastInCluster ? (
                    <div 
                      className="w-9 h-9 rounded-full cursor-pointer shrink-0 mb-0.5 relative select-none group/avatar"
                      onClick={() => sender && onUsernameClick(sender.username)}
                      title={sender?.displayName || 'کاربر'}
                    >
                      <img 
                        src={sender?.avatar || DEFAULT_AVATAR} 
                        onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                        className="w-9 h-9 rounded-full object-cover border border-white/10 hover:border-[#3390ec] transition-all bg-[#242f3d]" 
                      />
                    </div>
                  ) : (
                    <div className="w-9 shrink-0" aria-hidden="true" />
                  )
                )}

                {/* Message Bubble (With Right-Click and Mobile Long-Press) */}
                <div 
                  dir="rtl"
                  data-testid={`message-bubble-${msg.id}`}
                  className={`relative max-w-full select-none touch-pan-y transition-opacity duration-150 ${
                    contextMenu?.message.id === msg.id ? 'opacity-0' : 'opacity-100'
                  }`}
                  style={{
                    WebkitTouchCallout: 'none',
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                    touchAction: 'pan-y',
                  }}
                  onClickCapture={handleBubbleClickCapture}
                  onContextMenu={(e) => handleContextMenu(e, msg)}
                  onTouchStart={(e) => handleTouchStart(e, msg)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchCancel}
                >
                  {/* Floating Reaction Bar when toggled */}
                  {activeReactionMsgId === msg.id && (
                    <div className="absolute -top-11 left-0 z-30 bg-[#17212b] border border-white/10 rounded-full p-1 flex items-center gap-1 shadow-2xl animate-pop">
                      {(allowedChatEmojis.length > 0 ? allowedChatEmojis : POPULAR_REACTIONS).map(emoji => (
                        <button 
                          key={emoji}
                          onClick={() => {
                            onAction('react', { messageId: msg.id, emoji });
                            setActiveReactionMsgId(null);
                          }}
                          className="w-7 h-7 flex items-center justify-center hover:scale-125 transition-transform text-sm"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {renderMessageBubbleContent(msg)}
                </div>

                {/* For other users: Hover actions on right of the bubble */}
                {!isMe && renderHoverActions()}
              </div>
            </div>
          );
        })}
        <div ref={msgEndRef} />
      </main>

      {/* Telegram-style Focused Message & Context Menu Overlay */}
      {contextMenu && (
        <div 
          data-testid="message-context-menu-backdrop"
          className="fixed inset-0 z-[70] overflow-hidden select-none"
          onTouchStart={() => { isInitialLongPressTouchRef.current = false; }}
          onMouseDown={() => { isInitialLongPressTouchRef.current = false; }}
          onClick={() => {
            if (isInitialLongPressTouchRef.current) return;
            setContextMenu(null);
          }}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
        >
          {/* Deep Dim & Blur Backdrop that blurs everything else */}
          <div 
            className="absolute inset-0 bg-black/65 backdrop-blur-md animate-in fade-in duration-200"
            aria-hidden="true"
          />

          {/* Elevated Focused Message Bubble - completely sharp above blur */}
          <div
            className="fixed z-50 pointer-events-auto transition-transform duration-150 animate-pop"
            style={{
              top: `${contextMenu.targetRect.top}px`,
              left: `${contextMenu.targetRect.left}px`,
              width: `${contextMenu.targetRect.width}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {renderMessageBubbleContent(contextMenu.message, { isFocusedOverlay: true })}
          </div>

          {/* Context Menu Floating Card */}
          <div 
            data-testid="message-context-menu"
            className="fixed bg-[#17212b]/95 border border-white/10 rounded-2xl shadow-2xl p-2 w-[232px] space-y-1 animate-pop z-50 text-xs backdrop-blur-xl"
            style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Quick Reaction Bar */}
            <div className="flex items-center justify-between p-1.5 bg-[#242f3d]/90 rounded-xl mb-1 border border-white/5 shadow-inner">
              {POPULAR_REACTIONS.map(emoji => (
                <button 
                  key={emoji}
                  onClick={() => {
                    onAction('react', { messageId: contextMenu.message.id, emoji });
                    setContextMenu(null);
                  }}
                  className="w-7 h-7 flex items-center justify-center hover:scale-130 active:scale-95 transition-transform text-sm"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <button 
              onClick={() => { setReplyingTo(contextMenu.message); setContextMenu(null); textareaRef.current?.focus(); }}
              className="w-full flex items-center gap-2.5 p-2.5 hover:bg-white/5 rounded-xl text-white transition-colors"
            >
              <Reply size={15} className="text-[#3390ec] scale-x-[-1]" />
              <span>پاسخ (Reply)</span>
            </button>

            {/* Group Seen-By Submenu (ONLY in groups AND ONLY for messages sent by currentUser) */}
            {chat.type === 'group' && contextMenu.message.senderId === currentUser.id && (() => {
              const viewers = (contextMenu.message.seenBy || []).filter(s => s.userId !== currentUser.id);
              return (
                <div 
                  className="relative group/seen"
                  onMouseEnter={() => setShowSeenSubmenu(true)}
                  onMouseLeave={() => setShowSeenSubmenu(false)}
                >
                  <button 
                    type="button"
                    onClick={() => setShowSeenSubmenu(prev => !prev)}
                    className="w-full flex items-center justify-between p-2.5 hover:bg-white/5 rounded-xl text-white transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <CheckCheck size={15} className="text-[#3390ec]" />
                      <span>دیده‌شده توسط {viewers.length} نفر</span>
                    </div>
                    <ChevronLeft size={14} className="text-[#708499] group-hover/seen:-translate-x-0.5 transition-transform" />
                  </button>

                  {/* Floating Submenu Popup on hover or tap */}
                  {showSeenSubmenu && (
                    <div 
                      className="absolute top-0 right-full mr-2 w-64 bg-[#17212b] border border-white/10 rounded-2xl shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 max-h-64 overflow-y-auto custom-scrollbar"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="px-2 py-1 border-b border-white/5 text-[11px] font-bold text-[#3390ec] flex items-center justify-between mb-1.5">
                        <span className="flex items-center gap-1.5">
                          <Eye size={13} />
                          <span>دیده‌شده توسط ({viewers.length})</span>
                        </span>
                      </div>
                      
                      {viewers.length === 0 ? (
                        <div className="py-4 px-2 text-center text-[#708499] text-xs leading-relaxed">
                          هنوز عضوی این پیام را مشاهده نکرده است
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {viewers.map((item) => {
                            const member = chat.participants.find(p => p.id === item.userId) || {
                              id: item.userId,
                              username: item.userId,
                              displayName: 'عضو گروه',
                              avatar: DEFAULT_AVATAR
                            };
                            return (
                              <div key={item.userId} className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-white/5 transition-colors">
                                <img 
                                  src={member.avatar || DEFAULT_AVATAR} 
                                  onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                                  className="w-7 h-7 rounded-full object-cover border border-white/10 shrink-0" 
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-white truncate">{member.displayName}</p>
                                  <p className="text-[10px] text-[#708499] truncate font-mono" dir="ltr">@{member.username}</p>
                                </div>
                                <span className="text-[10px] text-[#3390ec] tabular-nums whitespace-nowrap">
                                  {formatSeenTime(item.seenAt)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            <button 
              onClick={() => { 
                setForwardingMessage(contextMenu.message); 
                setSelectedForwardChatIds([]);
                setForwardSearch('');
                setContextMenu(null); 
              }}
              className="w-full flex items-center gap-2.5 p-2.5 hover:bg-white/5 rounded-xl text-white transition-colors"
            >
              <Share2 size={15} className="text-[#3390ec]" />
              <span>هدایت پیام (Forward)</span>
            </button>

            {contextMenu.message.text && shouldRenderText(contextMenu.message.text) && (
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(contextMenu.message.text);
                  setContextMenu(null);
                  setCopyToast('متن پیام کپی شد!');
                  setTimeout(() => setCopyToast(null), 2000);
                }}
                className="w-full flex items-center gap-2.5 p-2.5 hover:bg-white/5 rounded-xl text-white transition-colors"
              >
                <Copy size={15} className="text-[#708499]" />
                <span>کپی متن</span>
              </button>
            )}

            <button 
              onClick={() => {
                onAction('pin', { messageId: contextMenu.message.id });
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2.5 p-2.5 hover:bg-white/5 rounded-xl text-white transition-colors"
            >
              <Pin size={15} className="text-[#708499]" />
              <span>{chat.pinnedMessageIds?.includes(contextMenu.message.id) ? 'لغو سنجاق' : 'سنجاق کردن'}</span>
            </button>

            {contextMenu.message.senderId !== currentUser.id && onReportMessage && (
              <button 
                onClick={() => {
                  onReportMessage(contextMenu.message);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 p-2.5 hover:bg-rose-500/10 text-rose-400 rounded-xl transition-colors"
              >
                <Flag size={15} />
                <span>گزارش تخلف (Report)</span>
              </button>
            )}

            {contextMenu.message.senderId === currentUser.id && shouldRenderText(contextMenu.message.text) && (
              <button 
                onClick={() => {
                  setEditingMessage(contextMenu.message);
                  setInputText(contextMenu.message.text);
                  setContextMenu(null);
                  textareaRef.current?.focus();
                }}
                className="w-full flex items-center gap-2.5 p-2.5 hover:bg-white/5 rounded-xl text-white transition-colors"
              >
                <Edit3 size={15} className="text-[#708499]" />
                <span>ویرایش پیام</span>
              </button>
            )}

            {(contextMenu.message.senderId === currentUser.id || canDeleteAnyMsg) && (
              <>
                <div className="h-px bg-white/5 my-1" />
                <button 
                  onClick={() => {
                    onAction('delete', { id: contextMenu.message.id });
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 p-2.5 hover:bg-red-500/10 text-red-400 rounded-xl transition-colors"
                >
                  <Trash size={15} />
                  <span>حذف پیام</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mention Dropdown Autocomplete */}
      {matchingMembers.length > 0 && (
        <div className="absolute bottom-18 right-4 left-4 md:left-auto md:w-80 bg-[#17212b]/98 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-2 z-30 animate-pop max-h-56 overflow-y-auto custom-scrollbar">
          <div className="text-[10px] font-bold text-[#3390ec] px-2 py-1 mb-1 border-b border-white/5">
            اعضای گروه برای تگ کردن (@)
          </div>
          {matchingMembers.map(u => (
            <div 
              key={u.id}
              onClick={() => insertMention(u)}
              className="flex items-center gap-2.5 p-2 hover:bg-[#3390ec]/20 rounded-xl cursor-pointer transition-colors"
            >
              <img src={u.avatar} className="w-8 h-8 rounded-full object-cover"/>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-xs text-white truncate">{u.displayName}</div>
                <div className="text-[10px] text-[#3390ec] truncate">@{u.username}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input Bar (Mobile Ergonomic) */}
      <footer className="p-2.5 md:p-3 bg-[#17212b]/95 backdrop-blur-xl border-t border-black/20 z-20 shrink-0">
        {/* Unverified Phone Warning Banner */}
        {isBlockedByUnverifiedPhone && (
          <div 
            onClick={() => setShowPhoneVerifyRequiredModal(true)}
            className="flex items-center justify-between p-2.5 mb-2 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-amber-300 text-xs cursor-pointer hover:bg-amber-500/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Phone size={15} className="shrink-0" />
              <span>ارسال پیام مستلزم تایید شماره همراه با پیامک (OTP) است</span>
            </div>
            <span className="text-[11px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-lg">راهنما</span>
          </div>
        )}

        {/* Reply Preview Bar */}
        {replyingTo && (
          <div className="flex items-center justify-between bg-black/30 p-2.5 mb-2 rounded-xl border-r-4 border-[#3390ec] animate-in slide-in-from-bottom">
            <div className="px-2 overflow-hidden">
              <p className="text-[11px] text-[#3390ec] font-bold">
                پاسخ به {chat.participants.find(p=>p.id===replyingTo.senderId)?.displayName || 'پیام'}
              </p>
              <p className="text-xs truncate opacity-70 text-white">{replyingTo.text || 'رسانه'}</p>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-white/10 rounded-full text-[#708499]">
              <X size={15}/>
            </button>
          </div>
        )}

        {/* Edit Preview Bar */}
        {editingMessage && (
          <div className="flex items-center justify-between bg-[#3390ec]/15 p-2.5 mb-2 rounded-xl border-r-4 border-[#3390ec] animate-in slide-in-from-bottom">
            <div className="px-2 overflow-hidden flex items-center gap-2">
              <Edit3 size={15} className="text-[#3390ec]"/>
              <div>
                <p className="text-[11px] text-[#3390ec] font-bold">درحال ویرایش پیام</p>
                <p className="text-xs truncate opacity-70 text-white">{editingMessage.text}</p>
              </div>
            </div>
            <button onClick={() => { setEditingMessage(null); setInputText(''); }} className="p-1 hover:bg-white/10 rounded-full text-[#708499]">
              <X size={15}/>
            </button>
          </div>
        )}

        {/* File Upload Size Error Toast */}
        {uploadErrorToast && (
          <div
            data-testid="file-upload-error-toast"
            className="flex items-center justify-between gap-2 bg-rose-500/15 border border-rose-500/30 text-rose-300 px-3.5 py-2.5 mb-2 rounded-xl text-xs animate-in fade-in slide-in-from-bottom-2 max-w-5xl mx-auto"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-400 shrink-0" />
              <span>{uploadErrorToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setUploadErrorToast(null)}
              className="p-1 hover:bg-white/10 rounded-lg text-rose-300 hover:text-white shrink-0"
              title="بستن"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Voice Recording Indicator */}
        {isRecording && (
          <div className="flex items-center justify-between bg-red-500/10 border border-red-500/20 p-2.5 mb-2 rounded-xl animate-pulse">
            <div className="flex items-center gap-2 text-red-400 text-xs font-bold">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
              <span>درحال ضبط صدا...</span>
              <span className="tabular-nums">00:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds}</span>
            </div>
            <button onClick={toggleRecording} className="text-xs text-white bg-red-500 px-3 py-1.5 rounded-lg active:scale-95 font-bold">
              پایان و ارسال
            </button>
          </div>
        )}

        {((!isChannel && memberCanSendMessages) || isAdmin || chatInfo.isSaved) ? (
          <div className="flex items-end gap-2 max-w-5xl mx-auto">
            <div className="flex-1 bg-[#242f3d] rounded-[22px] flex items-center px-2 md:px-3 py-1 shadow-lg border border-white/5 focus-within:border-[#3390ec]/30 transition-all relative">
              {/* Emoji Picker Popup */}
              {showEmojiPicker && (
                <div 
                  className="absolute bottom-full mb-3 right-0 w-80 max-w-[calc(100vw-32px)] bg-[#17212b] border border-white/10 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 flex flex-col text-right select-none"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2">
                    <div className="flex gap-1 overflow-x-auto">
                      {EMOJI_CATEGORIES.map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedEmojiTab(cat.id)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                            selectedEmojiTab === cat.id ? 'bg-[#3390ec] text-white shadow-sm' : 'hover:bg-white/5 text-[#708499]'
                          }`}
                        >
                          <span>{cat.icon}</span>
                          <span className="text-[11px]">{cat.name}</span>
                        </button>
                      ))}
                    </div>
                    <button 
                      type="button"
                      onClick={() => setShowEmojiPicker(false)}
                      className="p-1 hover:bg-white/5 rounded-lg text-[#708499] hover:text-white"
                    >
                      <X size={15}/>
                    </button>
                  </div>

                  <div className="grid grid-cols-7 sm:grid-cols-8 gap-1 max-h-52 overflow-y-auto custom-scrollbar p-1">
                    {(EMOJI_CATEGORIES.find(c => c.id === selectedEmojiTab)?.emojis || []).map((emoji, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleInsertEmoji(emoji)}
                        className="text-xl p-1.5 hover:bg-white/10 rounded-xl active:scale-125 transition-transform flex items-center justify-center cursor-pointer select-none"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button 
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
                className="p-2 text-[#708499] hover:text-[#3390ec] transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                title="اموجی"
              >
                <Smile size={22}/>
              </button>
              
              <textarea 
                ref={textareaRef}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  const sendOnEnter = readBooleanPreference(PREFERENCE_KEYS.sendOnEnter);
                  const shouldSend = e.key === 'Enter' && (sendOnEnter ? !e.shiftKey : (e.ctrlKey || e.metaKey));
                  if (shouldSend) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                placeholder={isGroup ? "پیام خود را بنویسید (برای تگ @ بزنید)..." : "پیام خود را بنویسید..."}
                className="chat-message-text flex-1 bg-transparent border-none outline-none mx-1 md:mx-2 py-2 max-h-36 resize-none custom-scrollbar placeholder:text-[#708499] text-white"
              />

              {/* Poll Button */}
              {isGroup && (
                <button 
                  type="button"
                  onClick={() => {
                  if (!memberCanSendPolls) {
                    showUploadError('ارسال نظرسنجی در این گروه توسط مدیران محدود شده است.');
                    return;
                  }
                  setShowPollModal(true);
                }} 
                  className="p-2 text-[#708499] hover:text-[#3390ec] transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                  title="ایجاد نظرسنجی"
                >
                  <BarChart2 size={20}/>
                </button>
              )}

              {/* Attachment Button */}
              <button 
                type="button"
                data-testid="chat-attach-file-btn"
                onClick={() => {
                  if (!memberCanSendMedia) {
                    showUploadError('ارسال رسانه و فایل در این گروه توسط مدیران محدود شده است.');
                    return;
                  }
                  fileInputRef.current?.click();
                }} 
                className="p-2 text-[#708499] hover:text-[#3390ec] transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                title={`ارسال فایل یا تصویر (حداکثر ${normalizeMaxUploadMb(systemConfig?.maxUploadSizeMb, 50)} مگابایت)`}
              >
                <Paperclip size={20}/>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                data-testid="chat-file-input"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>
            
            <button 
              type="button"
              onClick={() => inputText.trim() ? handleSend() : toggleRecording()}
              className={`min-h-[44px] min-w-[44px] p-3 rounded-full shadow-xl transition-all active:scale-90 flex items-center justify-center ${isRecording ? 'bg-red-500' : 'bg-[#3390ec] hover:bg-[#2881d9]'}`}
              title={inputText.trim() ? "ارسال پیام" : "ضبط صدا"}
            >
              {inputText.trim() ? (
                <Send size={20} className="text-white scale-x-[-1]" />
              ) : (
                isRecording ? <Square size={20} className="text-white fill-white" /> : <Mic size={20} className="text-white" />
              )}
            </button>
          </div>
        ) : (
          <div className="text-center p-3 text-[#708499] text-sm bg-[#17212b] rounded-xl border border-white/5">
            فقط مدیران می‌توانند در این کانال پیام ارسال کنند.
          </div>
        )}
      </footer>

      {/* Lightbox Modal with Interactive Zoom Suite */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/92 flex flex-col items-center justify-center p-4 select-none backdrop-blur-sm animate-in fade-in" 
          onClick={() => { setLightboxImage(null); handleResetZoom(); }}
          onMouseMove={handleZoomMouseMove}
          onMouseUp={handleZoomMouseUp}
          onTouchMove={handleZoomTouchMove}
          onTouchEnd={handleZoomTouchEnd}
        >
          {/* Top Floating Control Bar */}
          <div 
            className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1.5 bg-[#17212b]/95 border border-white/10 rounded-full shadow-2xl backdrop-blur-md z-20"
            onClick={e => e.stopPropagation()}
          >
            <button 
              type="button"
              onClick={handleZoomIn} 
              disabled={zoomScale >= 4}
              className="p-2 hover:bg-white/10 disabled:opacity-40 rounded-full text-white transition-all active:scale-95"
              title="بزرگنمایی (+)"
            >
              <ZoomIn size={18}/>
            </button>

            <span className="text-xs text-white/90 font-mono font-bold px-2 tabular-nums">
              {Math.round(zoomScale * 100)}%
            </span>

            <button 
              type="button"
              onClick={handleZoomOut} 
              disabled={zoomScale <= 0.5}
              className="p-2 hover:bg-white/10 disabled:opacity-40 rounded-full text-white transition-all active:scale-95"
              title="کوچک‌نمایی (-)"
            >
              <ZoomOut size={18}/>
            </button>

            <div className="w-px h-5 bg-white/20 mx-1" />

            <button 
              type="button"
              onClick={handleResetZoom} 
              className="p-2 hover:bg-white/10 rounded-full text-white transition-all active:scale-95 text-xs font-bold"
              title="اندازه طبیعی (100%)"
            >
              <RotateCcw size={17}/>
            </button>

            <a 
              href={lightboxImage} 
              download="starly_photo.jpg" 
              className="p-2 hover:bg-white/10 rounded-full text-white transition-all active:scale-95"
              title="دانلود تصویر"
            >
              <Download size={18}/>
            </a>

            <div className="w-px h-5 bg-white/20 mx-1" />

            <button 
              type="button"
              onClick={() => { setLightboxImage(null); handleResetZoom(); }} 
              className="p-2 hover:bg-red-500/20 text-red-400 rounded-full transition-all active:scale-95"
              title="بستن"
            >
              <X size={18}/>
            </button>
          </div>

          {/* Interactive Image Viewport */}
          <div 
            className="w-full h-full flex items-center justify-center overflow-hidden"
            onWheel={handleWheelZoom}
            onClick={e => e.stopPropagation()}
          >
            <img 
              src={lightboxImage} 
              onDoubleClick={handleDoubleTapZoom}
              onMouseDown={handleZoomMouseDown}
              onTouchStart={handleZoomTouchStart}
              draggable={false}
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                transition: isDragging ? 'none' : 'transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)',
                cursor: zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
                maxHeight: '85vh',
                maxWidth: '90vw'
              }}
              className="object-contain rounded-xl shadow-2xl select-none touch-none bg-white"
            />
          </div>

          {/* Bottom Zoom Guide */}
          <div 
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-1.5 rounded-full text-[11px] text-white/70 backdrop-blur-xs pointer-events-none"
          >
            دوبار کلیک برای بزرگنمایی سریع • اسکرول ماوس برای تنظیم زوم
          </div>
        </div>
      )}

      {/* Poll Creation Modal */}
      {showPollModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-[#17212b] rounded-2xl overflow-hidden shadow-2xl border border-white/10 p-5 space-y-4 animate-pop">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <BarChart2 size={18} className="text-[#3390ec]" />
                ایجاد نظرسنجی جدید
              </h3>
              <button onClick={() => setShowPollModal(false)} className="p-1 hover:bg-white/10 rounded-full text-[#708499]">
                <X size={18}/>
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#3390ec]">سوال نظرسنجی</label>
              <input 
                value={pollQuestion}
                onChange={e => setPollQuestion(e.target.value)}
                placeholder="سوال خود را مطرح کنید..."
                className="w-full bg-[#242f3d] p-3 rounded-xl text-white text-xs outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#708499]">گزینه‌ها</label>
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input 
                    value={opt}
                    onChange={e => {
                      const next = [...pollOptions];
                      next[i] = e.target.value;
                      setPollOptions(next);
                    }}
                    placeholder={`گزینه ${i + 1}`}
                    className="flex-1 bg-[#242f3d] p-2.5 rounded-xl text-white text-xs outline-none"
                  />
                  {pollOptions.length > 2 && (
                    <button 
                      onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))}
                      className="p-2 text-[#708499] hover:text-red-400"
                    >
                      <Trash size={15}/>
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 6 && (
                <button 
                  onClick={() => setPollOptions([...pollOptions, ''])}
                  className="text-xs text-[#3390ec] flex items-center gap-1 font-bold p-1 hover:underline"
                >
                  <Plus size={14}/> افزودن گزینه
                </button>
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-white/5">
              <input 
                type="checkbox" 
                checked={pollMultiple} 
                onChange={e => setPollMultiple(e.target.checked)} 
                className="accent-[#3390ec] rounded"
              />
              <span className="text-xs text-white">امکان انتخاب چند گزینه</span>
            </label>

            <button 
              onClick={handleCreatePoll}
              className="w-full py-3 bg-[#3390ec] hover:bg-[#2881d9] rounded-xl font-bold text-white text-xs transition-all active:scale-95 shadow-md shadow-[#3390ec]/20"
            >
              ارسال نظرسنجی
            </button>
          </div>
        </div>
      )}

      {/* Info Drawer Backdrop */}
      {showInfo && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 animate-in fade-in duration-200"
          onClick={() => setShowInfo(false)}
        />
      )}

      {/* Info Drawer */}
      <div className={`fixed inset-y-0 left-0 w-full md:w-[380px] bg-[#17212b] border-r border-black/30 z-50 transition-transform duration-300 shadow-2xl flex flex-col ${showInfo ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 flex items-center justify-between bg-[#242f3d] border-b border-black/20 shrink-0">
          <h3 className="font-bold text-white text-sm">
            {chat.type === 'private' ? 'پروفایل کاربر' : (chat.type === 'channel' ? 'اطلاعات کانال' : 'اطلاعات گروه')}
          </h3>
          <button onClick={() => setShowInfo(false)} className="p-1.5 hover:bg-white/10 rounded-full text-[#708499]">
            <X size={18}/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {chat.type === 'private' ? (
            /* 1-on-1 PRIVATE CHAT USER PROFILE VIEW (NO MEMBERS LIST) */
            (() => {
              const otherUser = chat.participants.find(p => p.id !== currentUser.id) || chat.participants[0];
              const isContact = (currentUser.contacts || []).includes(otherUser.id);
              const otherPresence = getUserPresence(otherUser, isContact);
              const chatPhotos = chat.messages.filter(m => !!m.imageUrl);
              const chatVoiceNotes = chat.messages.filter(m => !!m.audioUrl);
              const chatLinks = chat.messages.filter(m => m.text && (m.text.includes('http') || m.text.includes('@')));

              return (
                <div className="space-y-4 p-4 pb-8">
                  {/* Profile Header Avatar & Status */}
                  <div className="text-center pt-2 pb-4 border-b border-white/5 relative">
                    <div 
                      onClick={() => {
                        const avatarToZoom = otherUser.avatar || DEFAULT_AVATAR;
                        setLightboxImage(avatarToZoom);
                        setZoomScale(1);
                        setPanOffset({ x: 0, y: 0 });
                      }}
                      className="group/avatar relative w-24 h-24 mx-auto mb-3 cursor-pointer"
                      title="کلیک برای بزرگنمایی تصویر پروفایل"
                    >
                      <img 
                        src={otherUser.avatar || DEFAULT_AVATAR} 
                        onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                        className="w-24 h-24 rounded-full mx-auto object-cover shadow-2xl border-2 border-[#3390ec]/40 group-hover/avatar:scale-105 transition-all" 
                      />
                      {otherPresence.isOnline && (
                        <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#17212b]" />
                      )}
                      <div className="absolute inset-0 bg-black/30 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-bold">
                        <ZoomIn size={18} />
                      </div>
                    </div>
                    <h4 className="font-bold text-white text-lg">{otherUser.displayName}</h4>
                    <p className={`text-xs mt-0.5 font-medium ${otherPresence.isOnline ? 'text-green-400 font-bold' : 'text-[#708499]'}`}>
                      {otherPresence.label}
                    </p>
                  </div>

                  {/* Complementary Actions Row (Add Contact, Voice Call, Clear Chat) */}
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => onToggleContact?.(otherUser)}
                      className={`p-2.5 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 border ${isContact ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' : 'bg-[#3390ec]/15 border-[#3390ec]/30 text-[#3390ec] hover:bg-[#3390ec]/25'}`}
                    >
                      {isContact ? <UserMinus size={18}/> : <UserPlus size={18}/>}
                      <span className="text-[11px]">{isContact ? 'حذف مخاطب' : 'افزودن مخاطب'}</span>
                    </button>

                    

                    <button 
                      onClick={() => {
                        if (confirm(`آیا مطمئن هستید که می‌خواهید تمام پیام‌های گفتگو با ${otherUser.displayName} را پاک کنید؟`)) {
                          onAction('clearHistory', {});
                        }
                      }}
                      className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-red-500/15 hover:border-red-500/30 text-[#708499] hover:text-red-400 text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <Trash2 size={18}/>
                      <span className="text-[11px]">پاک کردن</span>
                    </button>
                  </div>

                  {/* Profile Details List (Empty fields are strictly omitted) */}
                  <div className="space-y-2.5 text-xs">
                    {/* Bio / About - Only rendered if entered */}
                    {Boolean(otherUser.bio && otherUser.bio.trim()) && (
                      <div className="p-3.5 bg-[#242f3d] rounded-2xl border border-white/5 space-y-1">
                        <div className="flex items-center gap-2 text-[#708499] text-[11px] font-bold">
                          <Info size={14} className="text-[#3390ec]"/>
                          <span>بیوگرافی</span>
                        </div>
                        <p className="text-white/95 leading-relaxed text-xs">
                          {otherUser.bio}
                        </p>
                      </div>
                    )}

                    {/* Username with Copy */}
                    <div className="p-3.5 bg-[#242f3d] rounded-2xl border border-white/5 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 text-[#708499] text-[11px] font-bold">
                          <AtSign size={14} className="text-[#3390ec]"/>
                          <span>نام کاربری</span>
                        </div>
                        <p className="text-[#3390ec] font-bold text-xs" dir="ltr">@{otherUser.username}</p>
                      </div>
                      <button 
                        onClick={() => handleCopyText(`@${otherUser.username}`, 'username')}
                        className="text-xs text-[#708499] hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-xl transition-colors font-medium"
                      >
                        {copiedField === 'username' ? <Check size={14} className="text-green-400"/> : <Copy size={14}/>}
                        <span>{copiedField === 'username' ? 'کپی شد' : 'کپی'}</span>
                      </button>
                    </div>

                    {/* Phone Number - Only rendered if user entered a phone number */}
                    {Boolean(otherUser.phone && otherUser.phone.trim()) && (
                      <div className="p-3.5 bg-[#242f3d] rounded-2xl border border-white/5 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 text-[#708499] text-[11px] font-bold">
                            <Phone size={14} className="text-[#3390ec]"/>
                            <span>شماره تماس</span>
                          </div>
                          <p className="text-white font-medium text-xs tabular-nums" dir="ltr">{otherUser.phone}</p>
                        </div>
                        <button 
                          onClick={() => handleCopyText(otherUser.phone || '', 'phone')}
                          className="text-xs text-[#708499] hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-xl transition-colors font-medium"
                        >
                          {copiedField === 'phone' ? <Check size={14} className="text-green-400"/> : <Copy size={14}/>}
                          <span>{copiedField === 'phone' ? 'کپی شد' : 'کپی'}</span>
                        </button>
                      </div>
                    )}

                    {/* Birthday - Only rendered if user entered a birthday */}
                    {Boolean(otherUser.birthday && otherUser.birthday.trim()) && (
                      <div className="p-3.5 bg-[#242f3d] rounded-2xl border border-white/5 space-y-1">
                        <div className="flex items-center gap-2 text-[#708499] text-[11px] font-bold">
                          <Calendar size={14} className="text-amber-400"/>
                          <span>تاریخ تولد</span>
                        </div>
                        <p className="text-white font-medium text-xs" dir="ltr">{otherUser.birthday}</p>
                      </div>
                    )}

                    {/* Telegram ID - Only rendered if entered */}
                    {(() => {
                      const cleanTg = otherUser.telegramId ? otherUser.telegramId.trim().replace(/^@/, '') : '';
                      if (!cleanTg) return null;
                      return (
                        <div className="p-3.5 bg-[#242f3d] rounded-2xl border border-white/5 flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 text-[#708499] text-[11px] font-bold">
                              <Send size={14} className="text-[#3390ec] -rotate-45"/>
                              <span>شناسه تلگرام</span>
                            </div>
                            <a 
                              href={`https://t.me/${cleanTg}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[#3390ec] hover:underline font-bold text-xs" 
                              dir="ltr"
                            >
                              @{cleanTg}
                            </a>
                          </div>
                          <button 
                            onClick={() => handleCopyText(`@${cleanTg}`, 'telegram')}
                            className="text-xs text-[#708499] hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-xl transition-colors font-medium"
                          >
                            {copiedField === 'telegram' ? <Check size={14} className="text-green-400"/> : <Copy size={14}/>}
                            <span>{copiedField === 'telegram' ? 'کپی شد' : 'کپی'}</span>
                          </button>
                        </div>
                      );
                    })()}

                    {/* Instagram ID - Only rendered if entered */}
                    {(() => {
                      const cleanIg = otherUser.instagramId ? otherUser.instagramId.trim().replace(/^@/, '') : '';
                      if (!cleanIg) return null;
                      return (
                        <div className="p-3.5 bg-[#242f3d] rounded-2xl border border-white/5 flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 text-[#708499] text-[11px] font-bold">
                              <Instagram size={14} className="text-pink-400"/>
                              <span>شناسه اینستاگرام</span>
                            </div>
                            <a 
                              href={`https://instagram.com/${cleanIg}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-pink-400 hover:underline font-bold text-xs" 
                              dir="ltr"
                            >
                              @{cleanIg}
                            </a>
                          </div>
                          <button 
                            onClick={() => handleCopyText(`@${cleanIg}`, 'instagram')}
                            className="text-xs text-[#708499] hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-xl transition-colors font-medium"
                          >
                            {copiedField === 'instagram' ? <Check size={14} className="text-green-400"/> : <Copy size={14}/>}
                            <span>{copiedField === 'instagram' ? 'کپی شد' : 'کپی'}</span>
                          </button>
                        </div>
                      );
                    })()}

                    {/* Mute Notifications Toggle */}
                    <div className="p-3.5 bg-[#242f3d] rounded-2xl border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl transition-colors ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-[#3390ec]/20 text-[#3390ec]'}`}>
                          {isMuted ? <BellOff size={18}/> : <Bell size={18}/>}
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-white">اعلان‌ها و صداها</h5>
                          <p className="text-[10px] text-[#708499]">{isMuted ? 'بی‌صدا شده' : 'فعال'}</p>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setIsMuted(!isMuted)}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${isMuted ? 'bg-white/20' : 'bg-[#3390ec]'}`}
                      >
                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${isMuted ? 'translate-x-0' : '-translate-x-5'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Shared Media Tabs */}
                  <div className="pt-2">
                    <div className="flex border-b border-white/5 text-xs mb-3">
                      <button 
                        onClick={() => setPrivateMediaTab('photos')}
                        className={`flex-1 py-2.5 text-center font-bold border-b-2 transition-colors ${privateMediaTab === 'photos' ? 'border-[#3390ec] text-[#3390ec]' : 'border-transparent text-[#708499] hover:text-white'}`}
                      >
                        تصاویر ({chatPhotos.length})
                      </button>
                      <button 
                        onClick={() => setPrivateMediaTab('voice')}
                        className={`flex-1 py-2.5 text-center font-bold border-b-2 transition-colors ${privateMediaTab === 'voice' ? 'border-[#3390ec] text-[#3390ec]' : 'border-transparent text-[#708499] hover:text-white'}`}
                      >
                        صداها ({chatVoiceNotes.length})
                      </button>
                      <button 
                        onClick={() => setPrivateMediaTab('links')}
                        className={`flex-1 py-2.5 text-center font-bold border-b-2 transition-colors ${privateMediaTab === 'links' ? 'border-[#3390ec] text-[#3390ec]' : 'border-transparent text-[#708499] hover:text-white'}`}
                      >
                        لینک‌ها ({chatLinks.length})
                      </button>
                    </div>

                    {/* Shared Media Content */}
                    {privateMediaTab === 'photos' && (
                      <div className="grid grid-cols-3 gap-2">
                        {chatPhotos.map(m => (
                          <div 
                            key={m.id} 
                            onClick={() => {
                              setLightboxImage(m.imageUrl || null);
                              setZoomScale(1);
                              setPanOffset({ x: 0, y: 0 });
                            }}
                            className="aspect-square rounded-xl overflow-hidden cursor-pointer group/thumb relative bg-[#242f3d]"
                            title="کلیک برای بزرگنمایی کامل تصویر"
                          >
                            <img 
                              src={m.imageUrl} 
                              className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-200"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <ZoomIn size={16}/>
                            </div>
                          </div>
                        ))}
                        {chatPhotos.length === 0 && (
                          <div className="col-span-3 text-center text-[#708499] text-xs py-8">
                            تصویری در این گفتگو ارسال نشده است.
                          </div>
                        )}
                      </div>
                    )}

                    {privateMediaTab === 'voice' && (
                      <div className="space-y-2">
                        {chatVoiceNotes.map(m => (
                          <div key={m.id} className="p-2.5 bg-[#242f3d] rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <button 
                                onClick={() => handlePlayAudio(m.id, m.audioUrl!)}
                                className="p-2 bg-[#3390ec] rounded-full text-white hover:bg-[#2881d9] active:scale-95 transition-all"
                              >
                                {playingAudioId === m.id ? <Pause size={14}/> : <Play size={14}/>}
                              </button>
                              <div>
                                <span className="text-xs text-white font-medium block">پیام صوتی</span>
                                <span className="text-[10px] text-[#708499]">
                                  {new Date(m.timestamp).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {chatVoiceNotes.length === 0 && (
                          <div className="text-center text-[#708499] text-xs py-8">
                            پیام صوتی ارسال نشده است.
                          </div>
                        )}
                      </div>
                    )}

                    {privateMediaTab === 'links' && (
                      <div className="space-y-2">
                        {chatLinks.map(m => (
                          <div key={m.id} className="p-2.5 bg-[#242f3d] rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                              <LinkIcon size={14} className="text-[#3390ec] shrink-0" />
                              <span className="text-xs text-[#3390ec] truncate font-medium" dir="ltr">{m.text}</span>
                            </div>
                            <button 
                              onClick={() => handleCopyText(m.text, m.id)}
                              className="text-[11px] text-[#708499] hover:text-white shrink-0 p-1"
                              title="کپی"
                            >
                              <Copy size={13}/>
                            </button>
                          </div>
                        ))}
                        {chatLinks.length === 0 && (
                          <div className="text-center text-[#708499] text-xs py-8">
                            لینک یا آدرسی در این گفتگو یافت نشد.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()
          ) : (
            /* GROUP & CHANNEL DRAWER VIEW (WITH MEMBERS LIST) */
            <>
              {/* Header Profile */}
              <div className="p-6 text-center border-b border-white/5">
                {canChangeInfo && (
                  <input
                    ref={drawerAvatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleDrawerAvatarUpload}
                  />
                )}
                <div 
                  onClick={() => {
                    if (canChangeInfo) drawerAvatarInputRef.current?.click();
                  }}
                  className={`w-20 h-20 rounded-full mx-auto mb-3 relative overflow-hidden shadow-lg border-2 border-white/10 group ${
                    canChangeInfo ? 'cursor-pointer hover:border-[#3390ec]' : ''
                  }`}
                  title={canChangeInfo ? "برای انتخاب و تغییر عکس کلیک کنید" : undefined}
                >
                  <img 
                    src={chatInfo.avatar || DEFAULT_AVATAR} 
                    onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                    className="w-full h-full object-cover" 
                  />
                  {canChangeInfo && (
                    <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white backdrop-blur-[2px]">
                      <Camera size={20} className="text-[#3390ec]" />
                      <span className="text-[9px] font-bold mt-0.5">تغییر عکس</span>
                    </div>
                  )}
                  {isUpdatingDrawerAvatar && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <RefreshCw size={20} className="text-[#3390ec] animate-spin" />
                    </div>
                  )}
                </div>
                <h4 className="font-bold text-white text-base">{chatInfo.title}</h4>
                <p className="text-xs text-[#708499] mt-0.5">{chatInfo.status}</p>

                {chat.description && (
                  <p className="text-xs text-white/80 mt-3 p-2.5 bg-black/20 rounded-xl leading-relaxed">
                    {chat.description}
                  </p>
                )}

                {canChangeInfo && (
                  <button
                    onClick={() => {
                      setEditGroupName(chat.groupName || '');
                      setEditGroupDesc(chat.description || '');
                      setEditGroupAvatar(chat.groupAvatar || '');
                      setEditIsPublic(Boolean(chat.isPublic));
                      setEditPublicHandle(chat.publicHandle || '');
                      setShowEditGroupModal(true);
                    }}
                    className="mt-3.5 w-full py-2 px-3 bg-[#3390ec]/15 border border-[#3390ec]/30 text-[#3390ec] hover:bg-[#3390ec]/25 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  >
                    <Edit3 size={14} />
                    <span>ویرایش اطلاعات {chat.type === 'channel' ? 'کانال' : 'گروه'}</span>
                  </button>
                )}
              </div>

              {/* Links & Handles */}
              <div className="p-4 space-y-2.5 border-b border-white/5 text-xs">
                {chat.publicHandle && (
                  <div className="flex items-center justify-between p-2.5 bg-[#242f3d] rounded-xl">
                    <span className="text-[#708499]">آیدی عمومی:</span>
                    <span className="text-[#3390ec] font-bold" dir="ltr">@{chat.publicHandle}</span>
                  </div>
                )}
                {chat.inviteLink && (
                  <div className="p-3 bg-[#242f3d] rounded-2xl space-y-2 border border-white/5">
                    <div className="flex justify-between items-center text-[#708499] text-xs">
                      <span className="font-bold">پیوند دعوت {chat.isPublic ? 'عمومی' : 'خصوصی'}:</span>
                      <button 
                        onClick={() => { navigator.clipboard.writeText(chat.inviteLink!); alert("پیوند دعوت با موفقیت کپی شد!"); }}
                        className="text-[#3390ec] hover:text-[#2881d9] flex items-center gap-1 font-bold bg-white/5 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        <Copy size={13}/> کپی پیوند
                      </button>
                    </div>
                    <p className="text-[11px] text-[#3390ec] font-mono truncate bg-black/25 p-2 rounded-xl" dir="ltr">{chat.inviteLink}</p>

                    {(isCreator || canInvite) && (
                      <button
                        onClick={() => {
                          if (confirm('آیا از باطل کردن پیوند دعوت قبلی و ایجاد پیوند جدید اطمینان دارید؟ پیوند قبلی دیگر معتبر نخواهد بود.')) {
                            onAction('regenerateInviteLink', {});
                          }
                        }}
                        className="w-full py-1.5 px-2 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 text-amber-400 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <RefreshCw size={13} />
                        <span>باطل کردن و ایجاد پیوند جدید</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Drawer Tabs */}
              <div className="grid grid-cols-2 border-b border-white/5 text-xs">
                <button 
                  onClick={() => setInfoTab('members')}
                  className={`py-3 text-center font-bold border-b-2 transition-colors ${infoTab === 'members' ? 'border-[#3390ec] text-[#3390ec]' : 'border-transparent text-[#708499]'}`}
                >
                  اعضا ({chat.participants.length})
                </button>
                <button 
                  onClick={() => setInfoTab('media')}
                  className={`py-3 text-center font-bold border-b-2 transition-colors ${infoTab === 'media' ? 'border-[#3390ec] text-[#3390ec]' : 'border-transparent text-[#708499]'}`}
                >
                  تصاویر ارسالی
                </button>
              </div>

              {/* Tab Contents */}
              <div className="p-4">
                {infoTab === 'members' ? (
                  <div className="space-y-2">
                    {chat.participants.map(p => {
                      const isOwner = chat.adminId === p.id;
                      const isMemberAdmin = Boolean(chat.admins?.[p.id]);

                      return (
                        <div 
                          key={p.id}
                          className="flex flex-col p-2.5 hover:bg-white/5 rounded-2xl transition-colors bg-[#242f3d]/40 border border-white/5 space-y-2"
                        >
                          <div className="flex items-center justify-between cursor-pointer" onClick={() => onUsernameClick(p.username)}>
                            <div className="flex items-center gap-2.5">
                              <div className="relative">
                                <img 
                                  src={p.avatar || DEFAULT_AVATAR} 
                                  onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                                  className="w-10 h-10 rounded-full object-cover border border-white/10"
                                />
                                {getUserPresence(p).isOnline && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#17212b]"/>}
                              </div>
                              <div>
                                <h5 className="font-bold text-xs text-white">{p.displayName}</h5>
                                <p className="text-[10px] text-[#708499]" dir="ltr">@{p.username}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {isOwner && (
                                <span className="text-[10px] text-amber-400 font-bold bg-amber-400/15 border border-amber-400/25 px-2 py-0.5 rounded-full">
                                  👑 مالک
                                </span>
                              )}
                              {isMemberAdmin && !isOwner && (
                                <span className="text-[10px] text-[#3390ec] font-bold bg-[#3390ec]/15 border border-[#3390ec]/25 px-2 py-0.5 rounded-full">
                                  🛡️ مدیر
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Creator / Admin Action Buttons for this Member */}
                          {p.id !== currentUser.id && !isOwner && (
                            <div className="flex items-center gap-1.5 pt-1 border-t border-white/5 justify-end">
                              {/* If Viewer is Owner/Creator */}
                              {isCreator && (
                                <>
                                  <button
                                    onClick={() => {
                                      setManagingAdminUser(p);
                                      setEditingAdminPerms(chat.admins?.[p.id] || DEFAULT_ADMIN_PERMISSIONS);
                                    }}
                                    className="px-2.5 py-1 bg-[#3390ec]/15 hover:bg-[#3390ec]/25 text-[#3390ec] rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-colors"
                                  >
                                    <Shield size={12}/>
                                    <span>{isMemberAdmin ? 'ویرایش اختیارات' : 'تعیین به عنوان مدیر'}</span>
                                  </button>

                                  {isMemberAdmin && (
                                    <button
                                      onClick={() => {
                                        if (confirm(`آیا مطمئن هستید که می‌خواهید مقام مدیریت ${p.displayName} را لغو کنید؟`)) {
                                          onAction('removeAdmin', { userId: p.id });
                                        }
                                      }}
                                      className="px-2 py-1 bg-white/5 hover:bg-white/10 text-[#708499] hover:text-white rounded-lg text-[10.5px] font-bold transition-colors"
                                    >
                                      عزل
                                    </button>
                                  )}
                                </>
                              )}

                              {/* Kick member (if Creator OR Admin with canBanUsers) */}
                              {(isCreator || (canBanMembers && !isMemberAdmin)) && (
                                <button
                                  onClick={() => {
                                    if (confirm(`آیا از اخراج ${p.displayName} از این گفتگو اطمینان دارید؟`)) {
                                      onAction('kickMember', { userId: p.id });
                                    }
                                  }}
                                  className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[10.5px] font-bold transition-colors"
                                >
                                  اخراج
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {chat.messages.filter(m => !!m.imageUrl).map(m => (
                      <div 
                        key={m.id}
                        onClick={() => {
                          setLightboxImage(m.imageUrl || null);
                          setZoomScale(1);
                          setPanOffset({ x: 0, y: 0 });
                        }}
                        className="w-full aspect-square rounded-xl overflow-hidden cursor-pointer group/grid relative bg-[#242f3d]"
                        title="کلیک برای بزرگنمایی کامل تصویر"
                      >
                        <img 
                          src={m.imageUrl}
                          className="w-full h-full object-cover group-hover/grid:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/grid:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <ZoomIn size={16}/>
                        </div>
                      </div>
                    ))}
                    {chat.messages.filter(m => !!m.imageUrl).length === 0 && (
                      <div className="col-span-3 text-center text-[#708499] text-xs py-10">
                        تصویری در این گفتگو ارسال نشده است.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Edit Group Modal (Only for groups: Complete 7 capabilities) */}
      {showEditGroupModal && isGroup && (
        <GroupEditModal
          chat={chat}
          currentUser={currentUser}
          chats={chats || []}
          onClose={() => setShowEditGroupModal(false)}
          onAction={onAction}
          onDeleteChat={onDeleteChat}
        />
      )}

      {/* Edit Channel Modal (Only for channels: Complete Telegram-spec capabilities) */}
      {showEditGroupModal && isChannel && (
        <ChannelEditModal
          chat={chat}
          currentUser={currentUser}
          chats={chats || []}
          onClose={() => setShowEditGroupModal(false)}
          onAction={onAction}
          onDeleteChat={onDeleteChat}
        />
      )}

      {/* Admin Permissions Modal */}
      {managingAdminUser && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setManagingAdminUser(null)}
        >
          <div 
            className="w-full max-w-md bg-[#17212b] rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col p-6 space-y-4 animate-pop text-right"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2.5">
                <Shield className="text-[#3390ec]" size={20}/>
                <div>
                  <h3 className="font-bold text-white text-sm">اختیارات مدیر</h3>
                  <p className="text-[10px] text-[#708499]">{managingAdminUser.displayName} (@{managingAdminUser.username})</p>
                </div>
              </div>
              <button onClick={() => setManagingAdminUser(null)} className="p-1 hover:bg-white/10 rounded-full text-[#708499]">
                <X size={18}/>
              </button>
            </div>

            <p className="text-xs text-[#708499]">
              مشخص کنید این مدیر چه کارهایی می‌تواند در {chat.type === 'channel' ? 'کانال' : 'گروه'} انجام دهد:
            </p>

            <div className="space-y-2.5 max-h-72 overflow-y-auto custom-scrollbar pr-1">
              {[
                { key: 'canChangeInfo', label: 'تغییر اطلاعات و مشخصات', desc: 'نام، توضیحات، آواتار و لینک گفتگو' },
                { key: 'canDeleteMessages', label: 'حذف پیام‌های سایر اعضا', desc: 'پاکسازی پیام‌های ارسالی دیگران' },
                { key: 'canBanUsers', label: 'مسدودسازی و اخراج اعضا', desc: 'اخراج اعضای متخلف از گروه' },
                { key: 'canInviteUsers', label: 'دعوت با پیوند اختصاصی', desc: 'مشاهده و اشتراک‌گذاری پیوند دعوت' },
                { key: 'canPinMessages', label: 'سنجاق کردن پیام‌ها', desc: 'پین کردن اعلان‌ها در بالای گفتگو' },
                { key: 'canAddAdmins', label: 'افزودن مدیران جدید', desc: 'انتصاب اعضای دیگر به عنوان ادمین' }
              ].map(perm => {
                const isChecked = Boolean(editingAdminPerms[perm.key as keyof AdminPermissions]);
                return (
                  <div 
                    key={perm.key}
                    onClick={() => setEditingAdminPerms(prev => ({ ...prev, [perm.key]: !isChecked }))}
                    className="flex items-center justify-between p-3 rounded-2xl bg-[#242f3d]/60 border border-white/5 cursor-pointer hover:bg-[#242f3d] transition-all"
                  >
                    <div>
                      <h5 className="text-xs font-bold text-white">{perm.label}</h5>
                      <p className="text-[10px] text-[#708499]">{perm.desc}</p>
                    </div>
                    <div className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${isChecked ? 'bg-[#3390ec]' : 'bg-white/20'}`}>
                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${isChecked ? '-translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setManagingAdminUser(null)}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-[#708499] hover:text-white rounded-xl text-xs font-bold transition-all"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  onAction('setAdminPermissions', {
                    userId: managingAdminUser.id,
                    permissions: editingAdminPerms
                  });
                  setManagingAdminUser(null);
                }}
                className="flex-1 py-2.5 bg-[#3390ec] hover:bg-[#2881d9] text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                ذخیره اختیارات مدیر
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification for successful copy or forward */}
      {copyToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#242f3d] border border-white/10 text-white px-4 py-2.5 rounded-full shadow-2xl text-xs font-bold flex items-center gap-2 animate-in slide-in-from-bottom duration-200 backdrop-blur-md">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{copyToast}</span>
        </div>
      )}

      {/* Toast notification for successful forward */}
      {forwardSuccessToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#3390ec] text-white px-4 py-2.5 rounded-full shadow-2xl text-xs font-bold flex items-center gap-2 animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 size={16} />
          <span>{forwardSuccessToast}</span>
        </div>
      )}

      {/* Telegram-style Multi-Select Forward Modal */}
      {forwardingMessage && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setForwardingMessage(null)}
        >
          <div 
            className="w-full max-w-md bg-[#17212b] rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[85vh] animate-pop text-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 bg-[#242f3d] border-b border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Share2 size={19} className="text-[#3390ec]" />
                <h3 className="font-bold text-white text-[15px]">هدایت پیام به...</h3>
              </div>
              <button 
                onClick={() => setForwardingMessage(null)}
                className="p-1.5 hover:bg-white/10 rounded-full text-[#708499] hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Message Preview Snippet */}
            <div className="p-3 bg-[#1e2a38] border-b border-white/5 shrink-0 flex items-center gap-3">
              <div className="w-1.5 h-10 bg-[#3390ec] rounded-full shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] text-[#3390ec] font-bold block mb-0.5">
                  پیش‌نمایش پیام ارسالی:
                </span>
                <p className="text-xs text-white/90 truncate">
                  {forwardingMessage.text || (forwardingMessage.imageUrl ? 'تصویر' : (forwardingMessage.audioUrl ? 'پیام صوتی' : 'پیام'))}
                </p>
              </div>
              {forwardingMessage.imageUrl && (
                <img src={forwardingMessage.imageUrl} className="w-10 h-10 rounded-lg object-cover bg-black/30 shrink-0" />
              )}
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-white/5 bg-[#17212b] shrink-0">
              <div className="relative">
                <Search size={16} className="absolute right-3.5 top-2.5 text-[#708499]" />
                <input 
                  value={forwardSearch}
                  onChange={(e) => setForwardSearch(e.target.value)}
                  placeholder="جستجو در گفتگوها و مخاطبین..."
                  className="w-full bg-[#242f3d] py-2 pr-10 pl-3 rounded-xl text-xs text-white outline-none focus:bg-[#0e1621] border border-transparent focus:border-[#3390ec]/30"
                  autoFocus
                />
                {forwardSearch && (
                  <button onClick={() => setForwardSearch('')} className="absolute left-3 top-2.5 text-[#708499]">
                    <X size={15}/>
                  </button>
                )}
              </div>
            </div>

            {/* List of Target Chats (Saved Messages + Recent Chats) */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {/* 1. Saved Messages Quick Row */}
              {(() => {
                const savedChat = chats.find(c => c.type === 'saved');
                const savedId = savedChat?.id || `saved_${currentUser.id}`;
                const isSavedSelected = selectedForwardChatIds.includes(savedId);

                return (
                  <div 
                    onClick={() => {
                      setSelectedForwardChatIds(prev => 
                        prev.includes(savedId) ? prev.filter(id => id !== savedId) : [...prev, savedId]
                      );
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all active:scale-[0.99] ${isSavedSelected ? 'bg-[#3390ec]/20 border border-[#3390ec]/40' : 'hover:bg-[#242f3d]'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#3390ec] flex items-center justify-center shrink-0 shadow-inner">
                        <Bookmark size={20} className="text-white fill-current" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-white">پیام‌های ذخیره شده</h4>
                        <p className="text-[10px] text-[#708499]">فضای ابری اختصاصی من</p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${isSavedSelected ? 'bg-[#3390ec] border-[#3390ec]' : 'border-white/20'}`}>
                      {isSavedSelected && <Check size={13} className="text-white" />}
                    </div>
                  </div>
                );
              })()}

              <div className="px-2 pt-2 pb-1 text-[10px] font-bold text-[#708499]">
                سایر گفتگوها
              </div>

              {/* Other Available Chats */}
              {chats.filter(c => {
                if (c.type === 'saved') return false;
                if (c.deletedForUserIds?.includes(currentUser.id)) return false;
                const q = forwardSearch.trim().toLowerCase();
                if (!q) return true;
                if (c.type === 'private') {
                  const other = c.participants.find(p => p.id !== currentUser.id);
                  return other?.displayName.toLowerCase().includes(q) || other?.username.toLowerCase().includes(q);
                }
                return c.groupName?.toLowerCase().includes(q);
              }).map(targetChat => {
                const isSelected = selectedForwardChatIds.includes(targetChat.id);
                const other = targetChat.participants.find(p => p.id !== currentUser.id);
                const title = targetChat.type === 'private' ? (other?.displayName || 'کاربر') : targetChat.groupName;
                const avatar = targetChat.type === 'private' ? other?.avatar : targetChat.groupAvatar;

                return (
                  <div 
                    key={targetChat.id}
                    onClick={() => {
                      setSelectedForwardChatIds(prev => 
                        prev.includes(targetChat.id) ? prev.filter(id => id !== targetChat.id) : [...prev, targetChat.id]
                      );
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all active:scale-[0.99] ${isSelected ? 'bg-[#3390ec]/20 border border-[#3390ec]/40' : 'hover:bg-[#242f3d]'}`}
                  >
                    <div className="flex items-center gap-3">
                      <img 
                        src={avatar || DEFAULT_AVATAR} 
                        onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                        className="w-10 h-10 rounded-full object-cover bg-[#242f3d] border border-white/5"
                      />
                      <div>
                        <h4 className="font-bold text-xs text-white">{title}</h4>
                        <p className="text-[10px] text-[#708499]">
                          {targetChat.type === 'private' ? (other ? `@${other.username}` : 'شخصی') : (targetChat.type === 'group' ? 'گروه' : 'کانال')}
                        </p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${isSelected ? 'bg-[#3390ec] border-[#3390ec]' : 'border-white/20'}`}>
                      {isSelected && <Check size={13} className="text-white" />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Action Bar */}
            <div className="p-3 bg-[#242f3d] border-t border-white/5 flex items-center justify-between shrink-0">
              <span className="text-xs text-[#708499]">
                {selectedForwardChatIds.length > 0 ? (
                  <span className="text-[#3390ec] font-bold">
                    {selectedForwardChatIds.length} گفتگو انتخاب شده
                  </span>
                ) : (
                  'یک یا چند گفتگو را انتخاب کنید'
                )}
              </span>

              <button 
                disabled={selectedForwardChatIds.length === 0}
                onClick={() => {
                  if (!forwardingMessage || selectedForwardChatIds.length === 0) return;
                  const originalSender = chat?.participants.find(p => p.id === forwardingMessage.senderId)?.displayName || currentUser.displayName;
                  onAction('forwardMessage', {
                    targetChatIds: selectedForwardChatIds,
                    message: forwardingMessage,
                    senderDisplayName: originalSender
                  });
                  setForwardSuccessToast(`پیام به ${selectedForwardChatIds.length} گفتگو با موفقیت هدایت شد.`);
                  setForwardingMessage(null);
                  setSelectedForwardChatIds([]);
                  setTimeout(() => setForwardSuccessToast(null), 3000);
                }}
                className="py-2.5 px-5 bg-[#3390ec] hover:bg-[#2881d9] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95 shadow-md shadow-[#3390ec]/25"
              >
                <Share2 size={15} />
                <span>ارسال و هدایت</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Per-Chat Custom Wallpaper Modal */}
      {showWallpaperModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowWallpaperModal(false)}
        >
          <div 
            className="w-full max-w-md bg-[#17212b] rounded-3xl overflow-hidden border border-white/10 shadow-2xl p-5 space-y-4 animate-pop max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Palette size={18} className="text-[#3390ec]" />
                <span>پس‌زمینه اختصاصی این گفتگو</span>
              </h3>
              <button onClick={() => setShowWallpaperModal(false)} className="p-1 hover:bg-white/10 rounded-full text-[#708499]">
                <X size={18}/>
              </button>
            </div>

            <p className="text-xs text-[#708499]">
              می‌توانید برای این گفتگو یک پس‌زمینه ویژه مشخص کنید یا از طرح‌های آماده استفاده کنید:
            </p>

            <div className="grid grid-cols-3 gap-2 overflow-y-auto custom-scrollbar p-1">
              {WALLPAPER_PRESETS.map((p) => {
                const isSelected = (chat.wallpaper || '') === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      onAction('updateChatWallpaper', { wallpaper: p.id });
                    }}
                    className={`group relative rounded-xl p-2 h-24 border cursor-pointer transition-all flex flex-col justify-between overflow-hidden shadow-sm hover:scale-[1.02] ${
                      isSelected ? 'border-[#3390ec] ring-2 ring-[#3390ec]/30' : 'border-white/10 hover:border-white/20'
                    }`}
                    style={p.style}
                  >
                    <span className="text-[9px] font-bold text-white/90 bg-black/50 px-1.5 py-0.5 rounded-full backdrop-blur-xs truncate">
                      {p.name}
                    </span>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-[#3390ec] text-white flex items-center justify-center shadow-md self-end">
                        <Check size={12} className="stroke-[3]" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Custom File Upload & URL */}
            <div className="bg-[#242f3d] p-3 rounded-2xl border border-white/5 space-y-2.5">
              <input
                ref={chatWallpaperFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const maxMb = systemConfig?.maxUploadSizeMb || 15;
                    if (file.size > maxMb * 1024 * 1024) {
                      alert(`حجم تصویر انتخابی (${(file.size / (1024 * 1024)).toFixed(1)} مگابایت) از سقف مجاز (${maxMb} مگابایت) بیشتر است.`);
                      if (e.target) e.target.value = '';
                      return;
                    }
                    try {
                      const compressed = await compressImage(file, 1280, 1280, 0.82);
                      onAction('updateChatWallpaper', { wallpaper: compressed });
                    } catch (err) {
                      console.error('Wallpaper compression error:', err);
                    }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => chatWallpaperFileRef.current?.click()}
                className="w-full py-2 bg-[#3390ec]/15 hover:bg-[#3390ec]/25 border border-[#3390ec]/40 rounded-xl text-xs font-bold text-[#3390ec] flex items-center justify-center gap-1.5 transition-all"
              >
                <ImageIcon size={14} />
                <span>بارگذاری عکس دلخواه از دستگاه</span>
              </button>

              <div className="flex items-center gap-2">
                <input
                  value={customChatWallpaperUrl}
                  onChange={(e) => setCustomChatWallpaperUrl(e.target.value)}
                  placeholder="آدرس اینترنتی تصویر..."
                  dir="ltr"
                  className="flex-1 bg-[#17212b] p-2 rounded-xl text-xs text-white outline-none border border-white/5 focus:border-[#3390ec] transition-colors"
                />
                <button
                  type="button"
                  disabled={!customChatWallpaperUrl.trim()}
                  onClick={() => {
                    if (customChatWallpaperUrl.trim()) {
                      onAction('updateChatWallpaper', { wallpaper: customChatWallpaperUrl.trim() });
                      setCustomChatWallpaperUrl('');
                    }
                  }}
                  className="py-2 px-3 bg-[#3390ec] hover:bg-[#2881d9] disabled:opacity-40 rounded-xl text-xs font-bold text-white transition-all"
                >
                  اعمال
                </button>
              </div>
            </div>

            {chat.wallpaper && (
              <button
                type="button"
                onClick={() => {
                  onAction('updateChatWallpaper', { wallpaper: '' });
                }}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-[#708499] hover:text-white flex items-center justify-center gap-1.5 transition-colors"
              >
                <RotateCcw size={14} />
                <span>استفاده از پس‌زمینه پیش‌فرض کلی برنامه</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Phone Verification Required Notice Modal */}
      {showPhoneVerifyRequiredModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setShowPhoneVerifyRequiredModal(false)}
        >
          <div 
            className="w-full max-w-sm bg-[#17212b] border border-[#242f3d] rounded-3xl p-6 shadow-2xl text-center space-y-4 animate-pop"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-400 mx-auto flex items-center justify-center">
              <Phone size={28} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">تایید شماره موبایل الزامی است</h3>
              <p className="text-xs text-gray-300 mt-2 leading-relaxed">
                طبق تنظیمات مدیریت سیستم، فقط کاربرانی که شماره موبایل خود را تایید کرده باشند مجاز به ارسال پیام و رسانه هستند.
              </p>
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[11px] text-amber-300 leading-relaxed">
              لطفاً از منوی سمت راست وارد «پروفایل من» شوید و شماره همراه خود را با کد تایید پیامکی فعال نمایید.
            </div>
            <button
              onClick={() => setShowPhoneVerifyRequiredModal(false)}
              className="w-full py-2.5 bg-[#3390ec] hover:bg-[#2881d9] text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
            >
              متوجه شدم
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatArea;
