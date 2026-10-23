# ⭐ StarGram

> **Dil:** [English](../../README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md) · [简体中文](README.zh-CN.md)

StarGram, Farsça arayüze sahip, kendi sunucunuzda barındırabileceğiniz bir web mesajlaşma uygulamasıdır. Özel ve grup sohbetleri, kanallar, hikâyeler ve yönetim özellikleri sunar. Veriler PostgreSQL, MySQL/MariaDB veya yerel JSON dosyasında tutulabilir.

## Özellikler

- Sohbetler, kanallar, arama, yanıtlar, düzenleme, tepkiler ve sabitlenen mesajlar
- Görsel ve sesli mesajlar, hikâyeler ve tarayıcı bildirimleri
- Kullanıcı, rapor, grup, kanal ve sistem ayarlarının yönetimi
- Temalar, sohbet arka planları ve yerel SVG avatar üretimi
- İsteğe bağlı Gemini asistanı
- Linux kurulum aracı, systemd servisi ve İngilizce stargram yönetim menüsü

## Kurulum

Node.js 18 veya yenisi ve npm gerekir. Linux kurulum aracı root ya da sudo ister. SQL isteğe bağlıdır; DB_TYPE=local JSON kullanır. Yayın ortamında Nginx veya Caddy ile HTTPS yapılandırın.

~~~bash
bash <(curl -fsSL https://raw.githubusercontent.com/arimakomi/StarGram/main/setup.sh)
~~~

Elle kurulum:

~~~bash
git clone https://github.com/arimakomi/StarGram.git
cd StarGram
npm ci
cp .env.example .env
~~~

.env içinde PORT, DB_TYPE, ADMIN_USER ve ADMIN_PASS değerlerini belirleyin:

~~~bash
npm run build
node server.js --init
npm start
~~~

PostgreSQL veya MySQL/MariaDB için DB_TYPE, DB_HOST, DB_PORT, DB_NAME, DB_USER ve DB_PASS ayarlayın. DATABASE_URL da desteklenir.

## Yönetim ve güvenlik

~~~bash
sudo stargram
sudo stargram status
sudo stargram start
sudo stargram stop
sudo stargram restart
sudo stargram logs
sudo stargram health
sudo stargram backup
sudo stargram admin
sudo stargram update
sudo stargram help
~~~

update main dalının arşivini doğrudan GitHub'dan indirir; kurulum klasörü bir Git deposu olmasa da çalışır. Uygulama dosyalarını yeniler, bağımlılıkları kurar, derleme yapar ve varsa systemd servisini yeniden başlatır. data/, backups/, .env dosyaları ve node_modules/ korunur. Yerel kod değişikliklerinin üzerine yazılabilir. PWA kurulumu HTTPS ve uyumlu tarayıcı gerektirir; MIT lisansı.
