# StarGram CLI: English Localization, Safe Update & Uninstall

Comprehensive modernization of the StarGram terminal CLI (`stargram`) and installer (`setup.sh`) to provide an English-first terminal experience, automated database-safe updates with pre-update snapshot creation, and clean service uninstallation that preserves database data and configurations automatically.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following operational behaviors have been confirmed through user clarification:

- **Confirmed Decision 1 (Uninstall Safety)**: `stargram uninstall` will cleanly stop and remove the systemd service and command symlink while **always keeping all database files (`data/`), `.env` configurations, and database tables intact**.
- **Confirmed Decision 2 (Zero-Loss Update)**: `stargram update` will automatically execute a snapshot database backup (`cmd_backup`) before pulling updates, installing dependencies, rebuilding the frontend bundle, and running non-destructive schema synchronization.
- **Confirmed Decision 3 (Terminal Localization)**: All terminal banners, prompts, status screens, and interactive menus across `/bin/stargram` and `/setup.sh` are converted completely to standard, professional English.

---

### 1. Overview & Core Concept

- **What It Does**: Provides server administrators with a robust, English-localized terminal suite for managing StarGram. Features include service control (`start`, `stop`, `restart`, `enable`, `disable`), health probes, port re-mapping, live log inspection, non-destructive automated updates with pre-update backup snapshots, and a safe uninstallation command that preserves valuable user data.
- **Target Audience / Persona**: Self-hosters, DevOps engineers, and server administrators deploying StarGram on Linux VPS/cloud servers.
- **Key Value**: Guarantees zero downtime accidents or database corruption during updates, allows safe service decommissioning without data loss, and delivers a clean, universal English CLI standard.

---

### 2. User Experience & Visual Design

#### Key User Flows

1. **Interactive Management Menu (`stargram` or `sudo stargram`)**:
   - Launches an English dashboard showing live system status: service state (Active/Inactive), auto-start status, listening port, database engine details (PostgreSQL, MySQL, or Local Storage), database connection health, server uptime, and project directory.
   - Clean numbered menu options:
     - `1) Start` & `6) View Logs`
     - `2) Stop` & `7) Health / Database Diagnostic`
     - `3) Restart` & `8) Update from Git (Zero Data Loss)`
     - `4) Change Port` & `9) Database Backup Snapshot`
     - `5) Toggle Autostart` & `a) Reset Admin Password`
     - `u) Uninstall Service` & `0) Exit`
2. **Safe Automated Update Flow (`stargram update`)**:
   - Step 1: Takes an automated pre-update database snapshot into `backups/`.
   - Step 2: Checks git status and pulls latest repository release (`git pull --ff-only`).
   - Step 3: Installs updated dependencies (`npm install --no-audit --no-fund`).
   - Step 4: Recompiles the Vite client application (`npm run build`).
   - Step 5: Runs idempotent database synchronization (`node server.js --init`) without dropping existing tables or records.
   - Step 6: Restarts the systemd unit and polls `/api/health` to confirm active status.
3. **Safe Uninstall Flow (`stargram uninstall`)**:
   - Stops the running systemd daemon.
   - Disables autostart and removes `/etc/systemd/system/stargram.service`.
   - Reloads systemd daemon.
   - Removes `/usr/local/bin/stargram` symlink.
   - Prints clear confirmation that all database files, user uploads, `.env` credentials, and backup archives remain safely preserved in the project directory.

#### Visual Identity & Terminal Design
- **Color Coding**: 
  - Green (`✔`, `Active`, `Healthy`) for operational success.
  - Red (`✘`, `Inactive`, `Error`) for failures and stopped services.
  - Yellow (`!`, `Disabled`, `Warning`) for cautions and state changes.
  - Blue (`➜`, `[1]`) for section headers and prompts.
- **Typography & Formatting**: Clean Unicode box borders (`══════════`), aligned label-value columns, and standard ISO timestamps on backup snapshots.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Pre-Update Backup Snapshot**
  - *Chosen Approach*: Force an automated call to `cmd_backup` before any git pull or build step executes in `cmd_update`.
  - *Why*: Guarantees immediate disaster recovery if a remote commit alters table constraints or introduces unexpected issues.
  - *Alternatives Considered*: Manual backup prompt (rejected because automated backups eliminate human error during updates).
- **Decision 2: Automatic Data Preservation on Uninstall**
  - *Chosen Approach*: De-register systemd service and CLI binaries, but leave `.env`, `data/`, and database tables intact.
  - *Why*: Respects user choice A and prevents catastrophic permanent data loss if an administrator uninstalls the service temporarily for maintenance or migration.
- **Decision 3: Complete English Localization of Installer and CLI**
  - *Chosen Approach*: Translate all messages, prompts, banners, help screens, and interactive dialogs in both `/bin/stargram` and `/setup.sh` to English.
  - *Why*: Aligns with standard Linux server conventions and fulfills the user's explicit mandate that all terminal outputs be English.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                      Linux Host System                      │
│                                                             │
│   ┌───────────────────────┐       ┌─────────────────────┐   │
│   │   setup.sh (English)  │──────▶│ /etc/systemd/system │   │
│   │  One-line VPS Setup   │       │   stargram.service  │   │
│   └───────────────────────┘       └──────────┬──────────┘   │
│                                              │ controls     │
│   ┌───────────────────────┐                  ▼              │
│   │  stargram CLI tool    │──────▶┌─────────────────────┐   │
│   │  /bin/stargram        │       │   Node.js Server    │   │
│   │  - status / logs      │       │     server.js       │   │
│   │  - update (safe)      │       └──────────┬──────────┘   │
│   │  - backup / restore   │                  │              │
│   │  - uninstall (safe)   │                  ▼              │
│   └──────────┬────────────┘       ┌─────────────────────┐   │
│              │ snapshots          │  Database Storage   │   │
│              ▼                    │  - PostgreSQL /     │   │
│   ┌───────────────────────┐       │    MySQL Engine     │   │
│   │ backups/*.sql.gz      │       │  - data/stargram_   │   │
│   │ backups/*.json.gz     │       │    db.json (Local)  │   │
│   └───────────────────────┘       └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### CLI Command Matrix

| Command | Action Performed | Data Safety Guarantee |
| :--- | :--- | :--- |
| `stargram status` | Queries systemd & `/api/health` | Read-only; zero mutation |
| `stargram start / stop / restart` | Controls `systemctl` lifecycle | Zero file/database changes |
| `stargram update` | Backup ➔ Pull ➔ Install ➔ Build ➔ DB sync ➔ Restart | Auto-backup snapshot taken first; idempotent DB init |
| `stargram uninstall` | Stops service, removes systemd unit & CLI symlink | Databases, configs & backups preserved automatically |
| `stargram backup` | Generates `.sql.gz` or `.json.gz` snapshot | Pure archive creation in `backups/` |
| `stargram port [N]` | Rebinds port in `.env` & firewall, restarts service | Preserves all credentials and records |
| `stargram admin` | Sets new admin username/password via `server.js --init` | Updates credentials securely without touching messages |
