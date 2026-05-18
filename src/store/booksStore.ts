import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from '../utils/nanoid';
import type { BookReview, ReadingListItem, ReadStatus } from '../types';

interface BooksState {
  reviews: BookReview[];
  readingList: ReadingListItem[];

  addReview: (r: Omit<BookReview, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateReview: (id: string, updates: Partial<Omit<BookReview, 'id' | 'createdAt'>>) => void;
  deleteReview: (id: string) => void;

  addToReadingList: (item: Omit<ReadingListItem, 'id' | 'addedAt'>) => void;
  updateReadingListItem: (id: string, updates: Partial<Omit<ReadingListItem, 'id' | 'addedAt'>>) => void;
  deleteReadingListItem: (id: string) => void;
  moveToReview: (id: string, rating: number, review: string, status: ReadStatus, dateRead?: string) => void;
}

export const useBooksStore = create<BooksState>()(
  persist(
    (set, get) => ({
      reviews: [],
      readingList: [],

      addReview: (r) => {
        const now = new Date().toISOString();
        set((s) => ({ reviews: [{ ...r, id: nanoid(), createdAt: now, updatedAt: now }, ...s.reviews] }));
      },

      updateReview: (id, updates) => {
        const now = new Date().toISOString();
        set((s) => ({
          reviews: s.reviews.map((r) => r.id === id ? { ...r, ...updates, updatedAt: now } : r),
        }));
      },

      deleteReview: (id) => set((s) => ({ reviews: s.reviews.filter((r) => r.id !== id) })),

      addToReadingList: (item) => {
        const now = new Date().toISOString();
        set((s) => ({ readingList: [{ ...item, id: nanoid(), addedAt: now }, ...s.readingList] }));
      },

      updateReadingListItem: (id, updates) =>
        set((s) => ({
          readingList: s.readingList.map((w) => w.id === id ? { ...w, ...updates } : w),
        })),

      deleteReadingListItem: (id) =>
        set((s) => ({ readingList: s.readingList.filter((w) => w.id !== id) })),

      moveToReview: (id, rating, review, status, dateRead) => {
        const item = get().readingList.find((w) => w.id === id);
        if (!item) return;
        const now = new Date().toISOString();
        const newReview: BookReview = {
          id: nanoid(),
          title: item.title,
          author: item.author,
          status,
          rating,
          review,
          images: [],
          genres: item.genres,
          dateRead,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({
          readingList: s.readingList.filter((w) => w.id !== id),
          reviews: [newReview, ...s.reviews],
        }));
      },
    }),
    { name: 'basil-books' },
  ),
);
