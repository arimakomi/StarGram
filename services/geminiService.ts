import { getToken } from './auth';

export class GeminiService {
  async *getChatResponseStream(prompt: string, history: { role: 'user' | 'model', text: string }[]) {
    try {
      const token = getToken();
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ prompt, history })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const msg = errorData.message || 'خطا در ارتباط با هوش مصنوعی؛ لطفاً کلید API و وضعیت آن را در پنل ادمین بررسی کنید.';
        yield msg;
        return;
      }

      const data = await res.json();
      const reply = data.reply || 'پاسخی دریافت نشد.';

      // شبیه‌سازی استریمینگ واژه به واژه برای تجربه کاربری روان
      const words = reply.split(' ');
      for (let i = 0; i < words.length; i++) {
        yield (i === 0 ? '' : ' ') + words[i];
        if (i % 3 === 0) {
          await new Promise(r => setTimeout(r, 25));
        }
      }
    } catch (error: any) {
      console.warn("AI Chat Request Notice:", error);
      yield "دستیار هوش مصنوعی در حال حاضر در دسترس نیست یا در پنل ادمین فعال نشده است.";
    }
  }
}

export const gemini = new GeminiService();
