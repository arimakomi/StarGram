import React, { useState } from 'react';
import { Message, User } from '../types';
import { X, AlertTriangle, Send, CheckCircle2 } from 'lucide-react';

interface ReportModalProps {
  message: Message;
  reportedUser?: User;
  chatId: string;
  reporter: User;
  onClose: () => void;
  onSubmitReport: (reason: string) => Promise<void>;
}

const REPORT_REASONS = [
  'ارسال هرزنامه یا تبلیغات ناخواسته (اسپم)',
  'محتوای نامناسب یا غیراخلاقی',
  'توهین، تهدید یا آزار و اذیت',
  'کلاهبرداری، فیشینگ یا جعل هویت',
  'نقض قوانین امنیتی پیام‌رسان',
  'سایر موارد'
];

export const ReportModal: React.FC<ReportModalProps> = ({
  message,
  reportedUser,
  onClose,
  onSubmitReport
}) => {
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0]);
  const [customDetails, setCustomDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const fullReason = customDetails.trim() 
        ? `${selectedReason}: ${customDetails.trim()}`
        : selectedReason;
      await onSubmitReport(fullReason);
      setIsSubmitted(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Error submitting report:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-[#17212b] text-white rounded-2xl shadow-2xl overflow-hidden border border-[#242f3d]"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#242f3d] bg-[#0e1621]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <h2 className="text-base font-semibold">گزارش تخلف پیام</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#242f3d] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSubmitted ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-in zoom-in-75 duration-200" />
            <h3 className="text-base font-semibold text-white">گزارش شما ثبت شد</h3>
            <p className="text-xs text-gray-400">
              تیم مدیریت پیام‌رسان استارلی در اسرع وقت این گزارش را بررسی و تصمیم مقتضی اتخاذ خواهد کرد.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Snippet */}
            <div className="bg-[#0e1621] p-3 rounded-xl border border-[#242f3d] text-xs space-y-1">
              <div className="flex items-center justify-between text-gray-400">
                <span>فرستنده پیام:</span>
                <span className="font-semibold text-white">{reportedUser?.displayName || 'کاربر'}</span>
              </div>
              <p className="text-gray-300 italic truncate max-w-full">
                "{message.text}"
              </p>
            </div>

            {/* Reasons */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">
                علت گزارش را مشخص کنید:
              </label>
              <div className="space-y-1.5">
                {REPORT_REASONS.map((reason) => (
                  <label
                    key={reason}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors text-xs ${
                      selectedReason === reason
                        ? 'bg-[#242f3d] border-[#5288c1] text-white'
                        : 'border-[#242f3d] hover:bg-[#1b2531] text-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      checked={selectedReason === reason}
                      onChange={() => setSelectedReason(reason)}
                      className="accent-[#5288c1] w-4 h-4"
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Custom details */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                توضیحات تکمیلی (اختیاری):
              </label>
              <textarea
                value={customDetails}
                onChange={(e) => setCustomDetails(e.target.value)}
                rows={2}
                placeholder="توضیح بیشتر در صورت نیاز..."
                className="w-full bg-[#242f3d] border border-[#2b5278]/40 rounded-xl px-3 py-2 text-white text-xs focus:outline-hidden focus:border-[#5288c1] transition-colors resize-none"
              />
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-2.5 rounded-xl font-medium text-xs transition-colors flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'در حال ثبت...' : 'ارسال گزارش به مدیریت'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-[#242f3d] hover:bg-[#2b3a4a] text-gray-300 hover:text-white rounded-xl text-xs transition-colors"
              >
                انصراف
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
