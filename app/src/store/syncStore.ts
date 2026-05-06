import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { buildAuthUrl, fetchGoogleProfile, openAuthUrl } from '../services/googleAuth';
import {
  uploadBackup, downloadBackup, applyBackupToLocalStorage,
  getLocalSyncedAt, setLocalSyncedAt,
  isLocalDirty, clearLocalDirty,
} from '../services/driveSync';
import { getTodayEvents, getUpcomingEvents, type CalendarEvent } from '../services/calendarApi';

interface GoogleProfile {
  email: string;
  name: string;
  picture: string;
}

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

interface SyncState {
  clientId: string;
  accessToken: string | null;
  tokenExpiry: number | null;
  profile: GoogleProfile | null;
  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
  calendarEvents: CalendarEvent[];
  upcomingEvents: CalendarEvent[];
  needsReload: boolean;

  setClientId: (id: string) => void;
  setToken: (token: string, expiry: number) => Promise<void>;
  clearAuth: () => void;
  isTokenValid: () => boolean;
  startAuth: () => void;

  syncNow: () => Promise<void>;
  fetchCalendar: () => Promise<void>;
  clearNeedsReload: () => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      clientId: '',
      accessToken: null,
      tokenExpiry: null,
      profile: null,
      syncStatus: 'idle',
      lastSyncedAt: null,
      calendarEvents: [],
      upcomingEvents: [],
      needsReload: false,

      setClientId: (clientId) => set({ clientId }),

      setToken: async (accessToken, tokenExpiry) => {
        set({ accessToken, tokenExpiry });
        const profile = await fetchGoogleProfile(accessToken);
        set({ profile });
      },

      clearAuth: () =>
        set({
          accessToken: null,
          tokenExpiry: null,
          profile: null,
          syncStatus: 'idle',
          calendarEvents: [],
          upcomingEvents: [],
        }),

      isTokenValid: () => {
        const { accessToken, tokenExpiry } = get();
        return !!accessToken && !!tokenExpiry && Date.now() < tokenExpiry;
      },

      startAuth: () => {
        const { clientId } = get();
        if (!clientId.trim()) return;
        openAuthUrl(buildAuthUrl(clientId.trim()));
      },

      syncNow: async () => {
        const { accessToken, isTokenValid } = get();
        if (!isTokenValid() || !accessToken) {
          set({ syncStatus: 'error' });
          return;
        }
        if (!navigator.onLine) {
          set({ syncStatus: 'offline' });
          return;
        }

        set({ syncStatus: 'syncing' });
        try {
          // Phase 1: push if this device has changes that Drive doesn't have yet.
          if (isLocalDirty()) {
            const uploadedTs = await uploadBackup(accessToken);
            if (uploadedTs === null) { set({ syncStatus: 'error' }); return; }
            clearLocalDirty();
            // Set localSyncedAt to the exact timestamp embedded in the backup so
            // that the phase-2 comparison doesn't falsely re-pull our own data.
            setLocalSyncedAt(uploadedTs);
          }

          // Phase 2: always download to check if another device pushed something
          // newer (handles laptop→phone and phone→laptop in the same pass).
          const localTs = getLocalSyncedAt();
          const driveBackup = await downloadBackup(accessToken);
          if (driveBackup && driveBackup._syncedAt > localTs) {
            applyBackupToLocalStorage(driveBackup);
            setLocalSyncedAt(driveBackup._syncedAt);
            set({ syncStatus: 'success', lastSyncedAt: driveBackup._syncedAt, needsReload: true });
          } else {
            set({ syncStatus: 'success', lastSyncedAt: localTs || get().lastSyncedAt });
          }
        } catch {
          set({ syncStatus: 'error' });
        }
      },

      fetchCalendar: async () => {
        const { accessToken, isTokenValid } = get();
        if (!isTokenValid() || !accessToken || !navigator.onLine) return;
        try {
          const [today, upcoming] = await Promise.all([
            getTodayEvents(accessToken),
            getUpcomingEvents(accessToken, 7),
          ]);
          set({ calendarEvents: today, upcomingEvents: upcoming });
        } catch {
          // silently fail — cached events stay
        }
      },

      clearNeedsReload: () => set({ needsReload: false }),
    }),
    {
      name: 'basil-sync',
      partialize: (s) => ({
        clientId: s.clientId,
        accessToken: s.accessToken,
        tokenExpiry: s.tokenExpiry,
        profile: s.profile,
        lastSyncedAt: s.lastSyncedAt,
        calendarEvents: s.calendarEvents,
        upcomingEvents: s.upcomingEvents,
      }),
    },
  ),
);
