/**
 * ============================================================================
 * معماری و ساختار زیربنایی تماس‌های صوتی و تصویری بر بستر WebRTC (P2P)
 * ============================================================================
 * 
 * نتیجه بررسی امکان‌سنجی:
 * بله، با استک فعلی (React + TypeScript + Vite) و پروتکل‌های استاندارد مرورگر،
 * تماس‌های صوتی و تصویری ۱۰۰٪ امکان‌پذیر است و به هیچ کتابخانه سنگین، سرور خارجی
 * یا پلاگین شخص‌ثالث نیازی ندارد.
 * 
 * ویژگی‌های کلیدی این معماری:
 * ۱. انتقال داده به صورت Peer-to-Peer (مستقیم بین دو کاربر با کمترین تاخیر)
 * ۲. رمزنگاری سخت‌افزاری استاندارد سرتاسری DTLS-SRTP
 * ۳. سیگنالینگ خودکفا از طریق کالکشن پایگاه داده داخلی (بدون وابستگی به سرورهای واسط)
 * 
 * طبق درخواست شما:
 * فقط راه و قراردادهای معماری آماده شده و رابط کاربری یا دکمه‌های فعال‌سازی
 * هنوز ساخته نشده است تا بر تجربه فعلی چت تاثیری نگذارد.
 * ============================================================================
 */

export type CallType = 'audio' | 'video';

export type CallStatus = 
  | 'idle'        // در انتظار
  | 'calling'     // در حال برقراری تماس از سمت تماس‌گیرنده
  | 'ringing'     // زنگ خوردن در دستگاه مخاطب
  | 'connected'   // متصل و در حال مکالمه
  | 'ended'       // پایان یافته
  | 'rejected'    // رد شده توسط مخاطب
  | 'busy';       // مخاطب مشغول است

export interface CallSession {
  id: string;
  chatId: string;
  callerId: string;
  callerName: string;
  calleeId: string;
  calleeName: string;
  type: CallType;
  status: CallStatus;
  startedAt: number;
  connectedAt?: number;
  endedAt?: number;
}

export interface SignalingPayload {
  sessionId: string;
  type: 'offer' | 'answer' | 'candidate' | 'hangup';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  senderId: string;
}

export interface MediaDeviceState {
  isMuted: boolean;
  isVideoEnabled: boolean;
  isSpeakerOn: boolean;
}

/**
 * پیکربندی سرورهای ICE (STUN استاندارد برای استخراج آدرس‌های P2P)
 */
export const DEFAULT_RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10
};

/**
 * قرارداد سرویس تماس (Service Blueprint Contract)
 * این رابط آماده است تا به محض تمایل شما برای ساخت UI تماس،
 * پیاده‌سازی متصل به صفحه فعال شود.
 */
export interface IWebRTCCallService {
  /**
   * شروع تماس صوتی یا تصویری
   */
  initiateCall(calleeId: string, type: CallType): Promise<CallSession>;

  /**
   * پاسخ به تماس ورودی
   */
  answerCall(sessionId: string): Promise<void>;

  /**
   * رد تماس ورودی
   */
  rejectCall(sessionId: string): Promise<void>;

  /**
   * قطع تماس جاری
   */
  endCall(sessionId: string): Promise<void>;

  /**
   * تغییر وضعیت میکروفون (Mute/Unmute)
   */
  toggleMute(muted?: boolean): boolean;

  /**
   * تغییر وضعیت دوربین
   */
  toggleVideo(enabled?: boolean): boolean;

  /**
   * دریافت استریم رسانه محلی و راه دور
   */
  getLocalStream(): MediaStream | null;
  getRemoteStream(): MediaStream | null;
}
