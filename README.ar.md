<div dir="rtl" align="right">

# ⭐ StarGram

> **اللغة:** [English](README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md) · [简体中文](README.zh-CN.md)

StarGram تطبيق مراسلة ويب ذاتي الاستضافة بواجهة فارسية، ويدعم المحادثات الخاصة والمجموعات والقنوات والقصص والإدارة. تُخزّن البيانات على خادمك باستخدام PostgreSQL أو MySQL/MariaDB أو ملف JSON محلي.

[رخصة MIT](LICENSE) · [بناء المشروع تلقائياً](https://github.com/arimakomi/StarGram/actions/workflows/build.yml)

## الميزات

- محادثات خاصة وجماعية وقنوات وبحث وردود وتعديل وتفاعلات ورسائل مثبتة
- إرسال الصور والرسائل الصوتية والقصص وإشعارات المتصفح
- إدارة المستخدمين والبلاغات والمجموعات والقنوات وإعدادات النظام
- سمات وخلفيات للمحادثات وإنشاء صور رمزية SVG محلياً
- PostgreSQL وMySQL/MariaDB أو تخزين JSON محلي
- مساعد Gemini اختياري قابل للإعداد
- مثبت Linux وخدمة systemd وقائمة إدارة stargram باللغة الإنجليزية

## المتطلبات والتثبيت

يتطلب Node.js 18 أو أحدث وnpm. يتطلب المثبت التفاعلي على Linux صلاحيات root أو sudo. قواعد SQL اختيارية؛ DB_TYPE=local يستخدم ملف JSON. استخدم HTTPS عبر Nginx أو Caddy عند النشر العام.

~~~bash
bash <(curl -fsSL https://raw.githubusercontent.com/arimakomi/StarGram/main/setup.sh)
~~~

للتثبيت اليدوي:

~~~bash
git clone https://github.com/arimakomi/StarGram.git
cd StarGram
npm ci
cp .env.example .env
~~~

اضبط PORT وDB_TYPE وADMIN_USER وADMIN_PASS في ملف .env. استخدم DB_TYPE=local للتخزين المحلي أو أضف إعدادات الاتصال بقاعدة SQL. ثم شغّل:

~~~bash
npm run build
node server.js --init
npm start
~~~

يدعم التطبيق PostgreSQL وMySQL/MariaDB والمتغير DATABASE_URL. ينشئ الأمر --init حساب المدير أو يعيد تعيين كلمة مروره. اختر كلمة مرور قوية وفريدة.

## إدارة الخادم

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

قد يستبدل الأمر update تعديلات الكود المحلية؛ أنشئ نسخة احتياطية من البيانات والإعدادات قبل التحديث. تُحفظ البيانات المحلية في data/stargram_db.json ويمكن تصديرها واستعادتها من لوحة الإدارة.

## تثبيت PWA والخصوصية

يحتاج تثبيت PWA إلى متصفح متوافق واتصال HTTPS؛ يُسمح بـ localhost أثناء التطوير. في iOS استخدم قائمة المشاركة في Safari ثم Add to Home Screen. كلمات المرور مجزأة باستخدام scrypt، لكن الرسائل ليست مشفرة من طرف إلى طرف. استخدم HTTPS وقيّد الوصول إلى ملفات البيانات والنسخ الاحتياطية. مساعد Gemini اختياري ويرسل الطلبات إلى المزود عند استخدامه.

## استكشاف الأخطاء والمساهمة

إذا تعذّر العثور على auth أو avatarGenerator، فتأكد من وجود الملفين services/auth.ts وservices/avatarGenerator.ts بحالة الأحرف نفسها. أنظمة Linux تميّز بين الأحرف الكبيرة والصغيرة. استنسخ المستودع كاملاً ثم نفّذ npm ci وnpm run build من مجلد المشروع. للمساهمة استخدم Node.js 18+ وnpm. المشروع مرخص بموجب MIT؛ راجع LICENSE.
</div>
