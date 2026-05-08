import { useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import { useSyncStore } from '../../store/syncStore';
import { useHobbyStore } from '../../store/hobbyStore';
import { openSpotifyAuth } from '../../services/spotifyAuth';
import { useThemeStore } from '../../store/themeStore';

const PULL_THRESHOLD = 72;

export default function AppShell() {
  const syncNow = useSyncStore((s) => s.syncNow);
  const syncStatus = useSyncStore((s) => s.syncStatus);
  const startAuth = useSyncStore((s) => s.startAuth);
  const profile = useSyncStore((s) => s.profile);
  const isTokenValid = useSyncStore((s) => s.isTokenValid);
  const { mode, resolvedDark } = useThemeStore();
  const [sessionExpired, setSessionExpired] = useState(false);
  const spotifyToken = useHobbyStore((s) => s.spotifyToken);
  const isSpotifyValid = useHobbyStore((s) => s.isSpotifyValid);
  const [spotifyExpired, setSpotifyExpired] = useState(false);

  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const startY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Suppress Android WebView long-press context menu (shows app logo overlay)
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', prevent);
    return () => document.removeEventListener('contextmenu', prevent);
  }, []);

  // Apply dark class to <html>
  useEffect(() => {
    const applyTheme = () => {
      document.documentElement.classList.toggle('dark', resolvedDark());
    };
    applyTheme();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', applyTheme);
    return () => mq.removeEventListener('change', applyTheme);
  }, [mode]);

  // Track online/offline status
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Detect when Google or Spotify session expires mid-use
  useEffect(() => {
    const check = () => {
      setSessionExpired(!!profile && !isTokenValid());
      setSpotifyExpired(!!spotifyToken && !isSpotifyValid());
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [profile, isTokenValid, spotifyToken, isSpotifyValid]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      if (el!.scrollTop > 0) return;
      startY.current = e.touches[0].clientY;
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) { setPullDistance(0); pullDistanceRef.current = 0; return; }
      const d = Math.min(delta * 0.4, PULL_THRESHOLD + 16);
      setPullDistance(d);
      pullDistanceRef.current = d;
      if (delta > 10) e.preventDefault();
    }

    function onTouchEnd() {
      if (pullDistanceRef.current >= PULL_THRESHOLD && !refreshingRef.current) {
        setRefreshing(true);
        refreshingRef.current = true;
        const { isTokenValid } = useSyncStore.getState();
        if (isTokenValid()) {
          syncNow().finally(() => { setRefreshing(false); refreshingRef.current = false; });
        } else {
          setRefreshing(false);
          refreshingRef.current = false;
        }
      }
      startY.current = null;
      setPullDistance(0);
      pullDistanceRef.current = 0;
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [syncNow]);

  const isActive = refreshing || syncStatus === 'syncing';
  const indicatorVisible = pullDistance > 8 || isActive;
  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      {/* Offline banner */}
      {!isOnline && (
        <div className="flex items-center justify-center gap-2 bg-amber-500 text-white px-4 py-2 text-xs font-inter font-semibold z-50">
          <span className="material-symbols-outlined text-[14px]">wifi_off</span>
          You're offline — changes will sync when reconnected
        </div>
      )}

      {/* Session expired banners */}
      {sessionExpired && (
        <button
          onClick={startAuth}
          className="flex w-full items-center justify-center gap-2 bg-amber-500 text-white px-4 py-2 text-xs font-inter font-semibold z-50"
        >
          <span className="material-symbols-outlined text-[14px]">lock_clock</span>
          Google session expired — tap to reconnect
        </button>
      )}
      {spotifyExpired && (
        <button
          onClick={openSpotifyAuth}
          className="flex w-full items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 text-xs font-inter font-semibold z-50"
        >
          <span className="material-symbols-outlined text-[14px]">music_note</span>
          Spotify session expired — tap to reconnect
        </button>
      )}

      {/* Sync error banner */}
      {isOnline && !sessionExpired && syncStatus === 'error' && (
        <button
          onClick={() => syncNow()}
          className="flex w-full items-center justify-center gap-2 bg-error/90 text-on-error px-4 py-1.5 text-xs font-inter font-medium z-50"
        >
          <span className="material-symbols-outlined text-[14px]">sync_problem</span>
          Sync failed — tap to retry
        </button>
      )}

      {/* Pull-to-refresh indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{ height: isActive ? 40 : indicatorVisible ? pullDistance : 0 }}
      >
        <span
          className={`material-symbols-outlined text-primary text-xl ${isActive ? 'animate-spin' : ''}`}
          style={{ opacity: progress, transform: isActive ? undefined : `rotate(${progress * 360}deg)` }}
        >
          sync
        </span>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: 'calc(96px + max(env(safe-area-inset-bottom, 0px), 10px))' }}
      >
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
