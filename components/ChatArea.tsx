import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Chat, User, Message, Poll, DEFAULT_AVATAR } from '../types';
import { 
  Send, Paperclip, Smile, MessageCircle, Trash, Mic, Info, X, 
  ChevronLeft, UserMinus, UserPlus, Image as ImageIcon, 
  Pin, Reply, BarChart2, Volume2, Square, Plus, CheckCheck, MoreVertical,
  Link as LinkIcon, Edit3, Shield, Copy, Users, Bookmark, RotateCcw, Clock, Lock, 
  ArrowRight, Search, Play, Pause, Download, Share2, Globe, Heart, ThumbsUp, Flame, Check,
  ZoomIn, ZoomOut, Phone, Bell, BellOff, Trash2, AtSign, FileText, CheckCircle2, Flag
} from 'lucide-react';
import { compressImage } from '../services/imageUtils';
import { encryptMessage } from '../services/cryptoUtils';

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
}

const POPULAR_REACTIONS = ['❤️', '👍', '🔥', '😂', '👏', '🎉'];

const ChatArea: React.FC<ChatAreaProps> = ({ 
  chat, currentUser, isTyping, onAction, onDeleteChat, onBack, onUsernameClick, onToggleContact,
  chats = [], onOpenSavedMessages, onReportMessage
}) => {
  const [inputText, setInputText] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  // Message Forwarding Modal State
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [forwardSearch, setForwardSearch] = useState('');
  const [selectedForwardChatIds, setSelectedForwardChatIds] = useState<string[]>([]);
  const [forwardSuccessToast, setForwardSuccessToast] = useState<string | null>(null);
  
  // Right-Click & Mobile Long-Press Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    message: Message;
  } | null>(null);
  const touchTimerRef = useRef<any>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

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

  // Info Drawer Tab
  const [infoTab, setInfoTab] = useState<'members' | 'media'>('members');

  const msgEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<any>(null);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat?.messages.length, isTyping, chat?.id]);

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
        isSaved: true
      };
    }
    const otherParticipant = chat.participants.find(p => p.id !== currentUser.id);
    if (chat.type === 'private') {
      return {
        title: otherParticipant?.displayName || 'کاربر استارلی',
        avatar: otherParticipant?.avatar,
        status: isTyping ? 'درحال نوشتن...' : (otherParticipant?.status === 'online' ? 'آنلاین' : 'آخرین بازدید به تازگی'),
        isSaved: false
      };
    }
    return {
      title: chat.groupName || 'گروه استارلی',
      avatar: chat.groupAvatar,
      status: isTyping ? 'درحال نوشتن...' : `${chat.participants.length} عضو`,
      isSaved: false
    };
  }, [chat, currentUser, isTyping]);

  if (!chat || !chatInfo) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0e1621] text-[#708499]">
        <div className="bg-[#17212b] p-8 rounded-full mb-4 shadow-2xl animate-pulse">
          <MessageCircle size={64} className="opacity-30 text-[#3390ec]" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">پیام‌رسان استارلی چت</h2>
        <p className="text-sm font-medium opacity-60">یک گفتگو را از منوی سمت راست برای شروع انتخاب کنید</p>
      </div>
    );
  }

  const isAdmin = chat.adminId === currentUser.id;
  const isChannel = chat.type === 'channel';
  const isGroup = chat.type === 'group';

  // Filter messages based on search
  const filteredMessages = chat.messages.filter(m => {
    if (!searchInChat.trim()) return true;
    return m.text.toLowerCase().includes(searchInChat.toLowerCase());
  });

  // Pinned messages
  const pinnedMessages = (chat.pinnedMessageIds || [])
    .map(id => chat.messages.find(m => m.id === id))
    .filter(Boolean) as Message[];

  const handleSend = async () => {
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
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Compress to lightweight canvas image (max 800px, 0.8 quality ~40KB)
      const compressedDataUrl = await compressImage(file, 800, 800, 0.8);
      // Clean send: send user caption if any, otherwise empty string (NO dummy 'تصویر' text!)
      onAction('send', { 
        text: inputText.trim() || '', 
        imageUrl: compressedDataUrl,
        replyToId: replyingTo?.id 
      });
      setInputText('');
      setReplyingTo(null);
    } catch (err) {
      console.error("Image upload error:", err);
      alert("خطا در پردازش تصویر");
    }
  };

  const toggleRecording = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            // Clean send: send user caption if any, otherwise empty string (NO dummy 'پیام صوتی' text!)
            onAction('send', { 
              text: inputText.trim() || '', 
              audioUrl: reader.result,
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
        alert('دسترسی به میکروفون مسدود است.');
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

  // Context Menu Handlers (Desktop Right-Click & Mobile Long-Press)
  const handleContextMenu = (e: React.MouseEvent, msg: Message) => {
    e.preventDefault();
    const x = Math.min(e.clientX, window.innerWidth - 240);
    const y = Math.min(e.clientY, window.innerHeight - 340);
    setContextMenu({ x, y, message: msg });
  };

  const handleTouchStart = (e: React.TouchEvent, msg: Message) => {
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(40);
      const x = Math.min(touch.clientX, window.innerWidth - 240);
      const y = Math.min(touch.clientY, window.innerHeight - 340);
      setContextMenu({ x, y, message: msg });
    }, 480);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    }
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
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

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#0e1621] relative overflow-hidden chat-wallpaper font-['Vazirmatn']">
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
              {chat.type === 'private' && chat.participants.find(p=>p.id!==currentUser.id)?.status === 'online' && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#17212b]" />
              )}
            </div>
            <div className="overflow-hidden min-w-0">
              <div className="flex items-center gap-1.5">
                <span title="گفتگوی امن رمزشده با کلید ۲۵۶ بیتی Web Crypto" className="text-emerald-400 shrink-0 flex items-center">
                  <Lock size={14} className="stroke-[2.5]" />
                </span>
                <h3 className="font-bold text-[15px] text-white truncate">{chatInfo.title}</h3>
                {chat.isPublic && (
                  <span title="گروه عمومی" className="shrink-0 flex items-center">
                    <Globe size={13} className="text-[#3390ec]" />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-[11px] text-[#3390ec] font-medium truncate">{chatInfo.status}</p>
                <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-0.5" title="امنیت سرتاسری E2EE فعال">
                  <span>·</span>
                  <span>E2EE AES-256</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-1 shrink-0">
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
      <main className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3.5 custom-scrollbar pb-8">
        {filteredMessages.map((msg) => {
          const isMe = msg.senderId === currentUser.id;
          const sender = chat.participants.find(p => p.id === msg.senderId);
          const isPinned = chat.pinnedMessageIds?.includes(msg.id);

          return (
            <div 
              key={msg.id} 
              id={msg.id}
              className={`flex w-full animate-msg ${isMe ? 'justify-start' : 'justify-end'}`}
            >
              <div className="flex items-end gap-2 max-w-[88%] md:max-w-[78%] group">
                
                {/* Desktop Hover Actions Menu */}
                <div className="hidden md:flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-center">
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
                  <button 
                    onClick={() => setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id)} 
                    className="p-1.5 bg-[#17212b]/80 hover:bg-[#3390ec] rounded-full text-[#708499] hover:text-white transition-all shadow-sm"
                    title="واکنش"
                  >
                    <Smile size={13} />
                  </button>
                </div>

                {/* Message Bubble (With Right-Click and Mobile Long-Press) */}
                <div 
                  className="relative select-text"
                  onContextMenu={(e) => handleContextMenu(e, msg)}
                  onTouchStart={(e) => handleTouchStart(e, msg)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  {/* Floating Reaction Bar when toggled */}
                  {activeReactionMsgId === msg.id && (
                    <div className="absolute -top-11 left-0 z-30 bg-[#17212b] border border-white/10 rounded-full p-1 flex items-center gap-1 shadow-2xl animate-pop">
                      {POPULAR_REACTIONS.map(emoji => (
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

                  <div className={`message-bubble p-2.5 md:p-3 shadow-md relative rounded-2xl ${isMe ? 'bg-[#2b5278] rounded-tr-none text-white' : 'bg-[#182533] rounded-tl-none text-white'}`}>
                    {/* Sender Name in Groups */}
                    {isGroup && !isMe && sender && (
                      <div 
                        className="text-[12px] font-bold text-[#3390ec] mb-1 cursor-pointer hover:underline"
                        onClick={() => onUsernameClick(sender.username)}
                      >
                        {sender.displayName}
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
                          setLightboxImage(msg.imageUrl || null);
                          setZoomScale(1);
                          setPanOffset({ x: 0, y: 0 });
                        }}
                        className="rounded-xl overflow-hidden cursor-pointer group/img relative mb-1.5 bg-black/20"
                        title="کلیک برای بزرگنمایی کامل تصویر"
                      >
                        <img 
                          src={msg.imageUrl} 
                          className="max-h-[360px] w-full object-cover rounded-xl transition-transform duration-200 group-hover/img:scale-[1.02]" 
                        />
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
                      <p className="text-[14px] leading-relaxed whitespace-pre-wrap font-normal">
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

                    {/* Metadata (Time & Delivery Ticks) */}
                    <div className="flex items-center justify-end gap-1 mt-1 opacity-60 select-none">
                      {msg.isEncrypted && (
                        <span title="رمزگذاری شده با کلید AES-256" className="text-emerald-400">
                          <Lock size={10} />
                        </span>
                      )}
                      {msg.isEdited && <span className="text-[9px]">ویرایش شده</span>}
                      <span className="text-[9px] tabular-nums">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                      </span>
                      {isMe && <CheckCheck size={12} className="text-[#3390ec]" />}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          );
        })}
        <div ref={msgEndRef} />
      </main>

      {/* Floating Context Menu (Right-Click & Mobile Long-Press) */}
      {contextMenu && (
        <div 
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs animate-in fade-in"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
        >
          <div 
            className="fixed bg-[#17212b] border border-white/10 rounded-2xl shadow-2xl p-2 w-56 space-y-1 animate-pop z-50 text-xs"
            style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Quick Reaction Bar */}
            <div className="flex items-center justify-between p-1.5 bg-[#242f3d] rounded-xl mb-1">
              {POPULAR_REACTIONS.map(emoji => (
                <button 
                  key={emoji}
                  onClick={() => {
                    onAction('react', { messageId: contextMenu.message.id, emoji });
                    setContextMenu(null);
                  }}
                  className="w-7 h-7 flex items-center justify-center hover:scale-130 transition-transform text-sm"
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
                  alert("متن پیام کپی شد!");
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

            {(contextMenu.message.senderId === currentUser.id || isAdmin) && (
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

        {(!isChannel || isAdmin || chatInfo.isSaved) ? (
          <div className="flex items-end gap-2 max-w-5xl mx-auto">
            <div className="flex-1 bg-[#242f3d] rounded-[22px] flex items-center px-2 md:px-3 py-1 shadow-lg border border-white/5 focus-within:border-[#3390ec]/30 transition-all">
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
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                placeholder={isGroup ? "پیام خود را بنویسید (برای تگ @ بزنید)..." : "پیام خود را بنویسید..."}
                className="flex-1 bg-transparent border-none outline-none text-[14px] mx-1 md:mx-2 py-2 max-h-36 resize-none custom-scrollbar placeholder:text-[#708499] text-white"
              />

              {/* Poll Button */}
              {isGroup && (
                <button 
                  type="button"
                  onClick={() => setShowPollModal(true)} 
                  className="p-2 text-[#708499] hover:text-[#3390ec] transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                  title="ایجاد نظرسنجی"
                >
                  <BarChart2 size={20}/>
                </button>
              )}

              {/* Attachment Button */}
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()} 
                className="p-2 text-[#708499] hover:text-[#3390ec] transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                title="ارسال تصویر"
              >
                <Paperclip size={20}/>
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
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
              className="object-contain rounded-xl shadow-2xl select-none touch-none"
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
              const isContact = (currentUser.contacts || ['u_support', 'u_ali', 'u_sara']).includes(otherUser.id);
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
                      {otherUser.status === 'online' && (
                        <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#17212b]" />
                      )}
                      <div className="absolute inset-0 bg-black/30 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-bold">
                        <ZoomIn size={18} />
                      </div>
                    </div>
                    <h4 className="font-bold text-white text-lg">{otherUser.displayName}</h4>
                    <p className={`text-xs mt-0.5 font-medium ${otherUser.status === 'online' ? 'text-[#3390ec]' : 'text-[#708499]'}`}>
                      {otherUser.status === 'online' ? 'آنلاین' : 'آخرین بازدید به تازگی'}
                    </p>
                  </div>

                  {/* Complementary Actions Row (Add Contact, Voice Call, Clear Chat) */}
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => onToggleContact?.(otherUser)}
                      className={`p-2.5 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 border ${isContact ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' : 'bg-[#3390ec]/15 border-[#3390ec]/30 text-[#3390ec] hover:bg-[#3390ec]/25'}`}
                    >
                      {isContact ? <UserMinus size={18}/> : <UserPlus size={18}/>}
                      <span className="text-[11px]">{isContact ? 'حذف مخاطب' : 'افزودن مخاطب'}</span>
                    </button>

                    <button 
                      onClick={() => alert(`درحال برقراری تماس صوتی با ${otherUser.displayName}...`)}
                      className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-white text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <Phone size={18} className="text-green-400"/>
                      <span className="text-[11px]">تماس صوتی</span>
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

                  {/* Profile Details List */}
                  <div className="space-y-2.5 text-xs">
                    {/* Bio / About */}
                    <div className="p-3.5 bg-[#242f3d] rounded-2xl border border-white/5 space-y-1">
                      <div className="flex items-center gap-2 text-[#708499] text-[11px] font-bold">
                        <Info size={14} className="text-[#3390ec]"/>
                        <span>بیوگرافی</span>
                      </div>
                      <p className="text-white/95 leading-relaxed text-xs">
                        {otherUser.bio || 'توسعه‌دهنده وب و علاقه‌مند به تکنولوژی'}
                      </p>
                    </div>

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

                    {/* Phone Number */}
                    <div className="p-3.5 bg-[#242f3d] rounded-2xl border border-white/5 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 text-[#708499] text-[11px] font-bold">
                          <Phone size={14} className="text-[#3390ec]"/>
                          <span>شماره تماس</span>
                        </div>
                        <p className="text-white font-medium text-xs tabular-nums" dir="ltr">+98 912 345 6789</p>
                      </div>
                      <button 
                        onClick={() => handleCopyText('+989123456789', 'phone')}
                        className="text-xs text-[#708499] hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-xl transition-colors font-medium"
                      >
                        {copiedField === 'phone' ? <Check size={14} className="text-green-400"/> : <Copy size={14}/>}
                        <span>{copiedField === 'phone' ? 'کپی شد' : 'کپی'}</span>
                      </button>
                    </div>

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
                <img 
                  src={chatInfo.avatar || DEFAULT_AVATAR} 
                  onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                  className="w-20 h-20 rounded-full mx-auto mb-3 object-cover shadow-lg border-2 border-white/10" 
                />
                <h4 className="font-bold text-white text-base">{chatInfo.title}</h4>
                <p className="text-xs text-[#708499] mt-0.5">{chatInfo.status}</p>

                {chat.description && (
                  <p className="text-xs text-white/80 mt-3 p-2.5 bg-black/20 rounded-xl leading-relaxed">
                    {chat.description}
                  </p>
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
                  <div className="p-2.5 bg-[#242f3d] rounded-xl space-y-1">
                    <div className="flex justify-between items-center text-[#708499]">
                      <span>لینک دعوت:</span>
                      <button 
                        onClick={() => { navigator.clipboard.writeText(chat.inviteLink!); alert("لینک دعوت کپی شد!"); }}
                        className="text-[#3390ec] hover:underline flex items-center gap-1 font-bold"
                      >
                        <Copy size={13}/> کپی لینک
                      </button>
                    </div>
                    <p className="text-[11px] text-white/80 truncate" dir="ltr">{chat.inviteLink}</p>
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
                    {chat.participants.map(p => (
                      <div 
                        key={p.id}
                        onClick={() => onUsernameClick(p.username)}
                        className="flex items-center justify-between p-2 hover:bg-white/5 rounded-xl cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="relative">
                            <img 
                              src={p.avatar || DEFAULT_AVATAR} 
                              onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                              className="w-9 h-9 rounded-full object-cover"
                            />
                            {p.status === 'online' && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#17212b]"/>}
                          </div>
                          <div>
                            <h5 className="font-bold text-xs text-white">{p.displayName}</h5>
                            <p className="text-[10px] text-[#708499]">@{p.username}</p>
                          </div>
                        </div>
                        {chat.adminId === p.id && (
                          <span className="text-[10px] text-[#3390ec] font-bold bg-[#3390ec]/15 px-2 py-0.5 rounded-full">
                            مدیر
                          </span>
                        )}
                      </div>
                    ))}
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
    </div>
  );
};

export default ChatArea;
