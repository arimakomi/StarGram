<div dir="rtl" align="right">

# ⭐ StarGram

> **انتخاب زبان:** [English](../../README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md) · [简体中文](README.zh-CN.md)

پیام‌رسان متن‌باز و خودمیزبان وب با رابط فارسی؛ شامل گفت‌وگوی خصوصی، گروه، کانال، استوری، پنل مدیریت و دستیار Gemini اختیاری. داده‌ها روی سرور شما ذخیره می‌شوند و می‌توانید از PostgreSQL، MySQL/MariaDB یا فایل محلی JSON استفاده کنید. [سایت پروژه](https://arimakomi.github.io/StarGram/) · [مرکز راهنمای آنلاین](https://arimakomi.github.io/StarGram/help/)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)
[![Build](https://github.com/arimakomi/StarGram/actions/workflows/build.yml/badge.svg)](https://github.com/arimakomi/StarGram/actions/workflows/build.yml)

## قابلیت‌ها

برای توضیح گام‌به‌گام، [فهرست راهنماها](../README.md)، [راهنمای API](../api.fa.md)، [راهنمای وب](../web/README.md) و [راهنمای پنل مدیریت](../web/admin-panel.md) را ببینید. سایت GitHub Pages فقط مستندات و معرفی پروژه را میزبانی می‌کند؛ اجرای پیام‌رسان به API روی سرور شما نیاز دارد.

- گفت‌وگوی خصوصی و گروهی، کانال، جست‌وجو، پاسخ، ویرایش، واکنش و سنجاق پیام
- ارسال تصویر و پیام صوتی، استوری و اعلان‌های مرورگر
- مدیریت کاربران، گزارش‌ها، گروه‌ها، کانال‌ها، برند، توکن‌های API و داده‌های محلی
- پنل مدیر با بخش‌های جدا برای برند، API، گزارش‌ها، کاربران، گفتگوها و پایگاه‌داده
- انتخاب پوسته و پس‌زمینه‌ی چت؛ آواتار پیش‌فرض با SVG و به‌صورت محلی ساخته می‌شود
- ذخیره‌سازی PostgreSQL و MySQL/MariaDB یا فایل JSON محلی
- دستیار Gemini اختیاری با کلید، مدل و پراکسی قابل تنظیم
- نصب‌کننده لینوکس، سرویس systemd و منوی انگلیسی فرمان stargram

## نیازمندی‌ها

- Node.js نسخه ۱۸ یا جدیدتر و npm؛ نصب‌کننده در صورت نیاز Node.js 20 LTS را نصب می‌کند
- دسترسی root یا sudo برای نصب‌کننده لینوکس
- پایگاه‌داده SQL اختیاری است؛ DB_TYPE=local از JSON استفاده می‌کند
- برای استقرار عمومی از Nginx یا Caddy همراه HTTPS استفاده کنید.

## نصب سریع لینوکس

~~~bash
bash <(curl -fsSL https://raw.githubusercontent.com/arimakomi/StarGram/main/setup.sh)
~~~

نصب‌کننده Node.js، درگاه، حساب مدیر و پایگاه‌داده را تنظیم می‌کند و در صورت امکان سرویس systemd و فرمان stargram را نصب می‌کند. منوی مدیریت و پیام‌های ترمینال انگلیسی هستند.

## نصب دستی

~~~bash
git clone https://github.com/arimakomi/StarGram.git
cd StarGram
npm ci
cp .env.example .env
~~~

در فایل .env، مقادیر PORT، DB_TYPE، ADMIN_USER و ADMIN_PASS را تنظیم کنید. نمونه ذخیره‌سازی محلی:

~~~ini
PORT=3000
DB_TYPE=local
ADMIN_USER=admin
ADMIN_PASS=ReplaceWithALongUniquePassword
~~~

برای PostgreSQL یا MySQL/MariaDB، DB_TYPE، DB_HOST، DB_PORT، DB_NAME، DB_USER و DB_PASS را تنظیم کنید. DATABASE_URL نیز پشتیبانی می‌شود.

~~~bash
npm run build
node server.js --init
npm start
~~~

فرمان --init حساب مدیر را می‌سازد یا گذرواژه آن را بازنشانی می‌کند. گذرواژه‌ای قوی و یکتا انتخاب کنید. برنامه به‌طور پیش‌فرض روی http://localhost:3000 اجرا می‌شود. اگر SQL در دسترس نباشد، سرور به JSON محلی برمی‌گردد.

## گزینه‌های پایگاه‌داده

| DB_TYPE | موتور | محل داده |
| --- | --- | --- |
| local | فایل JSON | data/stargram_db.json |
| postgres | PostgreSQL | پایگاه‌داده تنظیم‌شده |
| mysql | MySQL یا MariaDB | پایگاه‌داده تنظیم‌شده |

## مدیریت سرور

~~~bash
sudo stargram
sudo stargram status
sudo stargram start
sudo stargram stop
sudo stargram restart
sudo stargram logs
sudo stargram logs follow
sudo stargram health
sudo stargram port 8080
sudo stargram backup
sudo stargram admin
sudo stargram update
sudo stargram help
~~~

فرمان update آرشیو شاخه main را مستقیماً از GitHub می‌گیرد و حتی وقتی پوشه نصب مخزن Git نیست کار می‌کند. فایل‌های برنامه جایگزین می‌شوند، وابستگی‌ها نصب و build اجرا می‌شود و در صورت وجود systemd سرویس راه‌اندازی مجدد می‌شود. پوشه‌های data و backups، فایل‌های .env و node_modules حفظ می‌شوند؛ تغییرات محلی کد ممکن است بازنویسی شوند.

## PWA و نصب برنامه

نصب PWA به مرورگر سازگار و HTTPS نیاز دارد؛ localhost برای توسعه مجاز است. در Android و مرورگرهای Chromium گزینه نصب را از منو انتخاب کنید. در iOS، منوی اشتراک‌گذاری Safari و سپس Add to Home Screen را انتخاب کنید.

## داده‌ها و حریم خصوصی

- داده محلی در data/stargram_db.json ذخیره می‌شود؛ پنل مدیریت خروجی و بازیابی JSON دارد.
- stargram backup نسخه فشرده می‌سازد.
- پوشه‌های داده، پشتیبان، فایل‌های .env، dist و node_modules در Git قرار نمی‌گیرند.
- گذرواژه‌ها با scrypt هش می‌شوند و توکن نشست به‌صورت هش ذخیره می‌شود.
- پیام‌ها رمزگذاری سرتاسری (E2EE) نیستند و متن خوانا در داده همگام‌شده ذخیره می‌شود.
- برای استقرار عمومی HTTPS را با reverse proxy فعال کنید و دسترسی به فایل‌های داده و پشتیبان را محدود کنید.
- دستیار Gemini اختیاری است؛ هنگام استفاده درخواست‌ها به ارائه‌دهنده تنظیم‌شده ارسال می‌شوند.

## رفع خطاهای build

اگر TypeScript ماژول auth یا avatarGenerator را پیدا نمی‌کند، checkout ناقص یا قدیمی است. این فایل‌ها باید با حروف دقیق زیر وجود داشته باشند:

~~~text
services/auth.ts
services/avatarGenerator.ts
~~~

Linux به بزرگی و کوچکی حروف حساس است. مخزن کامل را دریافت و از پوشه اصلی پروژه build کنید:

~~~bash
git clone https://github.com/arimakomi/StarGram.git
cd StarGram
npm ci
npm run build
~~~

## توسعه و مجوز

برای توسعه Node.js 18+، npm ci و npm run dev را اجرا کنید. پیش از pull request، npm run build را اجرا کنید. پروژه تحت مجوز MIT منتشر شده است؛ فایل LICENSE را ببینید.
</div>
