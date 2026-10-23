# StarGram: PostgreSQL/MySQL Dual Database, Local Fallback & In-Admin Gemini Proxy Configuration

## User Review & Critical Decisions

> [!IMPORTANT]
> The user confirmed the following architectural decisions in Turn 1:
> - **SQL Database Engine**: Dual support for both **PostgreSQL** and **MySQL / MariaDB**.
> - **Fallback Strategy**: Seamless automatic fallback to **local file storage (SQLite/JSON)** when no live SQL connection is configured, allowing instant out-of-the-box operation without database crashes.
> - **Gemini Configuration**: Configure the optional Gemini API key, model, and reverse/forward proxy endpoint directly through the **Admin Panel interface**, with an optional server-side proxy route `/api/ai/chat`.

---

## 1. Overview & Core Concept

This update transforms StarGram into a 100% self-hosted, sovereign communication platform with zero external platform dependencies:
- **Zero Firebase Dependency**: Replaces the Firebase naming and any lingering references with a clean, unified `database.ts` client layer and a database abstraction in `server.js`.
- **Dual SQL Support (PostgreSQL + MySQL)**: Allows administrators to connect to either PostgreSQL (`pg`) or MySQL/MariaDB (`mysql2`) using environment variables or connection URIs (`DATABASE_URL`, `DB_TYPE=postgres|mysql`).
- **Resilient Local Fallback**: If no database server is running or credentials are not yet supplied, StarGram seamlessly initializes a durable local database (`./data/stargram_db.json` / SQLite schema), allowing immediate startup on development machines and bare-metal VPS without manual database creation.
- **Optional In-Admin Gemini & Proxy Management**: StarGram starts cleanly with or without Gemini. Administrators can input their Gemini API Key, custom base URL / reverse proxy endpoint, and model choice in the Admin Panel under a dedicated "هوش مصنوعی (AI & Gemini)" section, complete with a live "تست اتصال (Test Connection)" button.
- **Hermetic & Self-Contained**: Audits and eliminates all external CDN and network calls so the entire app operates completely within its self-hosted boundary.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **First Launch Zero-Config Flow**:
   - Administrator or user runs `npm start` or `node server.js`.
   - The server inspects `DATABASE_URL` / `DB_HOST`. If unavailable, it quietly initializes the local database engine and launches without errors.
   - The user opens the app, registers an account or logs in immediately.
2. **Admin Gemini & Proxy Setup Flow**:
   - The Super Admin opens the Admin Panel modal (`AdminPanelModal.tsx`) and navigates to the new **هوش مصنوعی (AI Assistant)** tab or System Settings.
   - Admin toggles **فعال‌سازی دستیار هوشمند (Enable AI)**.
   - Admin enters the **Gemini API Key** and an optional **پروکسی / آدرس سرور واسط (Custom Proxy / Base URL)** (e.g., `https://my-gemini-proxy.example.com` or Cloudflare Worker reverse proxy).
   - Admin selects the model (`gemini-2.5-flash`) and clicks **تست اتصال (Test Connection)** to verify without saving.
   - Upon clicking **ذخیره تنظیمات (Save Configuration)**, the settings persist to the database `system_config`.
3. **AI Chat Experience**:
   - If Gemini is disabled or unconfigured, the AI bot politely informs the user: *"دستیار هوش مصنوعی در حال حاضر غیرفعال است یا توسط مدیر تنظیم نشده است."*
   - If enabled and configured, prompts are securely routed through `/api/ai/chat` (applying the configured proxy and key on the server side), streaming responses in real-time Persian.

### Visual Identity & Theme
- **Color Palette & Discipline**: Follows the existing night/arctic/oled/day Telegram theme tokens. 60% canvas, 30% structural surfaces with hairline borders (`border-slate-800` / `border-slate-200`), and 10% accent (Telegram cyan/blue `#2AABEE` and emerald `#10B981` for active status).
- **Zero-Pill Restraint**: Status messages and proxy details use clean typography with quiet separators; interactive form inputs use standard Telegram-styled input containers.
- **Tabular Numerals**: Database connection latency, message counts, and document metrics strictly use `tabular-nums` and monospace styling.

---

## 3. Key Product Decisions & Trade-Offs

- **Database Abstraction Layer in `server.js`**:
  - *Chosen Approach*: Implement a unified database adapter interface (`DbAdapter`) with three implementations: `PostgresAdapter` (via `pg`), `MysqlAdapter` (via `mysql2`), and `LocalAdapter` (file-backed JSON store with atomic writes).
  - *Why*: Eliminates boilerplate, guarantees identical schema and query semantics across all three backends, and enables automatic failover to the local store if MySQL/PostgreSQL connection fails.
- **Server-Side AI Proxy Route (`/api/ai/chat`)**:
  - *Chosen Approach*: Handle Gemini requests via a server-side route `/api/ai/chat` using the credentials stored in `system_config` (or fallback to environment variables).
  - *Why*: Solves CORS restrictions when using custom reverse proxies or foreign API endpoints, keeps user credentials protected on the server, and allows direct streaming to the browser.
- **Refactoring `services/firebase.ts` to `services/database.ts`**:
  - *Chosen Approach*: Create `services/database.ts` as the primary local database client, re-exporting all Firestore-compatible signatures (`doc`, `collection`, `getDocs`, `setDoc`, `updateDoc`, `deleteDoc`, `onSnapshot`) so all existing UI components remain stable while removing the "firebase" misnomer. Provide an alias in `services/firebase.ts` that re-exports from `database.ts` for clean backward compatibility.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (React / Vite)                    │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │    AdminPanelModal    │       │     Sidebar / Chat    │  │
│  │ (Gemini & Proxy Form) │       │   (AI Bot & Dialogs)  │  │
│  └───────────┬───────────┘       └───────────┬───────────┘  │
│              │                               │              │
│              ▼                               ▼              │
│   services/database.ts            services/geminiService.ts │
└──────────────┬───────────────────────────────┬──────────────┘
               │ (Sync Polling & Batches)      │ (POST /api/ai/chat)
               ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│               Node.js Express Server (server.js)            │
│  ┌──────────────────────┐         ┌───────────────────────┐ │
│  │  /api/db/:collection │         │      /api/ai/chat     │ │
│  │  (Auth, Sync, CRUD)  │         │  (Gemini + Proxy URL) │ │
│  └──────────┬───────────┘         └───────────┬───────────┘ │
│             │                                 │             │
│             ▼                                 ▼             │
│    Unified DbAdapter               Google GenAI / Reverse   │
│  ┌────────────────────┐            Proxy Stream             │
│  │ - PostgresAdapter  │                                     │
│  │ - MysqlAdapter     │                                     │
│  │ - LocalAdapter     │                                     │
│  └────────────────────┘                                     │
└─────────────────────────────────────────────────────────────┘
```

### Data Schema (`system_config` collection document `main`):
```typescript
interface SystemConfig {
  allowGroupCreation: boolean;
  allowChannelCreation: boolean;
  allowStories: boolean;
  // Gemini AI configuration
  geminiEnabled?: boolean;
  geminiApiKey?: string;
  geminiProxyUrl?: string; // Custom Base URL or reverse proxy endpoint
  geminiModel?: string;    // e.g. 'gemini-2.5-flash'
}
```

---

## 5. Step-by-Step Execution Plan

1. **Database Adapter & Server Unification (`server.js`)**:
   - Install `pg` and `@types/pg` alongside `mysql2`.
   - Implement the `DbAdapter` interface in `server.js` supporting PostgreSQL (`pg`), MySQL (`mysql2`), and local file-backed storage (`LocalAdapter`).
   - Add graceful detection: if `DATABASE_URL` starts with `postgres://` or `postgresql://`, or `DB_TYPE=postgres`, use PostgreSQL; if MySQL parameters are set, use MySQL; otherwise fall back to `LocalAdapter`.
   - Add `/api/ai/chat` endpoint and `/api/ai/test` endpoint in `server.js` that reads the active `system_config` (API key, proxy URL, model) and streams responses.
2. **Client Service Decoupling**:
   - Refactor `services/firebase.ts` into a clean, modern `services/database.ts`.
   - Update `services/geminiService.ts` to call `/api/ai/chat` on the server with streaming reader fallback.
3. **Admin Panel UI Enhancements (`AdminPanelModal.tsx`)**:
   - Add a dedicated **هوش مصنوعی و جمنای (AI & Gemini)** configuration section in the System Config tab.
   - Provide inputs for:
     - کلید API جمنای (Gemini API Key) with show/hide password toggle.
     - آدرس پروکسی / Endpoint واسط (Proxy / Base URL).
     - مدل هوش مصنوعی (Model selector: `gemini-2.5-flash`, `gemini-2.5-pro`).
     - کلید فعال/غیرفعال‌سازی هوش مصنوعی (Toggle switch).
     - دکمه تست اتصال (Test Connection) with status badge.
4. **Hermetic Audit & Cleanup**:
   - Verify zero external CDN, font, or script calls in `index.html`, `server.js`, and all components.
   - Clean up any legacy or unused Firebase references.
5. **Documentation & Deployment Scripts (`README.md`, `setup.sh`, `.env.example`)**:
   - Update `README.md` in Persian to detail PostgreSQL & MySQL setup, local zero-config mode, Gemini configuration via Admin Panel, and proxy instructions.
   - Update `setup.sh` and `bin/stargram` to support PostgreSQL option alongside MariaDB/MySQL.
6. **Verification**:
   - Run `npm run lint` (`tsc --noEmit`) and `compile_applet`.
   - Verify health check endpoint `/api/health` reports the active database type (`postgres`, `mysql`, or `local`).
