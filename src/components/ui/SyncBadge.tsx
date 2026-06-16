import { useState, useEffect } from 'react';
import { useSyncStore } from '../../store/syncStore';
import { isLocalDirty } from '../../services/driveSync';

export default function SyncBadge() {
  const syncStatus = useSyncStore((s) => s.syncStatus);
  const accessToken = useSyncStore((s) => s.accessToken);
  const tokenExpiry = useSyncStore((s) => s.tokenExpiry);
  const syncNow = useSyncStore((s) => s.syncNow);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const check = () => setDirty(isLocalDirty());
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, [syncStatus]);

  if (!dirty) return null;
  const isSignedIn = !!accessToken && !!tokenExpiry && Date.now() < tokenExpiry;

  if (syncStatus === 'syncing') {
    return (
      <span className="flex items-center gap-1 font-inter text-[10px] text-primary shrink-0">
        <span className="material-symbols-outlined text-[12px] animate-spin">sync</span>
        Syncing…
      </span>
    );
  }
  if (!isSignedIn) {
    return (
      <span className="flex items-center gap-1 font-inter text-[10px] text-outline shrink-0" title="Sign in to sync changes">
        <span className="material-symbols-outlined text-[12px]">cloud_off</span>
        Local only
      </span>
    );
  }
  if (!navigator.onLine) {
    return (
      <span
        className="flex items-center gap-1 font-inter text-[10px] text-amber-600 dark:text-amber-400 shrink-0"
        title="Changes saved locally, will sync when online"
      >
        <span className="material-symbols-outlined text-[12px]">wifi_off</span>
        Offline
      </span>
    );
  }
  return (
    <button
      onClick={syncNow}
      className="flex items-center gap-1 font-inter text-[10px] text-outline hover:text-primary shrink-0 transition-colors"
      title="Tap to sync"
    >
      <span className="material-symbols-outlined text-[12px]">sync</span>
      Pending sync
    </button>
  );
}
