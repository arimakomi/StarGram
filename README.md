<div dir="rtl" align="right">

# ⭐ StarGram — پیام‌رسان خودمیزبان فارسی (Sovereign Messenger)

StarGram یک پیام‌رسان تحت وب خودمیزبان با رابط فارسی است. امکانات آن شامل گفت‌وگوی خصوصی، گروه و کانال، استوری، پنل مدیریت، پایگاه‌داده‌های PostgreSQL و MySQL/MariaDB یا ذخیره‌سازی محلی JSON، تولید آفلاین آواتار SVG و دستیار Gemini اختیاری است. نصب‌کننده لینوکسی، ابزار مدیریتی خط فرمانی انگلیسی و بررسی خودکار build در GitHub Actions نیز همراه پروژه هستند.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## ✨ ویژگی‌های برجسته و معماری سیستم

- **خودمیزبانی**: داده‌های برنامه در پایگاه‌داده‌ای که پیکربندی می‌کنید یا در ذخیره‌سازی محلی سرور نگهداری می‌شوند. برای قابلیت‌های اصلی به Firebase نیاز نیست.
- **پشتیبانی دوگانه از پایگاه‌داده (Dual-SQL Engine)**:
  - اتصال به **PostgreSQL** (با درایور `pg` یا کانکشن‌استرینگ `postgres://`)
  - اتصال به **MySQL / MariaDB** (با درایور `mysql2` یا کانکشن‌استرینگ `mysql://`)
- **حالت خودکار محلی (Zero-Config Local Fallback)**:
  - برنامه می‌تواند از فایل محلی `data/stargram_db.json` استفاده کند؛ برای نصب‌های کوچک، پایگاه‌داده SQL لازم نیست.
- **دستیار هوشمند Gemini کاملاً اختیاری با پروکسی داخلی**:
  - برای اجرای برنامه **هیچ نیازی به توکن هوش مصنوعی نیست** و برنامه به صورت کامل کار می‌کند.
  - توکن جمنای و آدرس سرور واسط / ریورس پروکسی (برای دور زدن فیلترینگ یا تحریم) مستقیماً از داخل **پنل ادمین (Admin Panel)** قابل تنظیم و تست زنده است.
  - درخواست‌ها از مسیر سرور (`/api/ai/chat`) ارسال می‌شوند تا کلید API در کد فرانت‌اند قرار نگیرد.
- **امنیت بالا و رمزنگاری**:
  - هش رمزهای عبور با الگوریتم استاندارد `scrypt` با سالت اختصاصی.
  - نشست‌های کاربری با توکن‌های تصادفی امن و هش SHA-256.
  - تولید محلی آواتارها با SVG (بدون نیاز به CDN خارجی).
- **مدیریت لینوکس**: نصب‌کننده تعاملی، سرویس `systemd` و دستور `stargram` برای مشاهده وضعیت، مدیریت سرویس، لاگ‌ها، پشتیبان‌گیری و به‌روزرسانی.
- **بررسی build خودکار**: GitHub Actions روی Ubuntu وابستگی‌ها را نصب و build برنامه را بررسی می‌کند.

---

## 🚀 نصب سریع با یک خط (پیشنهادی روی لینوکس)

روی توزیع‌های لینوکسی (Ubuntu, Debian, AlmaLinux, Rocky Linux, CentOS) با دسترسی `root`:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/arimakomi/starchat/main/setup.sh)
```

اسکریپت به زبان انگلیسی موارد زیر را به صورت تعاملی انجام می‌دهد:
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
sudo stargram status         # Check service status, health, and database connection
sudo stargram restart        # Restart the service
sudo stargram logs           # View service logs (journalctl)
sudo stargram port 8080      # Change the application HTTP port
sudo stargram backup         # Create a compressed database backup (.sql.gz or .json.gz)
sudo stargram update         # Back up data, sync the repository, build, and restart
sudo stargram admin          # Change the administrator username or password
sudo stargram uninstall      # Remove the systemd service and command (preserves data and .env)
sudo stargram menu           # Open the interactive management menu in the terminal
```

> **نکته امنیتی آپدیت و حذف:**  
> دستور `stargram update` پیش از به‌روزرسانی تلاش می‌کند از پایگاه‌داده نسخه پشتیبان بسازد. سپس کد مخزن را با upstream همگام می‌کند؛ تغییرات محلی کد ممکن است بازنویسی شوند. فایل‌های پیکربندی `.env` و داده‌های محلی `data/` نگهداری می‌شوند. پیش از به‌روزرسانی، از پشتیبان‌ها و تنظیمات سرور خود مطمئن شوید.
> دستور `stargram uninstall` نیز فقط سرویس پس‌زمینه و میانبر ترمینال را حذف می‌کند و کلیه پایگاه‌های داده، فایل `.env` و پوشه `data/` را به شکل کاملاً دست‌نخورده حفظ می‌نماید.

---

## 🔒 امنیت و استقلال شبکه

- آواتارهای پیش‌فرض به صورت محلی تولید می‌شوند.
- رابط کاربری برای Tailwind CSS و فونت Vazirmatn از CDN استفاده می‌کند و برای دریافت آن‌ها به اینترنت مرورگر نیاز دارد.
- درخواست‌های Gemini فقط در صورت پیکربندی و استفاده از قابلیت دستیار به سرویس هوش مصنوعی ارسال می‌شوند.

## 🧑‍💻 مشارکت و انتشار

پروژه با مجوز MIT منتشر شده است. برای توسعه محلی به Node.js 18 یا جدیدتر نیاز دارید:

```bash
npm ci
npm run dev
```

پیش از ارسال تغییرات، build تولیدی را بررسی کنید:

```bash
npm run build
```

GitHub Actions نیز این build را روی هر push و pull request اجرا می‌کند. فایل‌های `.env`، پایگاه‌داده محلی و خروجی build در Git نادیده گرفته می‌شوند؛ فقط `.env.example` را به عنوان الگوی تنظیمات منتشر کنید.

</div>
