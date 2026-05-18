import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TagState {
  usage: Record<string, number>;
  pinned: string[];

  recordUsage: (tags: string[]) => void;
  pin: (tag: string) => void;
  unpin: (tag: string) => void;
  remove: (tag: string) => void;
  getSuggestions: (existing: string[], prefix?: string, limit?: number) => string[];
  getFilterTags: () => string[];
}

export const useTagStore = create<TagState>()(
  persist(
    (set, get) => ({
      usage: {},
      pinned: [],

      recordUsage: (tags) =>
        set((s) => {
          const usage = { ...s.usage };
          tags.forEach((t) => { usage[t] = (usage[t] ?? 0) + 1; });
          return { usage };
        }),

      pin: (tag) =>
        set((s) => ({
          pinned: s.pinned.includes(tag) ? s.pinned : [...s.pinned, tag],
          usage: { ...s.usage, [tag]: s.usage[tag] ?? 0 },
        })),

      unpin: (tag) =>
        set((s) => ({ pinned: s.pinned.filter((t) => t !== tag) })),

      remove: (tag) =>
        set((s) => {
          const usage = { ...s.usage };
          delete usage[tag];
          return { usage, pinned: s.pinned.filter((t) => t !== tag) };
        }),

      getSuggestions: (existing, prefix = '', limit = 5) => {
        const { usage } = get();
        return Object.entries(usage)
          .filter(([t]) => !existing.includes(t) && t.toLowerCase().includes(prefix.toLowerCase()))
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([t]) => t);
      },

      getFilterTags: () => {
        const { usage, pinned } = get();
        if (pinned.length > 0) return pinned;
        return Object.entries(usage)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([t]) => t);
      },
    }),
    { name: 'basil-tags' },
  ),
);
