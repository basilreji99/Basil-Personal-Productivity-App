import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { buildAuthCodeUrl, fetchGoogleProfile, openAuthUrl, refreshAccessToken } from '../services/googleAuth';
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
  clientSecret: string;
  accessToken: string | null;
  tokenExpiry: number | null;
  refreshToken: string | null;
  profile: GoogleProfile | null;
  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
  calendarEvents: CalendarEvent[];
  upcomingEvents: CalendarEvent[];
  needsReload: boolean;

  setClientId: (id: string) => void;
  setClientSecret: (secret: string) => void;
  setToken: (token: string, expiry: number, refreshToken?: string | null) => Promise<void>;
  clearAuth: () => void;
  isTokenValid: () => boolean;
  startAuth: () => Promise<void>;
  silentRefresh: () => Promise<boolean>;

  syncNow: () => Promise<void>;
  fetchCalendar: () => Promise<void>;
  clearNeedsReload: () => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      clientId: '',
      clientSecret: '',
      accessToken: null,
      tokenExpiry: null,
      refreshToken: null,
      profile: null,
      syncStatus: 'idle',
      lastSyncedAt: null,
      calendarEvents: [],
      upcomingEvents: [],
      needsReload: false,

      setClientId: (clientId) => set({ clientId }),
      setClientSecret: (clientSecret) => set({ clientSecret }),

      setToken: async (accessToken, tokenExpiry, refreshToken) => {
        try {
          const update: Partial<SyncState> = { accessToken, tokenExpiry };
          if (refreshToken !== undefined) update.refreshToken = refreshToken;
          set(update);
          const profile = await fetchGoogleProfile(accessToken);
          set({ profile });
        } catch {
          set({ accessToken: null, tokenExpiry: null, profile: null });
        }
      },

      clearAuth: () =>
        set({
          accessToken: null,
          tokenExpiry: null,
          refreshToken: null,
          profile: null,
          syncStatus: 'idle',
          calendarEvents: [],
          upcomingEvents: [],
        }),

      isTokenValid: () => {
        const { accessToken, tokenExpiry } = get();
        return !!accessToken && !!tokenExpiry && Date.now() < tokenExpiry;
      },

      silentRefresh: async () => {
        const { refreshToken, clientId, clientSecret } = get();
        if (!refreshToken || !clientId.trim()) return false;
        const result = await refreshAccessToken(refreshToken, clientId, clientSecret);
        if (!result) return false;
        set({ accessToken: result.accessToken, tokenExpiry: result.expiry });
        return true;
      },

      startAuth: async () => {
        const { clientId } = get();
        if (!clientId.trim()) return;
        const url = await buildAuthCodeUrl(clientId.trim());
        openAuthUrl(url);
      },

      syncNow: async () => {
        const { isTokenValid, silentRefresh } = get();
        if (!isTokenValid()) {
          const refreshed = await silentRefresh();
          if (!refreshed) { set({ syncStatus: 'error' }); return; }
        }
        const { accessToken } = get();
        if (!accessToken) { set({ syncStatus: 'error' }); return; }

        if (!navigator.onLine) {
          set({ syncStatus: 'offline' });
          return;
        }

        set({ syncStatus: 'syncing' });
        try {
          if (isLocalDirty()) {
            const uploadedTs = await uploadBackup(accessToken);
            if (uploadedTs === null) { set({ syncStatus: 'error' }); return; }
            clearLocalDirty();
            setLocalSyncedAt(uploadedTs);
          }

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
        const { isTokenValid, silentRefresh } = get();
        if (!isTokenValid()) {
          const refreshed = await silentRefresh();
          if (!refreshed) return;
        }
        const { accessToken } = get();
        if (!accessToken || !navigator.onLine) return;
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
        clientSecret: s.clientSecret,
        accessToken: s.accessToken,
        tokenExpiry: s.tokenExpiry,
        refreshToken: s.refreshToken,
        profile: s.profile,
        lastSyncedAt: s.lastSyncedAt,
        calendarEvents: s.calendarEvents,
        upcomingEvents: s.upcomingEvents,
      }),
    },
  ),
);
