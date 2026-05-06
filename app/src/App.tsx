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
import { useFitnessStore } from './store/fitnessStore';
import { parseTokenFromHash } from './services/googleAuth';
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

function OAuthHandler() {
  const navigate = useNavigate();
  const { setToken, syncNow, fetchCalendar, needsReload, clearNeedsReload } = useSyncStore();
  const { addAccount, fetchAllEvents } = useCalendarStore();

  function handleSpotifyToken(token: string, expiry: number, refreshToken?: string) {
    useHobbyStore.getState().setSpotifyToken(token, expiry, refreshToken);
    navigate('/hobbies/music', { replace: true });
  }

  function handleToken(token: string, expiry: number) {
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
      setToken(token, expiry).then(() => {
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
        // Google OAuth: token in hash
        if (!url.includes('access_token=')) return;
        const hash = url.includes('#') ? url.slice(url.indexOf('#')) : '';
        const parsed = parseTokenFromHash(hash);
        if (parsed) handleToken(parsed.token, parsed.expiry);
      });
      // Sync when app comes back to foreground on Android
      let lastAppSync = 0;
      const stateListenerPromise = CapApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) return;
        const { isTokenValid: valid, accessToken: tok } = useSyncStore.getState();
        if (!valid()) return;
        if (Date.now() - lastAppSync < 5_000) return;
        lastAppSync = Date.now();
        syncNow();
        fetchCalendar();
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
        fetchAllEvents(start, end, tok);
      });

      // Normal startup sync
      const { isTokenValid, accessToken } = useSyncStore.getState();
      if (isTokenValid()) {
        lastAppSync = Date.now();
        syncNow();
        fetchCalendar();
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
        fetchAllEvents(start, end, accessToken);
      }
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
      // On web: Google token arrives in the URL hash after redirect
      const hash = window.location.hash;
      if (hash.includes('access_token=') && !hash.startsWith('#/')) {
        const parsed = parseTokenFromHash(hash);
        if (parsed) {
          window.history.replaceState(null, '', window.location.pathname + '#/');
          handleToken(parsed.token, parsed.expiry);
        }
        return;
      }
      // Normal startup sync
      const { isTokenValid, accessToken } = useSyncStore.getState();
      if (isTokenValid()) {
        syncNow();
        fetchCalendar();
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
        fetchAllEvents(start, end, accessToken);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      useHealthStore, useHobbyStore, useFitnessStore,
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
    useSprintStore.persist.rehydrate();
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
        </Route>
      </Routes>
    </HashRouter>
  );
}
