# ⭐ StarGram

> **Langue :** [English](README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md) · [简体中文](README.zh-CN.md)

StarGram est une messagerie web auto-hébergée avec une interface persane. Elle prend en charge les conversations privées et de groupe, les chaînes, les stories et l’administration. Les données restent sur votre serveur : PostgreSQL, MySQL/MariaDB ou JSON local.

## Fonctionnalités

- Conversations, chaînes, recherche, réponses, modifications, réactions et messages épinglés
- Images, messages vocaux, stories et notifications du navigateur
- Gestion des utilisateurs, signalements, groupes, chaînes et paramètres
- Thèmes, fonds de discussion et avatars SVG générés localement
- Assistant Gemini facultatif
- Installateur Linux, service systemd et menu anglais de la commande stargram

## Installation

Node.js 18 ou plus récent et npm sont requis. L’installateur Linux demande root ou sudo. SQL est facultatif ; DB_TYPE=local utilise JSON. Configurez HTTPS avec Nginx ou Caddy pour la production.

~~~bash
bash <(curl -fsSL https://raw.githubusercontent.com/arimakomi/StarGram/main/setup.sh)
~~~

Installation manuelle :

~~~bash
git clone https://github.com/arimakomi/StarGram.git
cd StarGram
npm ci
cp .env.example .env
~~~

Configurez PORT, DB_TYPE, ADMIN_USER et ADMIN_PASS dans .env, puis lancez :

~~~bash
npm run build
node server.js --init
npm start
~~~

Pour PostgreSQL ou MySQL/MariaDB, configurez DB_TYPE, DB_HOST, DB_PORT, DB_NAME, DB_USER et DB_PASS. DATABASE_URL est également pris en charge.

## Gestion du serveur

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

update télécharge directement depuis GitHub l’archive de la branche main ; il fonctionne donc même si le dossier d’installation n’est pas un dépôt Git. Il remplace les fichiers de l’application, installe les dépendances, effectue le build et redémarre systemd si disponible. Il conserve data/, backups/, les fichiers .env et node_modules/. Les modifications locales du code peuvent être remplacées.

## PWA et sécurité

L’installation PWA nécessite un navigateur compatible et HTTPS ; localhost convient au développement. Sur iOS, utilisez le menu de partage Safari puis Add to Home Screen. Les mots de passe sont hachés avec scrypt, mais les messages ne sont pas chiffrés de bout en bout. Utilisez HTTPS et protégez les données et sauvegardes. Gemini est facultatif.

Pour contribuer, utilisez Node.js 18+, npm ci, npm run dev et npm run build. Si auth.ts ou avatarGenerator.ts manque, récupérez le dépôt complet ; Linux respecte la casse. Licence MIT.
