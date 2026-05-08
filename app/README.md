# Executive Flow

A personal productivity app built with React + Vite + TypeScript, packaged as an Android APK via Capacitor. No backend required — all data lives in localStorage and syncs to Google Drive.

## Features

- **Notes** — Google Keep-style masonry grid with tags, colors, folders, and pin
- **Tasks** — Kanban board + list view, unlimited nested subtasks, epics/stories/bugs, due dates, priority, recurring tasks, sprint planning with rollover
- **Finance** — Expense tracking with Recharts bar/pie charts, categories, monthly navigator
- **Habits** — Daily habit tracking, streaks, weekly grid, heatmap, reminders
- **Calendar** — Month grid + 30-day agenda, Google Calendar sync (multi-account), local events, task due-dates shown on calendar
- **Health** — Weight, BMI, BMR, blood pressure, heart rate, steps, sleep tracking; Health Connect integration (Android)
- **Fitness / Gym** — Gym session logs, sport session logs, H:MM:SS duration tracking
- **Hobbies** — Movies, Music (Spotify), Books, Drawing, Travel, Fitness/Gym sub-pages
- **Weekly Digest** — Weekly summary of habits, tasks, fitness, finance
- **Yearly Review** — Annual summary view
- **Pomodoro Timer** — 25/5/15 min cycles, linkable to tasks
- **Streamliner** — Slash command bar (`/note`, `/task`, `/habit`, `/timer`)
- **Dashboard** — Today's focus, upcoming events, recent notes, habit snapshot
- **Drive Sync** — Automatic backup/restore to Google Drive (appdata scope), dirty-flag diffing, silent refresh
- **Dark mode** — Full dark theme
- **Onboarding** — First-launch setup flow

## Tech Stack

| Layer | Library |
|-------|---------|
| UI | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS v3 (Material Design 3 tokens) |
| State | Zustand v5 with persist middleware |
| Routing | React Router v7 (HashRouter — required for Capacitor) |
| Charts | Recharts v3 |
| Native | Capacitor 8 (Android) |

**Fonts:** Manrope, Work Sans, Inter (loaded from Google Fonts CDN)  
**Icons:** Material Symbols Outlined (Google Fonts CDN)

## Prerequisites

- Node.js 18+
- npm 9+
- Android Studio (only for building the APK)
- Java 17+ (for Android build)

## Running locally (web)

```bash
cd app
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Building the Android APK

```bash
# 1. Build the web bundle
cd app
npm install
npm run build

# 2. Sync to Capacitor
npx cap sync android

# 3. Open in Android Studio
npx cap open android
```

In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**

The debug APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`.

## Google OAuth Setup (optional — needed for Drive sync and Calendar)

The app works offline without this. To enable Drive backup and Google Calendar:

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → enable **Google Calendar API**, **Google Drive API**, and **Google Sheets API**
3. **APIs & Services → OAuth consent screen** → External, add your email as a test user
4. Add scopes: `drive.appdata`, `calendar.readonly`, `spreadsheets`, `openid`, `email`, `profile`
5. **Credentials → Create → OAuth 2.0 Client ID → Web application**
   - Authorised JavaScript origins: `http://localhost` (for local dev) or your hosted URL
   - Authorised redirect URIs: `http://localhost/` (trailing slash required)
6. Copy the **Client ID** and **Client Secret**
7. In the app: open **Calendar → manage accounts icon (top right)** → paste the Client ID and Client Secret → tap **Connect primary Google account**

> The Client Secret enables persistent login (Auth Code + PKCE with refresh tokens). Without it, the session expires every hour and requires manual reconnection.

### Android deep-link setup

For OAuth to work in the Android APK, the `AndroidManifest.xml` already contains the intent filter for `basilapp://` deep links. No extra steps needed.

## Project Structure

```
app/
├── src/
│   ├── pages/           # Top-level pages (Dashboard, Notes, Tasks, etc.)
│   │   └── hobbies/     # Sub-pages for each hobby
│   ├── components/
│   │   ├── layout/      # AppShell, TopBar, BottomNav, Streamliner
│   │   ├── calendar/    # MonthGrid, EventModal
│   │   ├── tasks/       # TaskModal, BoardCard
│   │   └── ui/          # Modal, DatePicker, shared UI
│   ├── store/           # Zustand stores (one per domain)
│   ├── services/        # googleAuth, driveSync, calendarApi, hcSync, etc.
│   └── types/           # Shared TypeScript types
├── android/             # Capacitor Android project
└── public/
```

## Data & Privacy

All data is stored locally in the browser's `localStorage`. No data is sent anywhere unless you connect a Google account, in which case a backup blob is saved to your own Google Drive (appdata — not visible in Drive UI) and calendar events are read-only from Google Calendar. Nothing is sent to any third-party server.
