<div dir="rtl" align="right">

# ⭐ StarGram — پیام‌رسان خودمیزبان فارسی (Sovereign Messenger)

StarGram یک پیام‌رسان تحت وب مستقل با طراحی الهام‌گرفته از تلگرام است که کاملاً روی سرور خودتان اجرا می‌شود: چت خصوصی، گروه، کانال، استوری، پنل جامع مدیریت، پشتیبانی دوگانه از **PostgreSQL** و **MySQL / MariaDB**، اجرای بدون وابستگی خارجی با حافظه محلی، و دستیار هوشمند اختیاری با قابلیت تنظیم پروکسی.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## ✨ ویژگی‌های برجسته و معماری سیستم

- **استقلال کامل و حذف Firebase**: بدون هیچ وابستگی به فایربیس یا سرویس‌های ابری خارجی؛ تمامی داده‌ها روی سرور خودتان نگهداری می‌شوند.
- **پشتیبانی دوگانه از پایگاه‌داده (Dual-SQL Engine)**:
  - اتصال به **PostgreSQL** (با درایور `pg` یا کانکشن‌استرینگ `postgres://`)
  - اتصال به **MySQL / MariaDB** (با درایور `mysql2` یا کانکشن‌استرینگ `mysql://`)
- **حالت خودکار محلی (Zero-Config Local Fallback)**:
  - اگر هیچ سرور پایگاه‌داده‌ای ست نشده باشد یا ارتباط برقرار نشود، سیستم بدون ایجاد وقفه یا خطا مستقیماً با موتور ذخیره‌سازی محلی خودکار (`data/stargram_db.json`) بالا می‌آید.
- **دستیار هوشمند Gemini کاملاً اختیاری با پروکسی داخلی**:
  - برای اجرای برنامه **هیچ نیازی به توکن هوش مصنوعی نیست** و برنامه به صورت کامل کار می‌کند.
  - توکن جمنای و آدرس سرور واسط / ریورس پروکسی (برای دور زدن فیلترینگ یا تحریم) مستقیماً از داخل **پنل ادمین (Admin Panel)** قابل تنظیم و تست زنده است.
  - درخواست‌ها از مسیر امن سرور (`/api/ai/chat`) رله می‌شوند؛ بنابراین کلید هرگز در مرورگر کاربران افشا نمی‌شود.
- **امنیت بالا و رمزنگاری**:
  - هش رمزهای عبور با الگوریتم استاندارد `scrypt` با سالت اختصاصی.
  - نشست‌های کاربری با توکن‌های تصادفی امن و هش SHA-256.
  - تولید محلی آواتارها با SVG (بدون نیاز به CDN خارجی).

---

## 🚀 نصب سریع با یک خط (پیشنهادی روی لینوکس)

روی توزیع‌های لینوکسی (Ubuntu, Debian, AlmaLinux, Rocky Linux, CentOS) با دسترسی `root`:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/arimakomi/StarGram/main/setup.sh)
```

اسکریپت به صورت تعاملی موارد زیر را انجام می‌دهد:
1. بررسی و نصب Node.js 20 (در صورت نیاز).
2. دریافت پورت اجرای برنامه (پیش‌فرض: `3000`).
3. تنظیم نام کاربری و رمز مدیر ارشد.
4. انتخاب نوع پایگاه‌داده: `mysql` یا `postgres` یا `local` (حافظه محلی بدون نیاز به دیتابیس).
5. بیلد برنامه، ساخت خودکار جدول‌ها و فعال‌سازی سرویس `systemd`.

### نصب خودکار بدون پرسش (Automated Non-interactive)

```bash
# نصب با MySQL / MariaDB
sudo NONINTERACTIVE=1 PORT=3000 \
  ADMIN_USER=admin ADMIN_PASS='SuperSecretPass123' \
  DB_TYPE=mysql DB_HOST=127.0.0.1 DB_PORT=3306 DB_NAME=stargram DB_USER=stargram DB_PASS='db_password' \
  bash setup.sh

# یا نصب با PostgreSQL
sudo NONINTERACTIVE=1 PORT=3000 \
  ADMIN_USER=admin ADMIN_PASS='SuperSecretPass123' \
  DB_TYPE=postgres DB_HOST=127.0.0.1 DB_PORT=5432 DB_NAME=stargram DB_USER=postgres DB_PASS='db_password' \
  bash setup.sh

# یا نصب در حالت محلی مستقل (بدون نیاز به SQL Server)
sudo NONINTERACTIVE=1 PORT=3000 \
  ADMIN_USER=admin ADMIN_PASS='SuperSecretPass123' \
  DB_TYPE=local \
  bash setup.sh
```

---

## 🛠 نصب دستی (Manual Setup)

### ۱) ساخت دیتابیس (اختیاری؛ برای حالت‌های SQL)

**برای PostgreSQL:**
```sql
CREATE DATABASE stargram;
CREATE USER stargram WITH PASSWORD 'DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE stargram TO stargram;
```

**برای MySQL / MariaDB:**
```sql
CREATE DATABASE stargram CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
CREATE USER 'stargram'@'localhost' IDENTIFIED BY 'DB_PASSWORD';
GRANT ALL PRIVILEGES ON stargram.* TO 'stargram'@'localhost';
FLUSH PRIVILEGES;
```

### ۲) پیکربندی `.env`

فایل نمونه را کپی و ویرایش کنید:
```bash
cp .env.example .env
nano .env
```

نمونه محتوای `.env`:
```ini
PORT=3000

# نوع دیتابیس: postgres | mysql | local
DB_TYPE=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=stargram
DB_USER=stargram
DB_PASS=DB_PASSWORD

# یا استفاده از کانکشن استرینگ مستقیم:
# DATABASE_URL=postgres://stargram:DB_PASSWORD@127.0.0.1:5432/stargram

# حساب اولیه مدیر ارشد
ADMIN_USER=admin
```

### ۳) نصب وابستگی‌ها، بیلد و راه‌اندازی اولیه

```bash
npm install
npm run build

# ساخت جدول‌ها و اکانت ادمین
ADMIN_USER=admin ADMIN_PASS='AdminSecretPass' node server.js --init

# اجرای سرویس
npm start
```

---

## 🤖 تنظیمات هوش مصنوعی Gemini و پروکسی از پنل ادمین

برای استفاده از ربات هوش مصنوعی:
1. با حساب مدیر وارد برنامه شوید (`http://localhost:3000`).
2. از منوی کناری وارد **پنل مدیریت (Admin Panel)** شوید.
3. در برگه **تنظیمات کلان سیستم**، کارت **دستیار هوش مصنوعی و تنظیمات جمنای**:
   - کلید اختصاصی `Gemini API Key` خود را وارد کنید.
   - در صورت لزوم (مثلاً در هاست‌های داخلی ایران)، آدرس پروکسی واسط یا Cloudflare Worker معکوس را در بخش **آدرس پروکسی واسط / Base URL** وارد کنید (مثلاً `https://my-gemini-proxy.example.com`).
   - مدل مورد نظر را انتخاب نمایید (`gemini-2.5-flash` یا `gemini-2.5-pro`).
   - دکمه **تست اتصال آنلاین** را بزنید تا از برقراری ارتباط مطمئن شوید.
   - دکمه **ذخیره تنظیمات هوش مصنوعی** را فشار دهید.

---

## 💾 مدیریت و مانیتورینگ دیتابیس در پنل ادمین

در تب **مدیریت پایگاه‌داده** در پنل ادمین امکانات زیر فراهم است:
- نمایش نشانگر موتور فعال (`PostgreSQL` / `MySQL` / `Local Storage`).
- محاسبه حجم اشغالی و تعداد اسناد تفکیکی.
- دانلود پشتیبان کامل فایل **JSON Backup**.
- بازگردانی آنی (Restore) از فایل JSON با اعتبارسنجی ساختار.
- کاوشگر اسناد (Collection Document Explorer) با امکان جستجو، مشاهده و حذف رکوردهای معیوب.

---

## 🔄 دستور مدیریتی `stargram`

ابزار خط فرمانی و محیط ترمینال (`setup.sh` و `stargram`) کاملاً به زبان انگلیسی طراحی شده‌اند. بعد از نصب در لینوکس، ابزار خط فرمانی `stargram` در دسترس است:

```bash
sudo stargram status         # بررسی وضعیت سرویس، سلامت و اتصال دیتابیس
sudo stargram restart        # ری‌استارت سرویس
sudo stargram logs           # مشاهده لاگ‌های سرویس (journalctl)
sudo stargram port 8080      # تغییر پورت HTTP برنامه
sudo stargram backup         # تهیه پشتیبان فشرده دیتابیس (.sql.gz یا .json.gz)
sudo stargram update         # آپدیت امن: پشتیبان‌گیری خودکار دیتابیس + git pull + بیلد مجدد + مایگریشن
sudo stargram admin          # تغییر سریع نام کاربری / رمز حساب مدیر ارشد
sudo stargram uninstall      # حذف سرویس systemd و دستور (داده‌های دیتابیس و .env کاملاً حفظ می‌شوند)
sudo stargram menu           # باز کردن منوی تعاملی مدیریتی در ترمینال
```

> **نکته امنیتی آپدیت و حذف:**  
> دستور `stargram update` پیش از هرگونه تغییر در کدها یا بسته‌ها، ابتدا یک نسخه پشتیبان کامل و فشرده از دیتابیس تهیه می‌کند تا اطلاعات کاربران در برابر قطعی یا تغییرات محافظت شود.  
> دستور `stargram uninstall` فقط سرویس پس‌زمینه و میانبر ترمینال را حذف می‌کند و کلیه پایگاه‌های داده، فایل `.env` و پوشه `data/` را به شکل کاملاً دست‌نخورده حفظ می‌نماید.

---

## 🔒 امنیت و استقلال شبکه

- هیچ‌گونه اسکریپت یا استایل خارجی از CDNها لود نمی‌شود.
- تمامی آواتارها به صورت آفلاین تولید می‌گردند.
- هیچ داده‌ای به سرورهای گوگل یا فایربیس ارسال نمی‌شود مگر اینکه ادمین صراحتاً کلید و پروکسی جمنای را فعال کند.

</div>
