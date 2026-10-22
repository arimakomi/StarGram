
// این فایل مسئول ارتباط با فایل‌های PHP در پوشه public/api است
export const api = {
  baseUrl: (import.meta as any).env?.DEV ? 'http://localhost/starly-backend/api' : './api', // در حالت Dev آدرس لوکال سرور PHP خود را وارد کنید

  async post(endpoint: string, data: any) {
    try {
      // در حالت بیلد شده، فایل‌ها در ./api هستند
      const url = `${endpoint}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("API Error:", error);
      return { success: false, message: "خطای ارتباط با سرور" };
    }
  }
};
