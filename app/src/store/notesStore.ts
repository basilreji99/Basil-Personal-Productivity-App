import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Note, NoteColor, NoteType } from '../types';
import { nanoid } from '../utils/nanoid';

interface NotesState {
  notes: Note[];
  addNote: (note: Partial<Omit<Note, 'id' | 'createdAt' | 'updatedAt'>>) => Note;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  togglePin: (id: string) => void;
  allTags: () => string[];
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: [
        {
          id: '1',
          title: 'Weekly Grocery List',
          content: '',
          noteType: 'checklist' as NoteType,
          checklistItems: [
            { id: '1a', text: 'Organic kale and spinach', checked: false },
            { id: '1b', text: 'Almond milk (unsweetened)', checked: true },
            { id: '1c', text: 'Quinoa and brown rice', checked: false },
            { id: '1d', text: 'Avocados (pick the firm ones)', checked: false },
            { id: '1e', text: 'Fresh salmon fillets', checked: false },
          ],
          images: [],
          tags: ['Personal', 'Shopping'],
          color: 'default',
          pinned: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '2',
          title: 'App Feature Idea',
          content: 'Integrate a "Deep Focus" mode that auto-mutes notifications and plays lofi beats when the task timer starts.',
          noteType: 'text' as NoteType,
          checklistItems: [],
          images: [],
          tags: ['Productivity'],
          color: 'blue',
          pinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '3',
          title: 'Books to Read',
          content: 'Atomic Habits – James Clear\nDeep Work – Cal Newport\nThe Pragmatic Programmer\nMeditations – Marcus Aurelius',
          noteType: 'numbered' as NoteType,
          checklistItems: [],
          images: [],
          tags: ['Personal', 'Growth'],
          color: 'green',
          pinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],

      addNote: (partial) => {
        const note: Note = {
          id: nanoid(),
          title: partial.title ?? 'Untitled Note',
          content: partial.content ?? '',
          noteType: partial.noteType ?? 'text',
          checklistItems: partial.checklistItems ?? [],
          images: partial.images ?? [],
          tags: partial.tags ?? [],
          color: (partial.color as NoteColor) ?? 'default',
          pinned: partial.pinned ?? false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ notes: [note, ...s.notes] }));
        return note;
      },

      updateNote: (id, updates) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n,
          ),
        })),

      deleteNote: (id) =>
        set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      togglePin: (id) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id ? { ...n, pinned: !n.pinned, updatedAt: new Date().toISOString() } : n,
          ),
        })),

      allTags: () => {
        const tags = new Set<string>();
        get().notes.forEach((n) => n.tags.forEach((t) => tags.add(t)));
        return Array.from(tags).sort();
      },
    }),
    { name: 'productivity-notes' },
  ),
);
