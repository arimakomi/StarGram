# راهنمای جامع استقرار پیام‌رسان استارلی روی سرور شخصی (Self-Hosted Deployment)

این پیام‌رسان به صورت **۱۰۰٪ ایزوله و مستقل** طراحی شده است؛ یعنی برای اجرا به هیچ سرویس، CDN یا اینترنت خارجی وابسته نیست و تمامی آواتارها، داده‌ها و رمزنگاری‌ها درون خود سرور و کلاینت کاربر انجام می‌شود.

---

## ۱. پیش‌نیازهای سرور
- سیستم‌عامل لینوکس (Ubuntu 20.04/22.04/24.04 یا Debian)
- نرم‌افزار **Node.js** نسخه ۱۸ یا بالاتر (Node.js 20 LTS پیشنهاد می‌شود)
- ابزار مدیریت بسته‌ها (`npm` یا `bun` یا `yarn`)

---

## ۲. روش اول: اجرای مستقیم با PM2 (ساده و پیشنهادی)

### گام اول: انتقال فایل‌ها به سرور
فایل‌های پروژه را از طریق `git clone` یا `scp / rsync` در مسیر دلخواه روی سرور (مثلاً `/var/www/starly`) قرار دهید:
```bash
cd /var/www/starly
```

### گام دوم: نصب وابستگی‌ها و بیلد نهایی
```bash
# نصب پکیج‌ها
npm install

# ساخت نسخه پروداکشن (تولید پوشه dist)
npm run build
```

### گام سوم: نصب PM2 و اجرای دائمی سرور
```bash
# نصب سراسری مدیر پردازه PM2
sudo npm install -g pm2

# اجرای سرور در پس‌زمینه با پورت ۳۰۰۰
PORT=3000 pm2 start server.js --name "starly-messenger"

# ذخیره تنظیمات برای اجرای خودکار پس از ریستارت سرور
pm2 save
pm2 startup
```

اکنون برنامه روی پورت ۳۰۰۰ سرور فعال است:
```
http://YOUR_SERVER_IP:3000
```

---

## ۳. روش دوم: تنظیم وب‌سرور Nginx معکوس (Reverse Proxy) با دامنه و SSL

برای اتصال دامنه و فعال‌سازی HTTPS، یک فایل کانفیگ Nginx ایجاد کنید:
```bash
sudo nano /etc/nginx/sites-available/starly
```

محتوای زیر را قرار دهید:
```nginx
server {
    listen 80;
    server_name chat.yourdomain.com;

    # حداکثر حجم مجاز آپلود برای ویدیوها و تصاویر استوری (تا ۵۰ مگابایت)
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

سپس کانفیگ را فعال کرده و Nginx را ریستارت کنید:
```bash
sudo ln -s /etc/nginx/sites-available/starly /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

برای دریافت گواهی رایگان SSL (HTTPS):
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d chat.yourdomain.com
```

---

## ۴. ویژگی‌های برجسته معماری خود‌میزبان (Self-Hosted Features)

1. **رمزنگاری سرتاسری واقعی (E2EE)**:
   - تمام پیام‌ها با کلیدهای ۲۵۶ بیتی Web Crypto (AES-GCM) رمز شده و در پایگاه داده محلی ذخیره می‌شوند.
2. **استوری‌های سبک تلگرام**:
   - نوار حلقه‌ای استوری ۴۸ پیکسلی.
   - پشتیبانی از **تصویر**، **ویدیوی تا ۳۰ ثانیه** و **متن با گرادیان**.
   - ممانعت خودکار از آپلود فایل‌های نامربوط.
3. **پنل مدیریت ارشد (Super Admin)**:
   - حساب کاربری پیش‌فرض `support` دارای نقش مدیر ارشد سیستم است.
   - کنترل بستن یا بازگشایی ایجاد گروه‌ها، کانال‌ها و استوری‌ها.
   - صف بررسی گزارش‌های تخلف، مسدودسازی موقت، بن کامل، تغییر رمز و خاموشی 2FA کاربران.
4. **ایزولاسیون کامل بدون نیاز به اینترنت خارجی**:
   - بدون حتی یک درخواست به خارج از سرور.
   - آواتارها به طور کامل با SVG درون‌کلاینتی تولید می‌شوند.
