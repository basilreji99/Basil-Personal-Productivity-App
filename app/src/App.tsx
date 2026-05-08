import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Onboarding from './components/Onboarding';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import AppShell from './components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import Notes from './pages/Notes';
import Tasks from './pages/Tasks';
import TaskDetail from './pages/TaskDetail';
import Finance from './pages/Finance';
import Habits from './pages/Habits';
import Calendar from './pages/Calendar';
import Health from './pages/Health';
import Hobbies from './pages/Hobbies';
import Movies from './pages/hobbies/Movies';
import Music from './pages/hobbies/Music';
import Drawing from './pages/hobbies/Drawing';
import Fitness from './pages/hobbies/Fitness';
import Books from './pages/hobbies/Books';
import Gym from './pages/Gym';
import Travel from './pages/hobbies/Travel';
import { useFitnessStore } from './store/fitnessStore';
import { useBooksStore } from './store/booksStore';
import { useGymStore } from './store/gymStore';
import { parseTokenFromHash, exchangeCodeForTokens, getOAuthRedirectUri } from './services/googleAuth';
import { exchangeSpotifyCode } from './services/spotifyAuth';
import { useHobbyStore } from './store/hobbyStore';
import { useSyncStore } from './store/syncStore';
import { useCalendarStore } from './store/calendarStore';
import { useTasksStore } from './store/tasksStore';
import { useNotesStore } from './store/notesStore';
import { useHabitsStore } from './store/habitsStore';
import { useFinanceStore } from './store/financeStore';
import { useHealthStore } from './store/healthStore';
import { markLocalDirty, setSuppressDirtyMark, clearLocalDirty } from './services/driveSync';
import { useSprintStore } from './store/sprintStore';
import { runHCSync } from './services/hcSync';
import WeeklyDigest from './pages/WeeklyDigest';
import YearlyReview from './pages/YearlyReview';
import Goals from './pages/Goals';
import { useGoalsStore } from './store/goalsStore';

function OAuthHandler() {
  const navigate = useNavigate();
  const { setToken, syncNow, fetchCalendar, needsReload, clearNeedsReload } = useSyncStore();
  const { addAccount, fetchAllEvents } = useCalendarStore();

  function handleSpotifyToken(token: string, expiry: number, refreshToken?: string) {
    useHobbyStore.getState().setSpotifyToken(token, expiry, refreshToken);
    navigate('/hobbies/music', { replace: true });
  }

  function handleToken(token: string, expiry: number, refreshToken?: string | null) {
    const { pendingAddAccount: pending } = useCalendarStore.getState();
    if (pending) {
      useCalendarStore.getState().setPendingAddAccount(false);
      addAccount(token, expiry).then(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
        const primary = useSyncStore.getState().isTokenValid()
          ? useSyncStore.getState().accessToken : null;
        fetchAllEvents(start, end, primary);
      });
      navigate('/calendar', { replace: true });
    } else {
      setToken(token, expiry, refreshToken).then(() => {
        syncNow();
        fetchCalendar();
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
        fetchAllEvents(start, end, token);
      });
      navigate('/', { replace: true });
    }
  }

  async function handleGoogleCode(code: string) {
    const verifier = localStorage.getItem('google_pkce_verifier');
    localStorage.removeItem('google_pkce_verifier');
    if (!verifier) {
      navigate('/calendar');
      return;
    }
    const { clientId, clientSecret } = useSyncStore.getState();
    const redirectUri = getOAuthRedirectUri();
    const result = await exchangeCodeForTokens(code, verifier, clientId, clientSecret, redirectUri);
    if (result) {
      handleToken(result.accessToken, result.expiry, result.refreshToken);
    } else {
      navigate('/calendar');
    }
  }

  // Initial load + OAuth callback handling
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // On Android: listen for the deep link callback from Chrome Custom Tab
      const listenerPromise = CapApp.addListener('appUrlOpen', ({ url }) => {
        Browser.close().catch(() => {});
        // Spotify PKCE: basilapp://spotify-callback?code=XXX
        if (url.includes('spotify-callback') && url.includes('code=')) {
          const code = new URL(url).searchParams.get('code');
          if (code) exchangeSpotifyCode(code).then(r => { if (r) handleSpotifyToken(r.token, r.expiry, r.refreshToken); });
          return;
        }
        // Google OAuth auth code flow: code in query params
        if (!url.includes('spotify-callback') && url.includes('code=') && !url.includes('access_token=')) {
          const code = new URL(url).searchParams.get('code');
          if (code) handleGoogleCode(code);
          return;
        }
        // Google OAuth legacy implicit flow: token in hash (calendar accounts)
        if (!url.includes('access_token=')) return;
        const hash = url.includes('#') ? url.slice(url.indexOf('#')) : '';
        const parsed = parseTokenFromHash(hash);
        if (parsed) handleToken(parsed.token, parsed.expiry);
      });
      // Sync when app comes back to foreground on Android
      let lastAppSync = 0;
      let lastHCSync = 0;
      const HC_SYNC_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours

      const stateListenerPromise = CapApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) return;
        const { isTokenValid: valid, accessToken: tok } = useSyncStore.getState();
        if (!tok) return; // no token at all — skip
        if (Date.now() - lastAppSync < 5_000) return;
        lastAppSync = Date.now();
        syncNow(); // handles silent refresh internally if token is expired
        if (valid()) {
          fetchCalendar();
          const now = new Date();
          const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
          fetchAllEvents(start, end, tok);
        }
        // Auto HC sync in background if enough time has passed
        if (Date.now() - lastHCSync > HC_SYNC_INTERVAL) {
          lastHCSync = Date.now();
          runHCSync().catch(() => {});
        }
      });

      // Normal startup sync — call even if token is expired so silent refresh can run
      const { isTokenValid, accessToken } = useSyncStore.getState();
      if (accessToken) {
        lastAppSync = Date.now();
        syncNow();
        if (isTokenValid()) {
          fetchCalendar();
          const now = new Date();
          const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
          fetchAllEvents(start, end, accessToken);
        }
      }
      // Auto HC sync on startup (silent)
      lastHCSync = Date.now();
      runHCSync().catch(() => {});
      return () => {
        listenerPromise.then(l => l.remove());
        stateListenerPromise.then(l => l.remove());
      };
    } else {
      // On web: Spotify PKCE code arrives in query string ?code=XXX
      const searchParams = new URLSearchParams(window.location.search);
      const spotifyCode = searchParams.get('code');
      if (spotifyCode && window.location.pathname.includes('spotify-callback')) {
        window.history.replaceState(null, '', window.location.pathname + '#/');
        exchangeSpotifyCode(spotifyCode).then(r => { if (r) handleSpotifyToken(r.token, r.expiry, r.refreshToken); });
        return;
      }
      // On web: Google auth code arrives in query string
      const googleCode = new URLSearchParams(window.location.search).get('code');
      if (googleCode && !window.location.search.includes('spotify')) {
        window.history.replaceState(null, '', window.location.pathname + '#/');
        handleGoogleCode(googleCode);
        return;
      }
      // On web: Google token in hash (calendar implicit flow)
      const hash = window.location.hash;
      if (hash.includes('access_token=') && !hash.startsWith('#/')) {
        const parsed = parseTokenFromHash(hash);
        if (parsed) {
          window.history.replaceState(null, '', window.location.pathname + '#/');
          handleToken(parsed.token, parsed.expiry);
        }
        return;
      }
      // Normal startup sync — call even if token is expired so silent refresh can run
      const { isTokenValid, accessToken } = useSyncStore.getState();
      if (accessToken) {
        syncNow();
        if (isTokenValid()) {
          fetchCalendar();
          const now = new Date();
          const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
          fetchAllEvents(start, end, accessToken);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Proactively refresh token 5 minutes before it expires
  useEffect(() => {
    const id = setInterval(async () => {
      const { accessToken, tokenExpiry, refreshToken, silentRefresh } = useSyncStore.getState();
      if (!accessToken || !tokenExpiry || !refreshToken) return;
      if (Date.now() > tokenExpiry - 5 * 60 * 1000) {
        await silentRefresh();
      }
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Auto-sync when user switches back to this tab/window (cross-device refresh)
  useEffect(() => {
    let lastSync = Date.now();

    function handleVisibility() {
      const { isTokenValid, accessToken } = useSyncStore.getState();
      if (!isTokenValid()) return;
      // Push to Drive when going to background so other devices see latest data
      if (document.visibilityState === 'hidden') {
        syncNow();
        return;
      }
      if (document.visibilityState !== 'visible') return;
      // Only re-sync if it's been at least 5 seconds since last sync
      if (Date.now() - lastSync < 5_000) return;
      lastSync = Date.now();
      syncNow();
      fetchCalendar();
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
      fetchAllEvents(start, end, accessToken);
    }

    document.addEventListener('visibilitychange', handleVisibility);

    // Push to Drive every 30 seconds while the app is open, so cross-device changes
    // are picked up quickly without waiting for a tab-hide event.
    const periodicPush = setInterval(() => {
      const { isTokenValid } = useSyncStore.getState();
      if (isTokenValid() && document.visibilityState === 'visible') syncNow();
    }, 30 * 1000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(periodicPush);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mark data as dirty whenever any user-data store changes, so syncNow() pushes
  // instead of pulling and accidentally overwriting local changes.
  useEffect(() => {
    const stores = [
      useTasksStore, useNotesStore, useHabitsStore, useFinanceStore,
      useHealthStore, useHobbyStore, useFitnessStore, useBooksStore,
      useGymStore, useGoalsStore,
    ] as const;
    const unsubs = stores.map(store => store.subscribe(() => markLocalDirty()));
    return () => unsubs.forEach(fn => fn());
  }, []);

  // When Drive data is newer and applied to localStorage, rehydrate all stores.
  // Suppress dirty marking during rehydrate so we don't immediately re-dirty
  // the data we just downloaded.
  useEffect(() => {
    if (!needsReload) return;
    setSuppressDirtyMark(true);
    clearLocalDirty();
    clearNeedsReload();
    useTasksStore.persist.rehydrate();
    useNotesStore.persist.rehydrate();
    useHabitsStore.persist.rehydrate();
    useFinanceStore.persist.rehydrate();
    useHealthStore.persist.rehydrate();
    useCalendarStore.persist.rehydrate();
    useHobbyStore.persist.rehydrate();
    useFitnessStore.persist.rehydrate();
    useBooksStore.persist.rehydrate();
    useSprintStore.persist.rehydrate();
    useGymStore.persist.rehydrate();
    useGoalsStore.persist.rehydrate();
    // Allow dirty marking again after stores have settled
    setTimeout(() => setSuppressDirtyMark(false), 1000);
  }, [needsReload, clearNeedsReload]);

  return null;
}

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem('basil-onboarded'),
  );

  function handleOnboardingDone() {
    localStorage.setItem('basil-onboarded', '1');
    setShowOnboarding(false);
  }

  return (
    <HashRouter>
      {showOnboarding && <Onboarding onDone={handleOnboardingDone} />}
      <OAuthHandler />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/tasks/:id" element={<TaskDetail />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/habits" element={<Habits />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/health" element={<Health />} />
          <Route path="/hobbies" element={<Hobbies />} />
          <Route path="/hobbies/movies" element={<Movies />} />
          <Route path="/hobbies/music" element={<Music />} />
          <Route path="/hobbies/drawing" element={<Drawing />} />
          <Route path="/hobbies/fitness" element={<Fitness />} />
          <Route path="/hobbies/books" element={<Books />} />
          <Route path="/hobbies/gym" element={<Gym />} />
          <Route path="/hobbies/travel" element={<Travel />} />
          <Route path="/digest" element={<WeeklyDigest />} />
          <Route path="/yearly" element={<YearlyReview />} />
          <Route path="/goals" element={<Goals />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
