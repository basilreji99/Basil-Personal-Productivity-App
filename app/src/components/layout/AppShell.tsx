import { useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import { useSyncStore } from '../../store/syncStore';

const PULL_THRESHOLD = 72; // px to drag before triggering refresh

export default function AppShell() {
  const syncNow = useSyncStore((s) => s.syncNow);
  const syncStatus = useSyncStore((s) => s.syncStatus);

  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
      if (delta <= 0) { setPullDistance(0); return; }
      // Resist the pull (rubber-band feel)
      setPullDistance(Math.min(delta * 0.4, PULL_THRESHOLD + 16));
      if (delta > 10) e.preventDefault();
    }

    function onTouchEnd() {
      if (pullDistance >= PULL_THRESHOLD && !refreshing) {
        setRefreshing(true);
        const { isTokenValid } = useSyncStore.getState();
        if (isTokenValid()) {
          syncNow().finally(() => {
            setRefreshing(false);
          });
        } else {
          setRefreshing(false);
        }
      }
      startY.current = null;
      setPullDistance(0);
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pullDistance, refreshing]);

  const isActive = refreshing || syncStatus === 'syncing';
  const indicatorVisible = pullDistance > 8 || isActive;
  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);

  return (
    <div className="flex flex-col min-h-dvh bg-background">
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
        style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}
      >
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
