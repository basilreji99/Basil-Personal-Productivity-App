import { useState, useMemo } from 'react';
import TopBar from '../components/layout/TopBar';
import NoteCard from '../components/notes/NoteCard';
import NoteModal from '../components/notes/NoteModal';
import TagManager from '../components/ui/TagManager';
import { useNotesStore } from '../store/notesStore';
import { useTagStore } from '../store/tagStore';
import type { Note, NoteFolder } from '../types';

function FolderModal({
  folder,
  onSave,
  onClose,
}: {
  folder?: NoteFolder | null;
  onSave: (name: string, emoji: string) => void;
  onClose: () => void;
}) {
  const EMOJIS = ['📁', '📚', '💡', '🎯', '🔖', '🗂️', '📝', '💼', '🌟', '🔬', '🎨', '🏠'];
  const [name, setName] = useState(folder?.name ?? '');
  const [emoji, setEmoji] = useState(folder?.emoji ?? '📁');

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="w-full bg-surface-container-lowest rounded-t-2xl p-5 space-y-4"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-inter font-semibold text-sm text-on-surface">
          {folder ? 'Edit Folder' : 'New Folder'}
        </p>
        <div className="flex gap-2 flex-wrap">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`w-9 h-9 text-xl rounded-lg flex items-center justify-center transition-all ${emoji === e ? 'bg-primary/15 ring-1 ring-primary/40' : 'hover:bg-surface-container'}`}
            >
              {e}
            </button>
          ))}
        </div>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Folder name"
          className="w-full px-4 py-2.5 bg-surface-container rounded-lg font-work-sans text-base text-on-surface outline-none border border-outline-variant/30 focus:border-primary/40 placeholder:text-outline/50"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-outline-variant font-inter text-sm text-on-surface-variant">
            Cancel
          </button>
          <button
            onClick={() => { if (name.trim()) { onSave(name.trim(), emoji); onClose(); } }}
            disabled={!name.trim()}
            className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-inter font-semibold text-sm disabled:opacity-40"
          >
            {folder ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Notes() {
  const { notes, addNote, updateNote, deleteNote, togglePin, folders, addFolder, updateFolder, deleteFolder } = useNotesStore();
  const pinnedTags = useTagStore(s => s.pinned);
  const tagUsage = useTagStore(s => s.usage);
  const filterTags = useMemo(() => {
    if (pinnedTags.length > 0) return pinnedTags;
    return Object.entries(tagUsage).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  }, [pinnedTags, tagUsage]);

  const [activeFolder, setActiveFolder] = useState<string | null>(null); // null = All
  const [activeTag, setActiveTag] = useState<string>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editFolder, setEditFolder] = useState<NoteFolder | null>(null);
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = activeFolder === null
      ? notes
      : notes.filter((n) => n.folderId === activeFolder);
    if (activeTag !== 'All') list = list.filter((n) => n.tags.includes(activeTag));
    const pinned = list.filter((n) => n.pinned);
    const unpinned = list.filter((n) => !n.pinned);
    return [...pinned, ...unpinned];
  }, [notes, activeFolder, activeTag]);

  const handleEdit = (note: Note) => {
    setEditNote(note);
    setModalOpen(true);
  };

  const handleSave = (data: Partial<Note>) => {
    if (editNote) {
      updateNote(editNote.id, data);
    } else {
      addNote({ ...data, folderId: activeFolder });
    }
    setEditNote(null);
  };

  const openNew = () => {
    setEditNote(null);
    setModalOpen(true);
  };

  return (
    <div className="bg-background min-h-screen">
      <TopBar
        title="Notes"
        rightSlot={
          <button onClick={() => setTagManagerOpen(true)} className="p-1.5 rounded-xl text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px]">label</span>
          </button>
        }
      />

      {/* Folder bar */}
      <div className="bg-background/90 backdrop-blur-sm border-b border-outline-variant/20">
        <div className="flex gap-2 px-4 py-2 overflow-x-auto no-scrollbar items-center">
          <button
            onClick={() => { setActiveFolder(null); setActiveTag('All'); }}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full font-inter font-semibold text-xs border transition-all ${
              activeFolder === null ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant text-on-surface-variant hover:border-primary/40'
            }`}
          >
            <span className="material-symbols-outlined text-[13px]">notes</span>
            All
          </button>
          {folders.map((folder) => (
            <div key={folder.id} className="relative flex-shrink-0">
              <button
                onClick={() => { setActiveFolder(folder.id); setActiveTag('All'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-inter font-semibold text-xs border transition-all ${
                  activeFolder === folder.id ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant text-on-surface-variant hover:border-primary/40'
                }`}
              >
                <span className="text-sm leading-none">{folder.emoji}</span>
                {folder.name}
                {activeFolder === folder.id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setFolderMenuId(folder.id); }}
                    className="ml-0.5 opacity-70 hover:opacity-100"
                  >
                    <span className="material-symbols-outlined text-[12px]">more_vert</span>
                  </button>
                )}
              </button>
              {folderMenuId === folder.id && (
                <div className="absolute top-full left-0 mt-1 bg-surface-container-lowest rounded-xl shadow-modal border border-outline-variant/20 z-40 min-w-[140px] overflow-hidden">
                  <button
                    onClick={() => { setEditFolder(folder); setFolderModalOpen(true); setFolderMenuId(null); }}
                    className="flex items-center gap-2 w-full px-4 py-2.5 font-inter text-sm text-on-surface hover:bg-surface-container text-left"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                    Rename
                  </button>
                  <button
                    onClick={() => { deleteFolder(folder.id); setFolderMenuId(null); if (activeFolder === folder.id) setActiveFolder(null); }}
                    className="flex items-center gap-2 w-full px-4 py-2.5 font-inter text-sm text-error hover:bg-error/5 text-left"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
          <button
            onClick={() => { setEditFolder(null); setFolderModalOpen(true); }}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-outline-variant text-on-surface-variant font-inter text-xs hover:border-primary/40 transition-all"
          >
            <span className="material-symbols-outlined text-[13px]">create_new_folder</span>
            New folder
          </button>
        </div>
      </div>

      {/* Tag filter row */}
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
        </div>
      </div>

      {/* Backdrop to close folder menu */}
      {folderMenuId && (
        <div className="fixed inset-0 z-30" onClick={() => setFolderMenuId(null)} />
      )}

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

      {folderModalOpen && (
        <FolderModal
          folder={editFolder}
          onSave={(name, emoji) => {
            if (editFolder) updateFolder(editFolder.id, { name, emoji });
            else addFolder(name, emoji);
            setEditFolder(null);
          }}
          onClose={() => { setFolderModalOpen(false); setEditFolder(null); }}
        />
      )}
    </div>
  );
}
