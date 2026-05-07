import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from '../utils/nanoid';
import type { MediaReview, WatchlistItem, Artwork } from '../types';
import { refreshSpotifyToken } from '../services/spotifyAuth';

function art(
  id: string,
  title: string,
  section: Artwork['section'],
  medium: string,
  date: string,
  file: string,
  mediaType: 'image' | 'video' = 'image',
): Artwork {
  return { id, title, section, medium, date, image: file, mediaType, notes: '', createdAt: `${date}T00:00:00.000Z` };
}

const INITIAL_ARTWORKS: Artwork[] = [
  // ── Glass Paint ──────────────────────────────────────────────────────────────
  art('art-gp-1', 'Glass Paint #1', 'Glass Paint', 'Glass Paint', '2019-02-22', '/paintings/glass-paint/IMG_20190222_053943.jpg'),
  art('art-gp-2', 'Glass Paint #2', 'Glass Paint', 'Glass Paint', '2019-02-23', '/paintings/glass-paint/IMG_20190223_043001.jpg'),
  art('art-gp-3', 'Glass Paint #3', 'Glass Paint', 'Glass Paint', '2019-02-24', '/paintings/glass-paint/IMG_20190224_163311.jpg'),
  art('art-gp-4', 'Glass Paint #4', 'Glass Paint', 'Glass Paint', '2019-02-24', '/paintings/glass-paint/IMG_20190224_163519.jpg'),
  art('art-gp-5', 'Glass Paint #5', 'Glass Paint', 'Glass Paint', '2019-02-24', '/paintings/glass-paint/IMG_20190224_163540.jpg'),
  art('art-gp-6', 'Glass Paint #6', 'Glass Paint', 'Glass Paint', '2019-02-24', '/paintings/glass-paint/IMG_20190224_164035.jpg'),
  art('art-gp-7', 'Glass Paint #7', 'Glass Paint', 'Glass Paint', '2019-02-24', '/paintings/glass-paint/IMG_20190224_164100.jpg'),
  art('art-gp-8', 'Glass Paint #8', 'Glass Paint', 'Glass Paint', '2019-02-24', '/paintings/glass-paint/IMG_20190224_164110.jpg'),
  art('art-gp-9', 'Glass Paint #9', 'Glass Paint', 'Glass Paint', '2019-02-24', '/paintings/glass-paint/IMG_20190224_164143.jpg'),
  // ── Drawing & Painting ───────────────────────────────────────────────────────
  art('art-dp-1', 'Drawing #1',  'Drawing & Painting', 'Mixed Media', '2019-03-14', '/paintings/drawing/IMG_20190314_233836.jpg'),
  art('art-dp-2', 'Drawing #2',  'Drawing & Painting', 'Mixed Media', '2019-03-15', '/paintings/drawing/IMG_20190315_222135.jpg'),
  art('art-dp-3', 'Drawing #3',  'Drawing & Painting', 'Mixed Media', '2019-03-16', '/paintings/drawing/IMG_20190316_044206.jpg'),
  art('art-dp-4', 'Drawing #4',  'Drawing & Painting', 'Mixed Media', '2019-03-17', '/paintings/drawing/IMG_20190317_154542.jpg'),
  art('art-dp-5', 'Drawing #5',  'Drawing & Painting', 'Mixed Media', '2023-04-17', '/paintings/drawing/20230417_220321.jpg'),
  art('art-dp-6', 'Drawing #6',  'Drawing & Painting', 'Mixed Media', '2023-04-17', '/paintings/drawing/20230417_220659.jpg'),
  // ── Crafts ───────────────────────────────────────────────────────────────────
  art('art-cr-1',  'Craft #1',        'Crafts', 'Crafts', '2023-04-04', '/paintings/crafts/20230404_222820.jpg'),
  art('art-cr-2',  'Craft #2',        'Crafts', 'Crafts', '2023-04-13', '/paintings/crafts/20230413_144613.jpg'),
  art('art-cr-3',  'Craft #3',        'Crafts', 'Crafts', '2023-04-17', '/paintings/crafts/20230417_181613.jpg'),
  art('art-cr-4',  'Craft #4',        'Crafts', 'Crafts', '2023-04-19', '/paintings/crafts/20230419_210759.jpg'),
  art('art-cr-5',  'Craft #5',        'Crafts', 'Crafts', '2023-04-19', '/paintings/crafts/20230419_210800.jpg'),
  art('art-cr-6',  'Craft #6',        'Crafts', 'Crafts', '2023-04-19', '/paintings/crafts/20230419_221554.jpg'),
  art('art-cr-7',  'Craft #7',        'Crafts', 'Crafts', '2023-04-19', '/paintings/crafts/20230419_221622.jpg'),
  art('art-cr-8',  'Craft #8',        'Crafts', 'Crafts', '2023-11-02', '/paintings/crafts/20231102_224346.jpg'),
  art('art-cr-9',  'Craft #9',        'Crafts', 'Crafts', '2023-11-02', '/paintings/crafts/20231102_224350.jpg'),
  art('art-cr-10', 'Craft #10',       'Crafts', 'Crafts', '2023-11-02', '/paintings/crafts/20231102_224355.jpg'),
  art('art-cr-11', 'Craft #11',       'Crafts', 'Crafts', '2023-11-02', '/paintings/crafts/20231102_224411.jpg'),
  art('art-cr-12', 'Craft #12',       'Crafts', 'Crafts', '2023-11-02', '/paintings/crafts/20231102_224733.jpg'),
  art('art-cv-1',  'Craft Video #1',  'Crafts', 'Crafts', '2023-04-04', '/paintings/crafts/20230404_223211.mp4',  'video'),
  art('art-cv-2',  'Craft Video #2',  'Crafts', 'Crafts', '2023-04-18', '/paintings/crafts/20230418_002151.mp4',  'video'),
  art('art-cv-3',  'Craft Video #3',  'Crafts', 'Crafts', '2023-04-19', '/paintings/crafts/20230419_220159.mp4',  'video'),
  art('art-cv-4',  'Craft Video #4',  'Crafts', 'Crafts', '2023-07-16', '/paintings/crafts/20230716_000738.mp4',  'video'),
  art('art-cv-5',  'Craft Video #5',  'Crafts', 'Crafts', '2023-07-23', '/paintings/crafts/20230723_190450.mp4',  'video'),
  art('art-cv-6',  'Craft Video #6',  'Crafts', 'Crafts', '2023-11-02', '/paintings/crafts/20231102_224445.mp4',  'video'),
  art('art-cv-7',  'Craft Video #7',  'Crafts', 'Crafts', '2023-11-02', '/paintings/crafts/20231102_224736.mp4',  'video'),
];

interface HobbyState {
  reviews: MediaReview[];
  watchlist: WatchlistItem[];
  artworks: Artwork[];
  spotifyToken: string | null;
  spotifyExpiry: number | null;
  spotifyRefreshToken: string | null;

  // Reviews
  addReview: (r: Omit<MediaReview, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateReview: (id: string, updates: Partial<Omit<MediaReview, 'id' | 'createdAt'>>) => void;
  deleteReview: (id: string) => void;

  // Watchlist
  addWatchlistItem: (item: Omit<WatchlistItem, 'id' | 'addedAt'>) => void;
  updateWatchlistItem: (id: string, updates: Partial<Omit<WatchlistItem, 'id' | 'addedAt'>>) => void;
  deleteWatchlistItem: (id: string) => void;
  moveToReview: (id: string, rating: number, review: string, status: 'watched' | 'watching' | 'dropped', watchedDate?: string) => void;

  // Artworks
  addArtwork: (a: Omit<Artwork, 'id' | 'createdAt'>) => void;
  updateArtwork: (id: string, updates: Partial<Omit<Artwork, 'id' | 'createdAt'>>) => void;
  deleteArtwork: (id: string) => void;

  // Spotify
  setSpotifyToken: (token: string, expiry: number, refreshToken?: string) => void;
  clearSpotifyToken: () => void;
  isSpotifyValid: () => boolean;
  ensureSpotifyToken: () => Promise<string | null>;
}

export const useHobbyStore = create<HobbyState>()(
  persist(
    (set, get) => ({
      reviews: [],
      watchlist: [],
      artworks: [],
      spotifyToken: null,
      spotifyExpiry: null,
      spotifyRefreshToken: null,

      addReview: (r) => {
        const now = new Date().toISOString();
        set(s => ({ reviews: [{ ...r, id: nanoid(), createdAt: now, updatedAt: now }, ...s.reviews] }));
      },

      updateReview: (id, updates) => {
        const now = new Date().toISOString();
        set(s => ({
          reviews: s.reviews.map(r => r.id === id ? { ...r, ...updates, updatedAt: now } : r),
        }));
      },

      deleteReview: (id) =>
        set(s => ({ reviews: s.reviews.filter(r => r.id !== id) })),

      addWatchlistItem: (item) => {
        const now = new Date().toISOString();
        set(s => ({ watchlist: [{ ...item, id: nanoid(), addedAt: now }, ...s.watchlist] }));
      },

      updateWatchlistItem: (id, updates) =>
        set(s => ({
          watchlist: s.watchlist.map(w => w.id === id ? { ...w, ...updates } : w),
        })),

      deleteWatchlistItem: (id) =>
        set(s => ({ watchlist: s.watchlist.filter(w => w.id !== id) })),

      moveToReview: (id, rating, review, status, watchedDate) => {
        const item = get().watchlist.find(w => w.id === id);
        if (!item) return;
        const now = new Date().toISOString();
        const newReview: MediaReview = {
          id: nanoid(),
          title: item.title,
          type: item.type,
          status,
          rating,
          review,
          images: [],
          genres: item.genres,
          watchedDate,
          createdAt: now,
          updatedAt: now,
        };
        set(s => ({
          watchlist: s.watchlist.filter(w => w.id !== id),
          reviews: [newReview, ...s.reviews],
        }));
      },

      addArtwork: (a) => {
        const now = new Date().toISOString();
        set(s => ({ artworks: [{ ...a, id: nanoid(), createdAt: now }, ...s.artworks] }));
      },

      updateArtwork: (id, updates) =>
        set(s => ({
          artworks: s.artworks.map(a => a.id === id ? { ...a, ...updates } : a),
        })),

      deleteArtwork: (id) =>
        set(s => ({ artworks: s.artworks.filter(a => a.id !== id) })),

      setSpotifyToken: (token, expiry, refreshToken) =>
        set({ spotifyToken: token, spotifyExpiry: expiry, ...(refreshToken ? { spotifyRefreshToken: refreshToken } : {}) }),

      clearSpotifyToken: () =>
        set({ spotifyToken: null, spotifyExpiry: null, spotifyRefreshToken: null }),

      isSpotifyValid: () => {
        const { spotifyToken, spotifyExpiry } = get();
        return !!spotifyToken && !!spotifyExpiry && Date.now() < spotifyExpiry;
      },

      ensureSpotifyToken: async () => {
        const { spotifyToken, spotifyExpiry, spotifyRefreshToken } = get();
        // Token still valid with 60s buffer
        if (spotifyToken && spotifyExpiry && Date.now() < spotifyExpiry - 60_000) {
          return spotifyToken;
        }
        if (spotifyRefreshToken) {
          try {
            const result = await refreshSpotifyToken(spotifyRefreshToken);
            if (result) {
              // Success — store new token (keep old refresh token if Spotify didn't rotate it)
              set({
                spotifyToken: result.token,
                spotifyExpiry: result.expiry,
                ...(result.refreshToken ? { spotifyRefreshToken: result.refreshToken } : {}),
              });
              return result.token;
            }
            // null = 400/401: refresh token is definitively revoked → force re-auth
            set({ spotifyToken: null, spotifyExpiry: null, spotifyRefreshToken: null });
            return null;
          } catch {
            // Network / server error — keep the refresh token so we can retry later.
            // Return the slightly-expired token within a 5-minute grace window so
            // an offline blip doesn't immediately boot the user out.
            if (spotifyToken && spotifyExpiry && Date.now() < spotifyExpiry + 5 * 60_000) {
              return spotifyToken;
            }
            return null;
          }
        }
        // No refresh token at all
        set({ spotifyToken: null, spotifyExpiry: null });
        return null;
      },
    }),
    {
      name: 'basil-hobbies',
      version: 1,
      migrate(persisted: unknown, version: number) {
        const s = persisted as { artworks?: Artwork[] } | null;
        if (version < 1) {
          const existing = s?.artworks ?? [];
          const hasSeeded = existing.some((a) => a.id === 'art-gp-1');
          return { ...(s ?? {}), artworks: hasSeeded ? existing : [...INITIAL_ARTWORKS, ...existing] };
        }
        return s;
      },
    },
  ),
);
