# Implementation Plan: Group Message Avatars, Auto Notifications & Telegram Light Theme Overhaul

This plan details the implementation of 3 key enhancements:
1. **Telegram-style group message layout** with sender avatars aligned at the bottom of message clusters and an organic speech bubble tail emerging from the avatar.
2. **Automatic notification permission request** on launch with an interactive floating browser settings guidance banner if blocked or denied.
3. **Complete Telegram Light (Day) theme overhaul** featuring soft green sent bubbles, pure white received bubbles, and pristine contrast across all inputs, badges, and modals.

---

## User Review Required

> [!IMPORTANT]
> **Key Decisions based on your feedback & preferences:**
> 1. **Group Message Avatar & Tail (Exact Telegram Style)**:
>    - In groups (`chat.type === 'group'`), other members' messages display their circular avatar beside the **bottom** message of consecutive clusters.
>    - The bottom message bubble features a sharp organic tail connecting directly to the avatar, creating the visual effect that the message emerges from the avatar.
>    - Consecutive messages from the same sender omit redundant avatars and display an aligned spacer.
>    - The sender's display name is shown only on the first message of the cluster with distinct Telegram color coding (peach, purple, emerald, cyan, coral, sky blue).
> 2. **Automatic Notification Flow**:
>    - Prompt browser notification permission automatically when StarGram opens.
>    - If permission is denied or blocked, display a sleek floating banner with instructions on enabling notifications from browser settings (lock icon / permissions), plus a "بررسی مجدد مجوز" action and auto-detection on window focus.
> 3. **Classic Telegram Light (Day) Theme**:
>    - **Sent bubbles**: Telegram soft light green (`#eeffde`) with dark text (`#111827`) and emerald timestamps/checks (`#4fae4e`).
>    - **Received bubbles**: Crisp pure white (`#ffffff`) with subtle border, dark text, and soft timestamps.
>    - **Buttons & Badges**: Preserve crisp white text on accent buttons (`#3390ec`, red, green), eliminating unreadable washed-out text.
>    - **Chat Wallpaper & Shell**: Light neutral wallpaper, clean sidebar headers, and high-contrast input boxes with clear placeholders.

---

## Proposed Changes

### 1. Group Message Avatar & Tail Architecture (`components/ChatArea.tsx`)
- **Sender Clustering**:
  - Compute `isFirstInCluster` and `isLastInCluster` based on consecutive messages from the same sender within 5 minutes.
  - Spacing rhythm: `mt-2.5` between different senders, `mt-1` between consecutive messages by the same sender.
- **Avatar & Tail Rendering**:
  - In `chat.type === 'group' && !isMe`:
    - At the bottom of the cluster (`isLastInCluster`): Render circular 36x36px avatar with hover effect, clickable to view user profile.
    - At earlier messages in the cluster: Render an aligned `w-9 shrink-0` spacer.
    - Message bubble tail: Render an SVG beak at `bottom-0 -left-[7px]` on `isLastInCluster`, pointing directly into the avatar.
    - Set `rounded-bl-none` on the bottom-left corner of the message bubble touching the tail.
- **Sender Color Coding**:
  - Implement deterministic `getSenderColor` hashing across 7 Telegram colors (e.g. peach `#faa774`, purple `#a695e7`, emerald `#7bc862`).
  - Render colored display name only on `isFirstInCluster`.

---

### 2. Automatic Notification Prompt & Settings Banner (`App.tsx` & `services/notificationService.ts`)
- **Auto Prompt on Launch**:
  - In `App.tsx`, check `Notification.permission` on mount.
  - If `default`, immediately invoke `requestNotificationPermission()`.
- **Floating Settings Guidance Banner**:
  - If permission is not granted (`denied` or dismissed), show a floating glassmorphic banner at top:
    - BellRing icon with pulse indicator.
    - Persian instructions: "برای دریافت پیام‌ها در پس‌زمینه، روی علامت قفل کنار آدرس کلیک کرده و دسترسی اعلان را فعال کنید."
    - Button: "بررسی مجدد مجوز" (re-checks permission and plays chime if granted).
    - Dismiss button: "بعداً".
  - Window `focus` event listener to automatically dismiss banner when user returns after enabling notifications in browser settings.

---

### 3. Comprehensive Telegram Light Theme Overhaul (`index.html`, `components/ChatArea.tsx`, `components/Sidebar.tsx`)
- **Light Theme CSS in `index.html`**:
  - Set `.day-theme` palette:
    - Sent message bubble: `background-color: #eeffde !important; color: #111827 !important; border: 1px solid #d4f0be;`.
    - Sent message tail SVG: `color: #eeffde !important;`.
    - Received message bubble: `background-color: #ffffff !important; color: #111827 !important; border: 1px solid #e5e7eb; box-shadow: 0 1px 2px rgba(0,0,0,0.06);`.
    - Received message tail SVG: `color: #ffffff !important;`.
    - Timestamps and ticks: `#4fae4e` on sent bubbles, `#707579` on received bubbles.
    - Fix button text: strictly preserve `color: #ffffff !important;` on `.bg-[#3390ec]`, `.bg-red-500`, `.bg-green-500`, and badge pills.
    - Inputs & Textareas: `background-color: #f3f4f6 !important; color: #111827 !important; border-color: #e5e7eb !important;`.
    - Scrollbars: Soft gray thumb `rgba(0,0,0,0.2)`.
    - Chat background wallpaper in Day theme: soft Telegram pattern `#e4ecf2`.
- **Dynamic Message Tail Color in `ChatArea.tsx`**:
  - Ensure tail SVG uses `currentColor` matching the bubble's theme-resolved background.

---

## Verification Plan

### Automated Verification
- Run `compile_applet` to verify clean TypeScript compilation.
- Run `lint_applet` to check for syntax and type errors.

### Manual Verification
1. **Group Message Avatar & Tail**:
   - Open a group chat with multiple participants.
   - Verify avatar appears at the bottom of consecutive messages from other members.
   - Verify the speech bubble tail connects directly to the avatar.
   - Verify sender name is shown in distinctive color only on the first message of each cluster.
   - Verify private chats and channels remain clean without group avatars.
2. **Notification Flow**:
   - Reload app: verify browser notification permission is automatically requested.
   - If blocked or closed, verify floating top banner shows guidance with "بررسی مجدد مجوز".
3. **Light Theme Quality**:
   - Switch to Day theme in Settings.
   - Verify sent bubbles are soft green (`#eeffde`), received bubbles are pure white (`#ffffff`).
   - Verify all texts, timestamps, buttons, and input fields are crisp, legible, and high-contrast with zero white-on-white or clashing elements.
