# StarGram CLI: Upstream Force-Sync & Database Preservation

A safe, resilient update pipeline for the StarGram CLI that forces synchronization with the latest upstream repository state—overriding local code modifications, merge conflicts, or branch divergence—while strictly protecting all databases, environment credentials, and automated backup snapshots.

## User Review & Critical Decisions

> [!IMPORTANT]
> The update pipeline is architected to prioritize code freshness from the upstream repository without risking data loss. The choices confirmed in Phase 1 have been locked into the technical specification:

- **Confirmed Decision 1 (Conflict & Divergence Strategy)**: Automatic pre-update database backup followed by a hard reset (`git fetch` + `git reset --hard`) directly to the upstream repository branch.
- **Confirmed Decision 2 (Untracked Files)**: Clean untracked code files while strictly protecting and preserving `data/`, `backups/`, `.env`, and existing database storage.
- **Safety Safeguard**: Before any git operation runs, all runtime configurations (`.env`), local JSON databases (`data/stargram_db.json`), and backups are snapshot-staged in temporary safe storage and verified after the sync.

---

## 1. Overview & Core Concept

- **What It Does**: Enhances `stargram update` (and CLI menu option 8) so server administrators can reliably update their production StarGram instances regardless of local file drifts, merge conflicts, or divergent git histories, while guaranteeing zero database corruption or credential loss.
- **Target Audience / Persona**: System administrators, self-hosters, and DevOps engineers running StarGram on Linux servers (VPS, cloud instances, or local machines).
- **Key Value**: Eliminates manual `git merge` / `git stash` hassles and "git pull failed due to uncommitted changes" errors during updates, ensuring continuous, hands-off alignment with upstream releases.

---

## 2. User Experience & Visual Design

### Key User Flows

```
[Administrator runs 'stargram update']
  │
  ├─► 1. Pre-Update Snapshot: Automated database backup (.sql.gz or .json.gz)
  │
  ├─► 2. State Staging: Safe-staging .env, data/, and backups/ to /tmp
  │
  ├─► 3. Upstream Fetch & Sync:
  │      • git fetch --all --prune
  │      • Determine remote branch (tracking or origin/main / origin/master)
  │      • git reset --hard <upstream-target>
  │      • git clean -fd with data, backups, and .env exclusions
  │
  ├─► 4. Integrity Verification: Verify & restore .env and data/ if needed
  │
  ├─► 5. Build & Migrate: npm install -> npm run build -> node server.js --init
  │
  └─► 6. Service Restart: systemctl restart stargram -> display updated status
```

### Visual & Interactive Feedback in Terminal

- **Color Tokens**: Standard ANSI escape formatting matching the existing StarGram CLI theme (`${B}` bold blue headers, `${G}` green checkmarks, `${Y}` yellow warnings, `${R}` red errors, `${D}` dim details).
- **Step-by-Step Progress**:
  - `➜ Step 1/6: Creating automated pre-update database backup snapshot...`
  - `➜ Step 2/6: Staging database and environment files for safe preservation...`
  - `➜ Step 3/6: Force-synchronizing codebase with latest upstream repository...`
  - `➜ Step 4/6: Updating dependencies (npm install)...`
  - `➜ Step 5/6: Building production frontend bundle (npm run build)...`
  - `➜ Step 6/6: Running database schema migrations...`
  - `✔ StarGram update completed successfully. Running on latest upstream commit.`

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Upstream Force-Reset vs. Git Pull Rebase**
  - *Chosen Approach*: `git fetch --all --prune` followed by `git reset --hard origin/<branch>`.
  - *Why*: In production environments, servers frequently develop minor drifts (file permissions, build artifacts, temporary debug lines). Standard `git pull` or `git rebase` fails on these conflicts. Force-reset guarantees 100% parity with upstream.
  - *Alternatives Considered*: Standard `git pull --ff-only` (fails when local commits or dirty worktrees exist); interactive merge (requires manual user intervention in headless cron or automated scripts).

- **Decision 2: Multi-Layer Database & Config Safeguards**
  - *Chosen Approach*: Dual-layer protection:
    1. A formal gzipped backup archive saved to `$APP_DIR/backups/`.
    2. An in-memory/temporary staging snapshot in `/tmp/stargram_stage_$$` to restore local state immediately if `git reset` or `git clean` affects untracked configuration.
  - *Why*: Redundancy ensures zero data loss even if network interrupts the git operation midway.
  - *Alternatives Considered*: Relying solely on `.gitignore` (fragile if upstream repository modifies `.gitignore`).

---

## 4. Technical Architecture & Data Strategy

### System Workflow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    stargram update CLI                       │
└──────────────────────────────┬───────────────────────────────┘
                               │
               ┌───────────────▼───────────────┐
               │    1. Automated Backup        │
               │  (dump DB -> backups/*.gz)    │
               └───────────────┬───────────────┘
                               │
               ┌───────────────▼───────────────┐
               │    2. Staging Protection      │
               │  (copy .env & data/ to /tmp)  │
               └───────────────┬───────────────┘
                               │
               ┌───────────────▼───────────────┐
               │   3. Upstream Force-Sync      │
               │  - git fetch --all --prune    │
               │  - git reset --hard origin/.. │
               │  - git clean -fd (filtered)   │
               └───────────────┬───────────────┘
                               │
               ┌───────────────▼───────────────┐
               │    4. Restore & Verify        │
               │  - ensure .env & data/ match  │
               │  - clean /tmp staging         │
               └───────────────┬───────────────┘
                               │
               ┌───────────────▼───────────────┐
               │   5. Production Rebuild       │
               │  - npm install                │
               │  - npm run build              │
               │  - node server.js --init      │
               └───────────────┬───────────────┘
                               │
               ┌───────────────▼───────────────┐
               │    6. Service Restart         │
               │  - systemctl restart stargram │
               │  - show health status         │
               └───────────────────────────────┘
```

### Data Model & State Protection

- **MySQL / PostgreSQL Databases**: Reside in the SQL database daemon; unaffected by git operations, with fresh SQL dumps in `backups/`.
- **Local Database (`data/stargram_db.json`)**: Preserved via staging, excluded from git clean, and validated post-reset.
- **Environment (`.env`)**: Contains database passwords, JWT secrets, port, and Gemini API keys; preserved via staging and git clean exclusions.
- **Backup Archives (`backups/`)**: Retains all historical and pre-update snapshots.
