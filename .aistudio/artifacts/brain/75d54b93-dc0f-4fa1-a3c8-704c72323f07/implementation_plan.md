# Implementation Plan: StarGram Seen System, Presence, Profile, Notifications & Customization

Fix and enhance the StarGram messaging experience with accurate read receipts, group seen member list submenu on hover, channel view counts, real-time online presence tracking, rich profile fields, customizable chat backgrounds, Web & audio notifications, and a sleek entrance animation.

---

## User Review Required

> [!IMPORTANT]
> **Key Decisions based on your feedback:**
> 1. **Group Seen Members List**: Context menu will show "دیده‌شده توسط X نفر" exclusively on your own messages in groups. Hovering over this item will reveal an animated flyout submenu with member avatars, names, and seen timestamps (also touch-accessible on mobile).
> 2. **Notifications**: Full dual support — native Web Notifications (desktop and mobile browser) plus synthesized in-app audio chime and top toast banner when the app is in the foreground.
> 3. **Online Presence**: Real-time periodic heartbeat with relative Persian timestamps (e.g., "آنلاین", "آخرین بازدید ۱ دقیقه پیش", "آخرین بازدید دیروز") instead of perpetually showing "online".
> 4. **Chat Wallpaper**: Global wallpaper settings with preset patterns, gradients, and custom image uploads, plus per-chat override options.
> 5. **Extended Profile Fields**: Bio, Phone, Birthday, Telegram ID (@username), and Instagram ID (@handle) — strictly hiding any empty fields from public user cards.
> 6. **Login Animation**: Smooth brand logo splash reveal with fluid fade-and-scale transition into the main chat window.

---

## Proposed Changes

### 1. Data Schema & Types (`types.ts`)
- Update `Message` interface:
  - Add `seenBy?: { userId: string; seenAt: number }[]` for tracking member read receipts in groups.
  - Add `viewsCount?: number` and `viewers?: string[]` for channel message views.
- Update `User` interface:
  - Add `lastSeen?: number` (timestamp of last activity).
  - Add `birthday?: string`.
  - Add `telegramId?: string`.
  - Add `instagramId?: string`.
- Update `Chat` interface:
  - Add `wallpaper?: string` (custom per-chat wallpaper override).

---

### 2. Backend Presence & Heartbeat (`server.js`)
- Add user heartbeat endpoint `POST /api/users/heartbeat` to update `lastSeen: Date.now()` and active presence.
- Update `publicUser()` helper to sanitize and expose `lastSeen`, `birthday`, `telegramId`, `instagramId`, and `wallpaper`.
- Handle automatic offline status when user disconnects or session goes inactive.

---

### 3. Presence & Last Seen Utilities (`services/presenceUtils.ts`)
- Implement `formatLastSeen(timestamp?: number, status?: string): { isOnline: boolean; label: string }`:
  - Active within 60 seconds: "آنلاین" (green indicator).
  - < 1 hour: "آخرین بازدید X دقیقه پیش".
  - Today: "آخرین بازدید امروز در ساعت HH:mm".
  - Yesterday: "آخرین بازدید دیروز در ساعت HH:mm".
  - Older: Persian date format or "آخرین بازدید چند روز پیش".
  - "هیچ‌کس" privacy compliance support.

---

### 4. Message Seen & Channel Views Logic (`App.tsx` & `components/ChatArea.tsx`)
- **Fix Read Receipts**:
  - Message ticks in private chat: Single check for sent, double check for recipient read.
  - Message ticks in groups: Single check for sent, double check when at least one other participant has seen the message.
  - Automatically mark unread messages as read when a chat is opened or viewed, adding `{ userId: currentUser.id, seenAt: Date.now() }` to `seenBy`.
- **Group Right-Click Seen Submenu**:
  - In `ChatArea.tsx`, render context menu row: `دیده شده توسط X نفر` **strictly when** `chat.type === 'group' && contextMenu.message.senderId === currentUser.id`.
  - On hover (or tap), show a floating submenu with:
    - Member avatar & display name.
    - Username `@username`.
    - Formatted seen time (e.g. "۱۰:۲۴" or "۳ دقیقه پیش").
- **Channel Message Views**:
  - For all messages in channels (`chat.type === 'channel'`), render an eye icon and formatted view count (`msg.viewsCount || 1`) next to the timestamp.
  - Automatically increment view count once per user when messages enter view.

---

### 5. Notification System (`services/notificationService.ts`)
- **Web Notifications API**:
  - Request permission and trigger native system notifications (supporting Android Chrome PWA and desktop).
  - Include sender avatar, chat title, message snippet, and click handler to focus the chat.
- **Audio Chime (Web Audio API)**:
  - Synthesize a crisp, pleasant Telegram-style sound chime in Web Audio (zero external asset dependency, guaranteed to play without 404s).
  - Play sound only when receiving messages from others while the app is active and chat isn't muted.
- **In-App Toast Banner & Favicon Badge**:
  - Slide-in top toast banner when message arrives for a chat other than the currently active one.
  - Tab title unread badge count: `(3) StarGram`.

---

### 6. Chat Wallpapers & Backgrounds (`components/SettingsModal.tsx` & `components/ChatArea.tsx`)
- Add **Chat Wallpaper** section in Settings:
  - 8 curated Telegram-style presets: Dark Doodle, Midnight Mesh, Galactic Stars, Emerald Geometric, Sunset Gradient, Velvet Dark, etc.
  - Custom file upload: Upload any image as personal background.
  - Custom image URL option.
  - Real-time preview card.
- Apply wallpaper dynamically in `ChatArea.tsx` (`chat.wallpaper || currentUser.wallpaper || 'default'`).
- Add per-chat wallpaper selection in Chat Info drawer.

---

### 7. Extended User Profiles (`components/MyProfileModal.tsx` & `components/ChatArea.tsx`)
- In `MyProfileModal.tsx`:
  - Input fields for Birthday (تاریخ تولد), Telegram ID (شناسه تلگرام), Instagram ID (شناسه اینستاگرام), Bio, and Phone.
  - Quick link preview & validation.
- In `ChatArea.tsx` User Profile drawer & user info views:
  - **Strict Filter**: If a field is empty, null, or undefined, **do not render it**.
  - For non-empty fields: Render sleek cards with copy buttons and direct link actions (e.g., clicking Telegram ID opens Telegram or copies handle, Instagram links to profile).

---

### 8. Login Entrance Animation (`components/Login.tsx` & `App.tsx`)
- Splash reveal upon login/startup:
  - Glowing StarGram logo with gentle pulse and starfield particle aura.
  - Welcome banner with user display name: `خوش آمدید، [DisplayName]`.
  - Smooth scale-up and fade-out transition into the chat dashboard.

---

## Verification Plan

### Automated Tests & Compilation
- Run `compile_applet` to verify TypeScript builds without errors.
- Run `lint_applet` to ensure code hygiene and zero syntax issues.

### Manual Verification
1. **Seen System**:
   - Send message in group from user A. Check single tick.
   - Switch/log in as user B, open group. User A's message turns to double tick.
   - Right click message on user A: see "دیده شده توسط ۱ نفر". Hover over to view user B's avatar, name, and seen time. Verify the item does not appear on user B's view of user A's message.
2. **Channel Views**:
   - Post message in channel. Verify eye icon and view count are visible to all members under the message.
3. **Presence**:
   - Verify active user shows "آنلاین", and inactive/logged-out user displays "آخرین بازدید X دقیقه پیش".
4. **Notifications**:
   - Send message to another user. Check audio chime plays and native notification / in-app toast appears.
5. **Wallpapers**:
   - Change wallpaper in Settings and per-chat; verify seamless background rendering.
6. **Profile**:
   - Add bio and Telegram ID; leave birthday empty. Verify empty birthday is completely hidden on public profile view.
7. **Entrance Animation**:
   - Log in; observe smooth logo splash animation before dashboard appears.
