# Basil Daily — Personal Productivity App

A personal productivity app built with React + Capacitor that runs on both the web and Android. All data lives in your browser's `localStorage` and syncs across devices via your own Google Drive — no backend, no subscription, no data sent to third-party servers.

## Features

**Productivity**
- **Tasks:** Epics → Stories → Tasks → Subtasks (Jira-style backlog + board). Sprint planning, drag-to-reorder, recurring tasks, progress bars, due-date badges.
- **Notes:** Rich-text notes (Tiptap) with checklists, tags, folders, pinning, and masonry layout.
- **Habits:** Daily/weekly/monthly habit tracking with streaks, heatmap, and source-linked habits (auto-marked by gym/sports sessions).
- **Finance:** Income/expense tracking with categories, charts (Recharts), and month navigator.
- **Goals:** OKR-style goal tracking with key results and auto-completion detection.
- **Sprints:** Full sprint board with kanban, rollover, and auto-activation by date range.
- **Pomodoro Timer:** Focus sessions linked to tasks, with session history.

**Health & Fitness**
- **Gym:** Active workout tracker with built-in + custom exercises, sets/reps/weight logging.
- **Sports & Fitness:** Sport session log (running, swimming, cycling, etc.) with duration and calories.
- **Health:** Body measurement tracker (weight, body fat, muscle mass, BMI, and more).
- **Health Connect (Android):** Auto-imports steps, sleep, and workout sessions from Health Connect.

**Lifestyle**
- **Calendar:** Google Calendar integration (multi-account), local events, month grid + agenda view, task due dates on the grid.
- **Hobbies:** Movie/series log, Spotify music tracking, drawing portfolio (images stored in Google Drive), books log, travel log.
- **Weekly Digest:** Automated summary of habits, tasks, and fitness for the past week.
- **Yearly Review:** Annual reflection and review page.

**Sync & Infrastructure**
- **Cross-device sync:** Backup/restore via Google Drive `appDataFolder`. Pull-to-refresh on mobile, tab-switch sync on web, 30s periodic push.
- **Offline support:** Offline banner, queued sync on reconnect.
- **Dark mode:** System-aware with manual override.
- **Onboarding:** First-launch walkthrough.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18 or later |
| npm | 9 or later |
| Android Studio | Hedgehog or later (Android builds only) |
| Java JDK | 17 (Android builds only) |

---

## 1. Clone and install

```bash
git clone https://github.com/basilreji99/Basil-Personal-Productivity-App
cd "Basil-Personal-Productivity-App"
npm install
```

---

## 2. Environment variables

Create a `.env` file in the project root:

```
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id

VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=your_google_client_secret
VITE_GOOGLE_OAUTH_RELAY_URL=https://your-github-username.github.io/oauth-relay/
```

See sections 3 and 4 below for how to get these values.

---

## 3. Set up Google APIs (sync + calendar)

### 3a. Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → **New Project**.
2. Enable these APIs under **APIs & Services → Library**:
   - **Google Drive API**
   - **Google Calendar API**

### 3b. OAuth consent screen

1. **APIs & Services → OAuth consent screen → External → Create**.
2. Fill in app name and your email. Click **Save and Continue**.
3. Add scopes:
   - `https://www.googleapis.com/auth/drive.appdata`
   - `https://www.googleapis.com/auth/calendar.readonly`
4. Add your Google account as a **test user**. Save.

### 3c. Create a Web application credential

1. **Credentials → Create Credentials → OAuth 2.0 Client ID**.
2. Application type: **Web application**.
3. Under **Authorised redirect URIs** add:
   - `http://localhost:5173/` (web dev)
   - `https://your-github-username.github.io/oauth-relay/` (Android — see section 3d)
4. Copy the **Client ID** and **Client Secret** into your `.env`.

### 3d. Android OAuth relay (required for APK sign-in)

Android can't receive an OAuth redirect directly on `http://localhost`, so a tiny GitHub Pages relay page bridges Google's HTTPS redirect back into the app.

1. Create a **public** GitHub repo named `oauth-relay`.
2. Add one file `index.html` with this exact content:
   ```html
   <!doctype html><html><head><script>location.replace('basilapp://oauth2callback'+location.search)</script></head><body></body></html>
   ```
3. **Settings → Pages → Source → Deploy from branch → main / (root)** → Save.
4. Once live, `https://your-github-username.github.io/oauth-relay/` will redirect to the app.
5. Add that URL as a redirect URI in your Google credential (step 3c above).
6. Set `VITE_GOOGLE_OAUTH_RELAY_URL` in your `.env` to that URL.

---

## 4. Set up Spotify (optional — Music tab)

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → create an app.
2. Add redirect URIs:
   - Web: `http://localhost:5173/spotify-callback`
   - Android: `basilapp://spotify-callback`
3. Copy the **Client ID** into `VITE_SPOTIFY_CLIENT_ID` in your `.env`.

---

## 5. Run on the web

```bash
npm run dev
```

Open `http://localhost:5173`. To connect Google sync, go to the **Calendar** tab, enter your credentials, and tap **Save & Sign In**.

---

## 6. Build the Android APK

```bash
# Build web assets
npm run build

# Sync into Android project
npx cap sync

# Open in Android Studio
npx cap open android
```

In Android Studio:
1. **Build → Clean Project**
2. **Build → Generate Signed Bundle / APK → APK**
3. Install the APK on your device.

**First launch on Android:** tap Sign In on the Calendar page. Chrome Custom Tab opens, you sign in with Google, and the relay page sends the token back to the app automatically. Sign-in persists — the refresh token is stored and renewed silently every hour.

---

## 7. Cross-device sync

- All data lives in `localStorage` on each device.
- On sign-in, the app uploads a JSON backup to your Google Drive **appDataFolder** (a private, app-only folder not visible in the Drive UI).
- On startup, tab-switch, or pull-to-refresh (mobile), the app compares timestamps and pulls the latest version.
- No backend. Only you can read the backup (it lives in your own Drive account).

---

## 8. Environment variables reference

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SPOTIFY_CLIENT_ID` | Spotify app Client ID | Music tab only |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Web credential Client ID | Yes |
| `VITE_GOOGLE_CLIENT_SECRET` | Google OAuth Web credential Client Secret | Yes |
| `VITE_GOOGLE_OAUTH_RELAY_URL` | GitHub Pages relay URL for Android OAuth | Android only |

---

## Project structure

```
├── src/
│   ├── pages/           # Top-level pages (Dashboard, Today, Notes, Tasks, …)
│   │   └── hobbies/     # Sub-pages (Movies, Music, Books, Fitness, Drawing, Travel)
│   ├── components/
│   │   ├── layout/      # AppShell, TopBar, BottomNav
│   │   ├── calendar/    # MonthGrid, EventModal
│   │   ├── tasks/       # TaskModal, BoardCard
│   │   └── ui/          # Modal, DatePicker, ConfirmDialog, shared UI
│   ├── store/           # Zustand stores (one per domain)
│   ├── services/        # googleAuth, driveSync, calendarApi, spotifyAuth, hcSync, …
│   └── utils/           # nanoid, dateUtils, sanitizeHtml, imageCache
├── android/             # Capacitor Android project
└── public/
```

---

## Tech stack

| Layer | Library |
|-------|---------|
| UI | React 18, Tailwind CSS 3 |
| Routing | React Router 7 (HashRouter) |
| State | Zustand 5 (persisted to localStorage) |
| Rich text | Tiptap |
| Charts | Recharts |
| Drag & drop | @dnd-kit |
| Mobile | Capacitor 8 (Android) |
| Sync | Google Drive API v3 (appDataFolder) |
| Calendar | Google Calendar API v3 |
| Music | Spotify Web API (PKCE) |
| Health | Health Connect (Android, via Capacitor plugin) |
