import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from '../utils/nanoid';
import { getAllCalendarsEvents, type CalendarEvent, GOOGLE_COLOR_MAP } from '../services/calendarApi';
import { fetchGoogleProfile } from '../services/googleAuth';

export interface CalendarAccount {
  id: string;
  email: string;
  name: string;
  picture: string;
  accessToken: string;
  tokenExpiry: number;
}

export interface LocalEvent {
  id: string;
  title: string;
  date: string;       // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string;   // HH:MM
  isAllDay: boolean;
  location?: string;
  description?: string;
  color: string;      // hex
}

export interface UnifiedEvent {
  id: string;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  location?: string;
  color: string;
  source: 'google' | 'local';
  accountEmail?: string;
}

interface CalendarState {
  accounts: CalendarAccount[];
  localEvents: LocalEvent[];
  cachedGoogleEvents: CalendarEvent[];
  cachedRange: { start: string; end: string } | null;
  pendingAddAccount: boolean;
  isFetching: boolean;

  addAccount: (token: string, expiry: number) => Promise<void>;
  removeAccount: (id: string) => void;
  setPendingAddAccount: (v: boolean) => void;
  isAccountTokenValid: (account: CalendarAccount) => boolean;

  addLocalEvent: (e: Omit<LocalEvent, 'id'>) => void;
  updateLocalEvent: (id: string, updates: Partial<Omit<LocalEvent, 'id'>>) => void;
  deleteLocalEvent: (id: string) => void;

  fetchAllEvents: (start: string, end: string, primaryToken?: string | null) => Promise<void>;
  getEventsForDate: (date: string, primaryToken?: string | null) => UnifiedEvent[];
  getEventCountsByDate: (primaryToken?: string | null) => Record<string, UnifiedEvent[]>;
}

function googleEventColor(ev: CalendarEvent): string {
  return ev.colorId ? (GOOGLE_COLOR_MAP[ev.colorId] ?? '#4285f4') : '#4285f4';
}

function googleEventToUnified(ev: CalendarEvent, accountEmail?: string): UnifiedEvent {
  const isAllDay = ev.isAllDay;
  const date = isAllDay ? ev.start.slice(0, 10) : ev.start.slice(0, 10);
  const startTime = isAllDay ? undefined : ev.start.slice(11, 16);
  const endTime = isAllDay ? undefined : ev.end.slice(11, 16);
  return {
    id: ev.id,
    title: ev.summary,
    date,
    startTime,
    endTime,
    isAllDay,
    location: ev.location,
    color: googleEventColor(ev),
    source: 'google',
    accountEmail,
  };
}

function localEventToUnified(ev: LocalEvent): UnifiedEvent {
  return {
    id: ev.id,
    title: ev.title,
    date: ev.date,
    startTime: ev.startTime,
    endTime: ev.endTime,
    isAllDay: ev.isAllDay,
    location: ev.location,
    color: ev.color,
    source: 'local',
  };
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      accounts: [],
      localEvents: [],
      cachedGoogleEvents: [],
      cachedRange: null,
      pendingAddAccount: false,
      isFetching: false,

      addAccount: async (token, expiry) => {
        const profile = await fetchGoogleProfile(token);
        if (!profile) return;
        const existing = get().accounts.find(a => a.email === profile.email);
        if (existing) {
          set(s => ({
            accounts: s.accounts.map(a =>
              a.email === profile.email
                ? { ...a, accessToken: token, tokenExpiry: expiry }
                : a,
            ),
          }));
        } else {
          set(s => ({
            accounts: [
              ...s.accounts,
              {
                id: nanoid(),
                email: profile.email,
                name: profile.name,
                picture: profile.picture,
                accessToken: token,
                tokenExpiry: expiry,
              },
            ],
          }));
        }
      },

      removeAccount: (id) =>
        set(s => ({ accounts: s.accounts.filter(a => a.id !== id) })),

      setPendingAddAccount: (v) => set({ pendingAddAccount: v }),

      isAccountTokenValid: (account) =>
        !!account.accessToken && Date.now() < account.tokenExpiry,

      addLocalEvent: (e) =>
        set(s => ({ localEvents: [...s.localEvents, { ...e, id: nanoid() }] })),

      updateLocalEvent: (id, updates) =>
        set(s => ({
          localEvents: s.localEvents.map(e => e.id === id ? { ...e, ...updates } : e),
        })),

      deleteLocalEvent: (id) =>
        set(s => ({ localEvents: s.localEvents.filter(e => e.id !== id) })),

      fetchAllEvents: async (start, end, primaryToken) => {
        set({ isFetching: true });
        try {
          const tokens: string[] = [];
          if (primaryToken) tokens.push(primaryToken);
          const { accounts, isAccountTokenValid } = get();
          for (const acc of accounts) {
            if (isAccountTokenValid(acc) && !tokens.includes(acc.accessToken)) {
              tokens.push(acc.accessToken);
            }
          }

          const results = await Promise.all(
            tokens.map(tok => getAllCalendarsEvents(tok, start, end)),
          );

          const seen = new Set<string>();
          const merged: CalendarEvent[] = [];
          for (const events of results) {
            for (const ev of events) {
              if (!seen.has(ev.id)) {
                seen.add(ev.id);
                merged.push(ev);
              }
            }
          }
          merged.sort((a, b) => a.start.localeCompare(b.start));
          set({ cachedGoogleEvents: merged, cachedRange: { start, end } });
        } finally {
          set({ isFetching: false });
        }
      },

      getEventsForDate: (date) => {
        const { cachedGoogleEvents, localEvents } = get();
        const google = cachedGoogleEvents
          .filter(ev => {
            if (ev.isAllDay) {
              const s = ev.start.slice(0, 10);
              const e = ev.end.slice(0, 10);
              return s <= date && date < e;
            }
            return ev.start.slice(0, 10) === date;
          })
          .map(ev => googleEventToUnified(ev));
        const local = localEvents
          .filter(ev => ev.date === date)
          .map(localEventToUnified);
        return [...google, ...local].sort((a, b) => {
          if (a.isAllDay && !b.isAllDay) return -1;
          if (!a.isAllDay && b.isAllDay) return 1;
          return (a.startTime ?? '').localeCompare(b.startTime ?? '');
        });
      },

      getEventCountsByDate: () => {
        const { cachedGoogleEvents, localEvents } = get();
        const map: Record<string, UnifiedEvent[]> = {};
        for (const ev of cachedGoogleEvents) {
          const date = ev.isAllDay ? ev.start.slice(0, 10) : ev.start.slice(0, 10);
          if (!map[date]) map[date] = [];
          map[date].push(googleEventToUnified(ev));
        }
        for (const ev of localEvents) {
          if (!map[ev.date]) map[ev.date] = [];
          map[ev.date].push(localEventToUnified(ev));
        }
        return map;
      },
    }),
    {
      name: 'basil-calendar',
      partialize: (s) => ({
        accounts: s.accounts.map(a => ({ ...a })),
        localEvents: s.localEvents,
      }),
    },
  ),
);
