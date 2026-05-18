import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolvedDark: () => boolean;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      setMode: (mode) => set({ mode }),
      resolvedDark: () => {
        const { mode } = get();
        if (mode === 'dark') return true;
        if (mode === 'light') return false;
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      },
    }),
    { name: 'basil-theme' },
  ),
);
