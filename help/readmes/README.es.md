# ⭐ StarGram

> **Idioma:** [English](README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md) · [简体中文](README.zh-CN.md)

StarGram es un mensajero web autoalojado con interfaz persa. Incluye chats privados y grupales, canales, historias y administración. Los datos se guardan en tu servidor mediante PostgreSQL, MySQL/MariaDB o JSON local.

## Funciones

- Chats, canales, búsqueda, respuestas, edición, reacciones y mensajes fijados
- Imágenes, mensajes de voz, historias y notificaciones del navegador
- Administración de usuarios, reportes, grupos, canales y configuración
- Temas, fondos y avatares SVG generados localmente
- Asistente Gemini opcional
- Instalador Linux, servicio systemd y menú en inglés para stargram

## Instalación

Requiere Node.js 18 o posterior y npm. El instalador de Linux requiere root o sudo. SQL es opcional; DB_TYPE=local usa JSON. Configura HTTPS con Nginx o Caddy para publicar la app.

~~~bash
bash <(curl -fsSL https://raw.githubusercontent.com/arimakomi/StarGram/main/setup.sh)
~~~

Instalación manual:

~~~bash
git clone https://github.com/arimakomi/StarGram.git
cd StarGram
npm ci
cp .env.example .env
~~~

Configura PORT, DB_TYPE, ADMIN_USER y ADMIN_PASS en .env. Para iniciar:

~~~bash
npm run build
node server.js --init
npm start
~~~

Para PostgreSQL o MySQL/MariaDB configura DB_TYPE, DB_HOST, DB_PORT, DB_NAME, DB_USER y DB_PASS. También se admite DATABASE_URL.

## Administración y datos

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

update descarga directamente de GitHub el archivo de la rama main, así que funciona aunque la carpeta no sea un repositorio Git. Reemplaza los archivos de la aplicación, instala dependencias, compila y reinicia systemd si está disponible. Conserva data/, backups/, los archivos .env y node_modules/. Los cambios locales del código pueden sobrescribirse.

## PWA y seguridad

La instalación PWA requiere un navegador compatible y HTTPS (localhost sirve para desarrollo). En iOS, usa Compartir en Safari y elige Add to Home Screen. Las contraseñas se protegen con scrypt, pero los mensajes no tienen cifrado de extremo a extremo. Protege los datos y copias con HTTPS. Gemini es opcional.

Para contribuir usa Node.js 18+, npm ci, npm run dev y npm run build. Si faltan services/auth.ts o services/avatarGenerator.ts, descarga el repositorio completo: Linux distingue mayúsculas. Licencia MIT.
