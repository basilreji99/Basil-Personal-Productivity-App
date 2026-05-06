# Basil Daily (Personal Development App)

A personal productivity app built with React + Capacitor that runs on both the web and Android. All data stays in your browser's `localStorage` and syncs across devices via your own Google Drive — no backend, no subscription, no data sent to third-party servers.

## Features

- **Tasks** — Epics → Stories → Tasks → Subtasks (Jira-style backlog + board). Sprint planning, drag-to-reorder, progress bars, due-date badges.
- **Notes** — Rich-text notes with checklists, tags, and pinning.
- **Finance** — Income/expense tracking with categories and recurring transactions.
- **Habits** — Daily/weekly habit streaks.
- **Calendar** — Google Calendar integration + task due dates on the grid.
- **Health** — Body measurement tracker.
- **Hobbies** — Movie/series log, music (Spotify), drawing portfolio (images stored in Google Drive), fitness log.
- **Cross-device sync** — Backup/restore via Google Drive `appDataFolder`. Pull-to-refresh on mobile.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18 or later |
| npm | 9 or later |
| Android Studio | Hedgehog or later (Android builds only) |
| Java JDK | 17 (Android builds only) |

---

## 1. Clone the repo

```bash
git clone <your-repo-url>
cd "notes app/app"
npm install
```

---

## 2. Set up Spotify (optional — Music tab)

> Skip this if you don't need the Music / Spotify feature.

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and create an app.
2. In your app settings add the following **Redirect URI**:
   - Web: `http://localhost:5173/spotify-callback` (dev) and your production URL
   - Android: `basilapp://spotify-callback`
3. Copy the **Client ID**.
4. Create `app/.env` from the example:

```bash
cp .env.example .env
```

5. Paste your Client ID into `.env`:

```
VITE_SPOTIFY_CLIENT_ID=your_client_id_here
```

---

## 3. Set up Google APIs (sync + calendar)

This app uses two Google APIs, both accessed with a single OAuth 2.0 Client ID that **you own** — your data never touches any third-party server.

### 3a. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Click **Select a project → New Project**. Give it any name.
3. Enable the following APIs (**APIs & Services → Library**):
   - **Google Drive API**
   - **Google Calendar API**

### 3b. Configure the OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**.
2. Choose **External**, click **Create**.
3. Fill in the app name (anything), your email for support contact, and your email again for developer contact. Click **Save and Continue**.
4. On the **Scopes** step, click **Add or Remove Scopes** and add:
   - `https://www.googleapis.com/auth/drive.appdata`
   - `https://www.googleapis.com/auth/calendar.readonly`
5. Click **Save and Continue**.
6. On the **Test users** step, click **Add Users** and add your own Google email. Click **Save and Continue**.

### 3c. Create a Client ID

1. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**.
2. Application type: **Web application**.
3. Under **Authorised JavaScript origins** add:
   - `http://localhost:5173` (for local dev)
   - Your production domain if deploying to the web
4. Under **Authorised redirect URIs** add:
   - `http://localhost:5173/` (note the trailing slash)
   - Your production URL if applicable
5. Click **Create** and copy the **Client ID** (looks like `xxxxxxxx.apps.googleusercontent.com`).

> The Client ID is **not a secret** — it is pasted in the app's UI at runtime (Settings / Calendar page → "Connect Google"), not in any config file.

### 3d. Android deep-link (if building the APK)

The Android app receives the OAuth token via a custom deep link (`basilapp://`). No extra Google Console step is needed for this — the redirect is handled by the Capacitor Browser plugin opening the system browser and redirecting back.

---

## 4. Run on the web

```bash
npm run dev
```

Open `http://localhost:5173`.

To connect Google sync:
1. Open the **Calendar** tab.
2. Paste your OAuth Client ID and tap **Connect primary Google account**.
3. Sign in with the Google account you added as a test user.

---

## 5. Build the Android APK

```bash
# 1. Build the web assets
npm run build

# 2. Copy web assets into the Android project
npx cap sync

# 3. Open Android Studio
npx cap open android
```

Inside Android Studio:

1. **Build → Clean Project**
2. **Build → Generate Signed Bundle / APK → APK**
   - Create or choose a keystore (keep it safe — do not commit it).
3. Install the APK on your device.

### First launch on Android

- Open the app, go to **Calendar**, paste your Client ID and tap **Connect Google**.
- This stores the OAuth token in `localStorage`. If you reinstall the APK, localStorage is wiped and you must reconnect.

---

## 6. Cross-device sync explained

- All data lives in `localStorage` on each device.
- When you connect Google, the app uploads a JSON backup to your Google Drive **appDataFolder** (a private, app-only folder invisible in Google Drive UI).
- On startup, tab-switch, or pull-to-refresh, the app compares timestamps and merges the latest version.
- No backend is involved. Only you can read the backup (it lives in your own Drive).

---

## 7. Personalising the app name / package ID

Edit `app/capacitor.config.ts`:

```ts
const config: CapacitorConfig = {
  appId: 'com.yourname.yourapp',   // must be unique on your device
  appName: 'Your App Name',
  ...
};
```

Then re-run `npx cap sync`.

---

## 8. Environment variables reference

| Variable | Where to get it | Required |
|----------|----------------|----------|
| `VITE_SPOTIFY_CLIENT_ID` | [developer.spotify.com](https://developer.spotify.com/dashboard) | Only for Music tab |

The Google OAuth Client ID is **not** an environment variable — it is entered by the user at runtime inside the app.

---

## Tech stack

| Layer | Library |
|-------|---------|
| UI | React 19, Tailwind CSS 3 |
| Routing | React Router 7 |
| State | Zustand 5 (persisted to localStorage) |
| Rich text | Tiptap 3 |
| Charts | Recharts |
| Drag & drop | @dnd-kit |
| Mobile | Capacitor 8 (Android) |
| Sync | Google Drive API v3 (appDataFolder) |
| Calendar | Google Calendar API v3 |
| Music | Spotify Web API (PKCE flow) |

