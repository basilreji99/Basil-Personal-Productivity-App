import { useState, useMemo } from 'react';
import TopBar from '../components/layout/TopBar';
import NoteCard from '../components/notes/NoteCard';
import NoteModal from '../components/notes/NoteModal';
import TagManager from '../components/ui/TagManager';
import { useNotesStore } from '../store/notesStore';
import { useTagStore } from '../store/tagStore';
import type { Note } from '../types';

export default function Notes() {
  const { notes, addNote, updateNote, deleteNote, togglePin } = useNotesStore();
  const pinnedTags = useTagStore(s => s.pinned);
  const tagUsage = useTagStore(s => s.usage);
  const filterTags = useMemo(() => {
    if (pinnedTags.length > 0) return pinnedTags;
    return Object.entries(tagUsage).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  }, [pinnedTags, tagUsage]);
  const [activeTag, setActiveTag] = useState<string>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [editNote, setEditNote] = useState<Note | null>(null);

  const filtered = useMemo(() => {
    const list = activeTag === 'All' ? notes : notes.filter((n) => n.tags.includes(activeTag));
    const pinned = list.filter((n) => n.pinned);
    const unpinned = list.filter((n) => !n.pinned);
    return [...pinned, ...unpinned];
  }, [notes, activeTag]);

  const handleEdit = (note: Note) => {
    setEditNote(note);
    setModalOpen(true);
  };

  const handleSave = (data: Partial<Note>) => {
    if (editNote) {
      updateNote(editNote.id, data);
    } else {
      addNote(data);
    }
    setEditNote(null);
  };

  const openNew = () => {
    setEditNote(null);
    setModalOpen(true);
  };

  return (
    <div className="bg-background min-h-screen">
      <TopBar title="Notes" />

      {/* Filter tabs */}
      <div className="sticky top-14 z-30 bg-background/90 backdrop-blur-sm border-b border-outline-variant/20">
        <div className="flex gap-2 px-4 py-2.5 overflow-x-auto no-scrollbar">
          {['All', ...filterTags].map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full font-inter font-semibold text-xs uppercase tracking-wide border transition-all duration-200 ${
                activeTag === tag
                  ? 'bg-primary text-on-primary border-primary'
                  : 'border-outline-variant text-on-surface-variant hover:border-primary/40 hover:text-primary'
              }`}
            >
              {tag}
            </button>
          ))}
          <button
            onClick={() => setTagManagerOpen(true)}
            className="flex-shrink-0 flex items-center px-2.5 py-1.5 rounded-full border border-outline-variant text-on-surface-variant hover:border-primary/40 transition-all"
            title="Manage tags"
          >
            <span className="material-symbols-outlined text-[16px]">settings</span>
          </button>
        </div>
      </div>

      <main className="max-w-screen-xl mx-auto px-4 py-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="material-symbols-outlined text-[48px] text-outline mb-3">sticky_note_2</span>
            <p className="font-manrope font-semibold text-on-surface mb-1">No notes yet</p>
            <p className="font-work-sans text-sm text-on-surface-variant">Tap + to create your first note</p>
          </div>
        ) : (
          <div className="masonry-grid" style={{ columnCount: 1 }}>
            <style>{`
              @media (min-width: 640px) { .masonry-grid { column-count: 2; } }
              @media (min-width: 1024px) { .masonry-grid { column-count: 3; } }
            `}</style>
            {filtered.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={handleEdit}
                onDelete={deleteNote}
                onPin={togglePin}
              />
            ))}
          </div>
        )}
      </main>

      {/* FAB */}
      <button
        onClick={openNew}
        className="fixed bottom-28 right-4 w-14 h-14 bg-primary text-on-primary rounded-full shadow-fab flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-40"
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>

      {/* Quick capture bar */}
      <div className="fixed bottom-16 left-0 right-0 z-40 pointer-events-none">
        <div className="max-w-lg mx-auto px-4 pb-2 pointer-events-auto">
          <button
            onClick={openNew}
            className="w-full flex items-center gap-3 bg-surface-container-lowest rounded-full px-4 h-11 shadow-card border border-outline-variant/30 text-left"
          >
            <span className="font-inter text-xs text-primary font-bold">+</span>
            <span className="font-inter text-sm text-outline">Type a quick note or '/' for commands...</span>
          </button>
        </div>
      </div>

      <NoteModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditNote(null); }}
        onSave={handleSave}
        onDelete={editNote ? (id) => { deleteNote(id); setModalOpen(false); setEditNote(null); } : undefined}
        note={editNote}
      />

      <TagManager open={tagManagerOpen} onClose={() => setTagManagerOpen(false)} />
    </div>
  );
}
