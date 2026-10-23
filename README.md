<div dir="rtl" align="right">

# ⭐ StarGram — پیام‌رسان خودمیزبان فارسی

StarGram یک پیام‌رسان وب با ظاهر الهام‌گرفته از تلگرام است که روی سرور خودتان اجرا می‌شود: چت خصوصی، گروه، کانال، استوری، پنل مدیریت و دستیار هوشمند اختیاری. رابط کاربری کاملاً فارسی و راست‌به‌چپ است و داده‌ها در **MySQL / MariaDB** ذخیره می‌شوند.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## ✨ امکانات

- ثبت‌نام و ورود با نام کاربری و رمز عبور (رمزها با `scrypt` هش می‌شوند)
- چت خصوصی، گروه و کانال، پیام‌های ذخیره‌شده (Saved Messages)
- استوری با تصویر، ویدیوی کوتاه و متن گرادیانی
- تم‌های مختلف، پس‌زمینه‌ی چت، قفل برنامه با رمز ۴ رقمی
- **پنل مدیریت**: بستن/بازکردن ساخت گروه، کانال و استوری، صف گزارش تخلف، بن موقت و دائم، ریست رمز کاربران
- آواتارهای SVG که روی کلاینت ساخته می‌شوند (بدون وابستگی به CDN)
- دستیار هوشمند Gemini (اختیاری)
- نصب با **یک فایل** (`setup.sh`) با انتخاب پورت، ادمین و دیتابیس

---

## 🚀 نصب سریع (پیشنهادی)

روی سرور لینوکسی (AlmaLinux / Rocky / CentOS / Ubuntu / Debian) با دسترسی root فقط یک خط:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/arimakomi/StarGram/main/setup.sh)
```

(پروژه در `/opt/stargram` دریافت می‌شود؛ مسیر دیگر: `INSTALL_DIR=/path` قبل از دستور.)

اسکریپت به‌ترتیب این کارها را انجام می‌دهد:

1. نصب Node.js 20 (اگر نسخه‌ی ۱۸ به بالا نصب نباشد)
2. پرسیدن **پورت** برنامه
3. پرسیدن **نام کاربری و رمز ادمین** (اگر رمز را خالی بگذارید، رمز تصادفی ساخته و آخر نصب نشان داده می‌شود)
4. پرسیدن **مشخصات دیتابیس** (میزبان، پورت، نام دیتابیس، کاربر، رمز) و تست اتصال
   - اگر دیتابیس/کاربر وجود نداشته باشد، با دسترسی root دیتابیس ساخته می‌شوند
   - اگر MariaDB نصب نباشد، می‌توانید نصب آن را روی همان سرور تأیید کنید
5. نوشتن فایل `.env` (با دسترسی `600`)، `npm install`، `npm run build`
6. ساخت جدول‌ها و حساب ادمین
7. ساخت و راه‌اندازی سرویس **systemd** به نام `stargram` و باز کردن پورت در firewalld (در صورت فعال بودن)

در پایان آدرس برنامه و اطلاعات ورود نمایش داده می‌شود.

### نصب بدون پرسش (خودکار)

```bash
sudo NONINTERACTIVE=1 PORT=3000 \
  ADMIN_USER=admin ADMIN_PASS='رمز-قوی' \
  DB_HOST=127.0.0.1 DB_PORT=3306 DB_NAME=stargram DB_USER=stargram DB_PASS='رمز-دیتابیس' \
  bash setup.sh
```

اگر دیتابیس روی سرور دیگری است و کاربر ساخته نشده، `DB_ROOT_USER` و `DB_ROOT_PASS` را هم بدهید. رمز دیتابیس نباید شامل `' " \ $ \`` باشد.

---

## 🛠 نصب دستی

```bash
# ۱) دیتابیس
mysql -u root -e "CREATE DATABASE stargram CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
  CREATE USER 'stargram'@'localhost' IDENTIFIED BY 'DB_PASSWORD';
  GRANT ALL ON stargram.* TO 'stargram'@'localhost';"

# ۲) تنظیمات
cp .env.example .env && nano .env

# ۳) وابستگی‌ها، بیلد، ساخت جدول‌ها و ادمین
npm install
npm run build
ADMIN_USER=admin ADMIN_PASS='رمز-ادمین' node server.js --init

# ۴) اجرا
npm start
```

### متغیرهای `.env`

| متغیر | پیش‌فرض | توضیح |
|---|---|---|
| `PORT` | `3000` | پورت برنامه |
| `DB_HOST` / `DB_PORT` | `127.0.0.1` / `3306` | آدرس دیتابیس |
| `DB_NAME` / `DB_USER` / `DB_PASS` | `stargram` | مشخصات دیتابیس |
| `ADMIN_USER` | — | نام کاربری ادمین (فقط برای ساخت اولیه) |
| `GEMINI_API_KEY` | خالی | اختیاری؛ هنگام **بیلد** در کد کلاینت قرار می‌گیرد (به بخش امنیت دقت کنید) |

> رمز ادمین عمداً در `.env` ذخیره نمی‌شود؛ فقط هنگام اجرای `--init` به‌صورت متغیر محیطی داده می‌شود.

---

## 🔄 مدیریت و نگهداری

بعد از نصب، دستور **`stargram`** در دسترس است. بدون آرگومان یک منوی تعاملی باز می‌کند که بالای آن وضعیت (فعال/غیرفعال، اجرای خودکار، پورت، آدرس، سلامت برنامه و اتصال دیتابیس) نمایش داده می‌شود.

```bash
sudo stargram                 # منوی تعاملی
```

| گزینه‌ی منو | دستور مستقیم | کار |
|---|---|---|
| وضعیت | `stargram status` | نمایش فعال/غیرفعال، پورت، آدرس و سلامت |
| ۱ — روشن کردن | `sudo stargram start` | روشن کردن سرویس |
| ۲ — خاموش کردن | `sudo stargram stop` | قطع سرویس |
| ۳ — ری‌استارت | `sudo stargram restart` | راه‌اندازی مجدد |
| ۴ — تغییر پورت | `sudo stargram port 8080` | تغییر `PORT` در `.env`، بستن/باز کردن پورت در firewalld و ری‌استارت |
| ۵ — اجرای خودکار | `sudo stargram enable` / `disable` | روشن/خاموش بودن اجرا بعد از ریبوت |
| ۶ — لاگ‌ها | `sudo stargram logs [follow\|errors\|today]` | ۱۰۰ خط آخر، زنده، فقط خطاها یا امروز |
| ۷ — تست سلامت | `stargram health` | پاسخ `/api/health` و وضعیت اتصال دیتابیس |
| ۸ — به‌روزرسانی | `sudo stargram update` | `git pull` + `npm install` + بیلد + ری‌استارت |
| ۹ — پشتیبان‌گیری | `sudo stargram backup` | پشتیبان فشرده‌ی دیتابیس در `backups/` (مسیر دیگر: `BACKUP_DIR=...`) |
| a — رمز ادمین | `sudo stargram admin` | تغییر رمز (یا ساخت دوباره‌ی) ادمین |

> اگر قبل از اضافه شدن این دستور نصب کرده‌اید، یک بار این را بزنید:
> `cd /opt/stargram && git pull && sudo ln -sf $PWD/bin/stargram /usr/local/bin/stargram`

معادل دستی:

```bash
systemctl status stargram
journalctl -u stargram -f
curl http://127.0.0.1:3000/api/health   # سلامت برنامه و دیتابیس
```

**ریست رمز ادمین (یا ساخت دوباره‌ی نقش ادمین):**

```bash
cd /مسیر/StarGram
ADMIN_USER=admin ADMIN_PASS='رمز-جدید' node server.js --init
```

**به‌روزرسانی:**

```bash
git pull && npm install && npm run build && systemctl restart stargram
```

**پشتیبان‌گیری** (تمام داده‌ها در دو جدول `documents` و `sessions` هستند):

```bash
mysqldump -u stargram -p stargram > stargram-backup-$(date +%F).sql
```

---

## 🌐 دامنه و HTTPS با Nginx

```nginx
server {
    listen 80;
    server_name chat.example.com;
    client_max_body_size 50M;   # آپلود تصویر/ویدیو

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo certbot --nginx -d chat.example.com
```

در این حالت پورت برنامه را در فایروال باز نکنید (فقط ۸۰ و ۴۴۳). پشت پروکسی، سرور فقط آدرس‌های loopback را برای تشخیص IP کلاینت معتبر می‌داند.

---

## 🧱 معماری

```
مرورگر (React + Vite)  ──HTTP──▶  Express (server.js)  ──▶  MySQL / MariaDB
   حافظه‌ی محلی + همگام‌سازی        احراز هویت + API اسناد       جدول documents / sessions
   هر ~۲٫۵ ثانیه
```

- **احراز هویت:** `POST /api/auth/register`، `/login`، `/logout`، `GET /api/auth/me`. رمزها فقط به‌صورت هش `scrypt` ذخیره می‌شوند و هرگز به مرورگر برگردانده نمی‌شوند. نشست‌ها توکن تصادفی ۳۲ بایتی هستند (فقط هش آن در دیتابیس) و ۳۰ روز اعتبار دارند. ورود بیش از ۸ بار اشتباه در ۱۰ دقیقه موقتاً محدود می‌شود.
- **ذخیره‌سازی:** مدل سند-محور روی `documents (collection, doc_id, data, updated_at, deleted)`. کلاینت تغییرات را ارسال و تغییرات دیگران را به‌صورت افزایشی (`?since=`) دریافت می‌کند.
- **قوانین سمت سرور:**
  - هر کاربر فقط چت‌هایی را می‌بیند و می‌نویسد که عضو آن‌هاست (ادمین هم چت‌های خصوصی دیگران را نمی‌بیند)
  - فیلدهای `role`، `isBanned`، `bannedUntil` و `banReason` را فقط ادمین تغییر می‌دهد
  - ساخت کاربر فقط از مسیر ثبت‌نام ممکن است و نقش همیشه `user` است
  - تنظیمات سیستم (`system_config`) و گزارش‌ها (`reports`) فقط برای ادمین قابل نوشتن/خواندن است
  - کاربر عادی فقط رمز خودش را تغییر می‌دهد (حداقل ۶ کاراکتر)

### ساختار پروژه

```
StarGram/
├── server.js            # سرور Express + API + اتصال دیتابیس
├── setup.sh             # نصب‌کننده تعاملی
├── bin/stargram         # دستور مدیریت (منو)
├── .env.example         # نمونه‌ی تنظیمات
├── App.tsx, index.tsx   # ورودی برنامه
├── components/          # کامپوننت‌های رابط کاربری
├── services/
│   ├── auth.ts          # ورود/ثبت‌نام و توکن
│   ├── firebase.ts      # لایه‌ی سند-محور و همگام‌سازی با سرور
│   ├── cryptoUtils.ts   # رمزنگاری پیام‌ها (AES-GCM)
│   ├── avatarGenerator.ts, imageUtils.ts, geminiService.ts
├── types.ts, index.html, vite.config.ts, tsconfig.json
└── LICENSE
```

> نام فایل `services/firebase.ts` به دلیل سازگاری تاریخی مانده است؛ این فایل **به Firebase وصل نمی‌شود** و فقط یک API مشابه Firestore روی دیتابیس خودتان فراهم می‌کند.

---

## 🔐 نکات امنیتی (حتماً بخوانید)

این پروژه برای استقرار کوچک و شخصی مناسب است. محدودیت‌های فعلی:

1. **رمزنگاری پیام‌ها «E2EE واقعی» نیست.** متن پیام‌ها در مرورگر با AES-GCM رمز می‌شود، اما کلید از شناسه‌ی چت ساخته می‌شود و سرور آن را می‌داند. پس این رمزنگاری جلوی خواندن مستقیم دیتابیس را به‌صورت ساده می‌گیرد، ولی مدیر سرور می‌تواند پیام‌ها را رمزگشایی کند. به‌خاطر همین، هیچ‌وقت ادعای «رمزنگاری سرتاسری» برای کاربران نکنید.
2. هر چت به‌صورت **یک سند** (با آرایه‌ی پیام‌ها) ذخیره می‌شود؛ اگر دو نفر دقیقاً هم‌زمان پیام بفرستند، ممکن است آخرین نوشتن نسخه‌ی قبلی را بپوشاند. برای تعداد کاربر زیاد باید پیام‌ها در جدول جدا ذخیره شوند.
3. هر کاربر واردشده می‌تواند اسناد غیرکاربری و غیرچتی (مثل استوری‌ها) را بنویسد؛ کنترل دسترسی ریزدانه برای آن‌ها وجود ندارد.
4. اگر `GEMINI_API_KEY` را هنگام بیلد بدهید، کلید داخل فایل‌های جاوااسکریپتِ عمومی قرار می‌گیرد و هر بازدیدکننده می‌تواند آن را بردارد. فقط با کلیدی که محدودیت مصرف دارد استفاده کنید یا خالی بگذارید.
5. حتماً از HTTPS استفاده کنید (توکن نشست در هدر `Authorization` ارسال می‌شود) و رمز ادمین قوی بگذارید.

---

## 🧑‍💻 توسعه

```bash
npm install
npm run dev        # Vite (فقط رابط کاربری؛ API را از سرور اصلی لازم دارد)
npm run lint       # بررسی TypeScript
npm run build      # ساخت dist/
```

برای توسعه، سرور را با `.env` تنظیم‌شده اجرا کنید و در `vite.config.ts` یک `server.proxy` برای `/api` به `http://localhost:3000` اضافه کنید.

---

## 📄 مجوز

این پروژه تحت مجوز [MIT](LICENSE) منتشر شده است. © 2026 arimakomi

</div>
