# StarGram

> **Read this in:** [English](README.md) · [فارسی](help/readmes/README.fa.md) · [العربية](help/readmes/README.ar.md) · [Español](help/readmes/README.es.md) · [Français](help/readmes/README.fr.md) · [Türkçe](help/readmes/README.tr.md) · [简体中文](help/readmes/README.zh-CN.md)

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Build](https://github.com/arimakomi/StarGram/actions/workflows/build.yml/badge.svg)](https://github.com/arimakomi/StarGram/actions/workflows/build.yml)

StarGram is a self-hosted web messenger with a Persian right-to-left interface. It supports private chats, groups, channels, stories, administration, and optional Gemini assistance. Data can be stored in PostgreSQL, MySQL/MariaDB, or a local JSON file.

User guides (Persian): [General help](help/README.md) · [Web messenger guides](help/web/README.md)

## Features

- Private and group chats, channels, search, replies, editing, reactions, and pinned messages
- Image and voice messages, stories, and browser notifications
- User, report, group, channel, and system configuration management
- Themes and chat wallpapers; default avatars are generated locally as SVG
- PostgreSQL and MySQL/MariaDB, with local JSON storage as a fallback
- Optional Gemini assistant with configurable API key, model, and proxy
- Linux installer, systemd service, and English-language stargram management menu
- GitHub Actions builds the project on every push and pull request

## Requirements

- Node.js 18 or newer and npm
- Root or sudo access for the interactive Linux installer
- PostgreSQL and MySQL/MariaDB are optional; DB_TYPE=local uses JSON storage
- For public deployments, use Nginx or Caddy with HTTPS. StarGram does not terminate TLS itself.

## Quick install on Linux

Run the interactive installer as root:

~~~bash
bash <(curl -fsSL https://raw.githubusercontent.com/arimakomi/StarGram/main/setup.sh)
~~~

The installer checks for Node.js 20, asks for the port, administrator credentials, and database type, installs dependencies, builds the frontend, enables a systemd service when available, and installs the stargram command. Installer prompts and the management menu are in English.

For a non-interactive local-storage installation:

~~~bash
sudo NONINTERACTIVE=1 PORT=3000 \
  ADMIN_USER=admin ADMIN_PASS='ReplaceWithALongUniquePassword' \
  DB_TYPE=local \
  bash setup.sh
~~~

For SQL, set DB_TYPE=mysql or DB_TYPE=postgres and provide the matching connection variables. Never commit real credentials.

## Manual installation

~~~bash
git clone https://github.com/arimakomi/StarGram.git
cd StarGram
npm ci
cp .env.example .env
~~~

Minimal local-storage configuration:

~~~ini
PORT=3000
DB_TYPE=local
ADMIN_USER=admin
ADMIN_PASS=ReplaceWithALongUniquePassword
~~~

For PostgreSQL or MySQL/MariaDB, set DB_TYPE, DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASS. You may set DATABASE_URL instead; it takes precedence over the individual connection values.

Initialize the administrator and start the app:

~~~bash
npm run build
node server.js --init
npm start
~~~

The --init command creates ADMIN_USER, or resets that account's password to ADMIN_PASS. Use a strong, unique password. The app listens on http://localhost:3000 by default; set PORT to change it. SQL tables are initialized by the server. If the configured SQL database is unavailable, the server falls back to local JSON storage.

### Frontend development

Run the API server in one terminal:

~~~bash
npm start
~~~

Then start Vite in another:

~~~bash
npm run dev
~~~

Vite proxies /api requests to http://localhost:3000. Run npm run lint to type-check the TypeScript project.

## Database options

| DB_TYPE | Engine | Data location |
| --- | --- | --- |
| local | JSON file | data/stargram_db.json |
| postgres | PostgreSQL | Configured SQL database |
| mysql | MySQL or MariaDB | Configured SQL database |

Example PostgreSQL setup:

~~~sql
CREATE USER stargram WITH PASSWORD 'CHANGE_THIS_PASSWORD';
CREATE DATABASE stargram OWNER stargram;
~~~

Example MySQL/MariaDB setup:

~~~sql
CREATE DATABASE stargram CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
CREATE USER 'stargram'@'localhost' IDENTIFIED BY 'CHANGE_THIS_PASSWORD';
GRANT ALL PRIVILEGES ON stargram.* TO 'stargram'@'localhost';
FLUSH PRIVILEGES;
~~~

## Gemini assistant

Gemini is optional and is not required to run the messenger. Configure its API key, model, and optional proxy in the admin panel. Keep API keys out of frontend code and public repositories. Assistant requests are sent by the app server to Gemini or the configured proxy.

## Server management

After installation on Linux, run commands with the required privileges:

~~~bash
sudo stargram                 # Open the management menu
sudo stargram status          # Service and database status
sudo stargram start
sudo stargram stop
sudo stargram restart
sudo stargram logs            # Recent logs
sudo stargram logs follow     # Follow logs live
sudo stargram health          # Check the health endpoint
sudo stargram port 8080       # Change the HTTP port
sudo stargram backup          # Create a compressed backup
sudo stargram admin           # Reset administrator credentials
sudo stargram update          # Back up data and update application code
sudo stargram help            # Show all commands
~~~

The update command downloads the latest main branch archive directly from GitHub, so it also works when the installation directory is not a Git checkout. It replaces application files, then installs dependencies, builds the frontend, applies database initialization, and restarts systemd when available. It preserves data/, backups/, .env files, and node_modules/. Local source-code edits may be overwritten. CLI backups are stored in backups/.

## Backups and data

- Local mode stores data in data/stargram_db.json.
- The admin panel can export and restore JSON backups.
- stargram backup creates a compressed JSON backup in local mode and uses the database dump utility for SQL.
- data/, backups/, .env files, dist/, and node_modules/ are excluded from Git.

## Security and privacy

- Account passwords are hashed with scrypt; session tokens are stored as hashes.
- Login attempts are rate-limited, but the application has not had an independent security audit.
- Do not consider the current message format end-to-end encrypted (E2EE): readable message text is also stored in synchronized data.
- The app serves plain HTTP. For production, use an HTTPS reverse proxy and restrict access to data and backup files.
- The interface loads Tailwind CSS and the Vazirmatn font from CDNs, so browsers need internet access for those assets.
- Gemini-related data is sent to the configured provider only when the assistant is enabled and used.

## Troubleshooting

### TypeScript reports Cannot find module for auth or avatarGenerator

This usually means the server has an incomplete or outdated checkout. These files must exist with the exact casing:

~~~text
services/auth.ts
services/avatarGenerator.ts
~~~

Linux filesystems are case-sensitive. Use the complete main branch and build from the project root:

~~~bash
git clone https://github.com/arimakomi/StarGram.git
cd StarGram
npm ci
npm run build
~~~

If using a ZIP, extract the whole project into a new directory. Run build from the folder containing both package.json and services/. GitHub Actions also checks the Linux build after every push.

### The API does not respond

Confirm that the backend is running on the configured PORT and that .env is in the project root. For systemd installations, inspect logs with sudo stargram logs or journalctl -u stargram -n 100.

### The app uses local storage instead of SQL

Check DB_TYPE, host, port, database name, and SQL user permissions. The server falls back to local storage when SQL is unavailable; a healthy HTTP endpoint alone does not prove SQL is connected. Check the active engine in the admin panel or with stargram status.

## Contributing

Development requires Node.js 18+ and npm. Use npm ci and npm run dev; run npm run build before opening a pull request. GitHub Actions runs the same build on Ubuntu with Node.js 20. StarGram is licensed under MIT; see LICENSE.
