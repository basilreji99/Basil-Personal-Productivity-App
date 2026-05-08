import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, horizontalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TopBar from '../components/layout/TopBar';
import NoteCard, { type NoteViewMode } from '../components/notes/NoteCard';
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
    <div className="fixed inset-0 z-[60] flex items-end bg-black/40" onClick={onClose}>
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

// Draggable folder chip with ⋮ menu button
function SortableFolderChip({
  folder,
  isActive,
  isMenuOpen,
  onSelect,
  onMenuClick,
}: {
  folder: NoteFolder;
  isActive: boolean;
  isMenuOpen: boolean;
  onSelect: () => void;
  onMenuClick: (e: React.MouseEvent<HTMLButtonElement>, folder: NoteFolder) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: folder.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="relative flex-shrink-0 flex items-center gap-0.5"
    >
      <button
        {...attributes}
        {...listeners}
        onClick={onSelect}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-inter font-semibold text-xs border transition-all cursor-grab active:cursor-grabbing select-none ${
          isActive
            ? 'bg-primary text-on-primary border-primary'
            : 'border-outline-variant/60 text-on-surface-variant bg-surface-container-lowest/60 hover:border-primary/50'
        }`}
      >
        <span className="text-sm leading-none">{folder.emoji}</span>
        {folder.name}
      </button>
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => onMenuClick(e, folder)}
        className={`w-5 h-5 flex items-center justify-center rounded-full transition-all ${
          isMenuOpen
            ? 'bg-surface-container text-on-surface opacity-100'
            : 'text-on-surface-variant opacity-40 hover:opacity-100 hover:bg-surface-container'
        }`}
      >
        <span className="material-symbols-outlined text-[14px]">more_vert</span>
      </button>
    </div>
  );
}

export default function Notes() {
  const {
    notes, addNote, updateNote, deleteNote, togglePin,
    folders, addFolder, updateFolder, deleteFolder, reorderFolders, reorderFolderIds,
  } = useNotesStore();
  const pinnedTags = useTagStore(s => s.pinned);
  const tagUsage = useTagStore(s => s.usage);
  const filterTags = useMemo(() => {
    if (pinnedTags.length > 0) return pinnedTags;
    return Object.entries(tagUsage).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  }, [pinnedTags, tagUsage]);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string>('All');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editFolder, setEditFolder] = useState<NoteFolder | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number; folderId: string } | null>(null);
  const [view, setView] = useState<'folders' | NoteViewMode>(
    () => (localStorage.getItem('notes-view') as NoteViewMode) ?? 'masonry',
  );

  // Close folder menu when user clicks anywhere else
  useEffect(() => {
    if (!menuAnchor) return;
    const handler = () => setMenuAnchor(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [menuAnchor]);

  // DnD sensors for horizontal folder reorder
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const handleFolderDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = folders.findIndex(f => f.id === active.id);
    const newIdx = folders.findIndex(f => f.id === over.id);
    reorderFolderIds(arrayMove(folders, oldIdx, newIdx).map(f => f.id));
  };

  const handleMenuClick = (e: React.MouseEvent<HTMLButtonElement>, folder: NoteFolder) => {
    e.stopPropagation();
    if (menuAnchor?.folderId === folder.id) {
      setMenuAnchor(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setMenuAnchor({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 180), folderId: folder.id });
    }
  };

  const cycleView = (mode: 'folders' | NoteViewMode) => {
    setView(mode);
    if (mode !== 'folders') localStorage.setItem('notes-view', mode);
  };

  const openFolder = (folderId: string | null) => {
    setActiveFolder(folderId);
    setActiveTag('All');
    const lastView = (localStorage.getItem('notes-view') as NoteViewMode) ?? 'masonry';
    setView(lastView);
  };

  const filtered = useMemo(() => {
    let list = activeFolder === null
      ? notes
      : notes.filter((n) => n.folderId === activeFolder);
    if (activeTag !== 'All') list = list.filter((n) => n.tags.includes(activeTag));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((n) =>
        n.title.toLowerCase().includes(q) ||
        (n.content ?? '').replace(/<[^>]*>/g, ' ').toLowerCase().includes(q)
      );
    }
    const cmp = sortOrder === 'newest'
      ? (a: typeof notes[0], b: typeof notes[0]) => b.createdAt.localeCompare(a.createdAt)
      : (a: typeof notes[0], b: typeof notes[0]) => a.createdAt.localeCompare(b.createdAt);
    const pinned = list.filter((n) => n.pinned).sort(cmp);
    const unpinned = list.filter((n) => !n.pinned).sort(cmp);
    return [...pinned, ...unpinned];
  }, [notes, activeFolder, activeTag, sortOrder, searchQuery]);

  const folderNoteCounts = useMemo(
    () => Object.fromEntries(folders.map(f => [f.id, notes.filter(n => n.folderId === f.id).length])),
    [notes, folders],
  );

  const handleEdit = (note: Note) => { setEditNote(note); setModalOpen(true); };

  const handleSave = (data: Partial<Note>) => {
    if (editNote) updateNote(editNote.id, data);
    else addNote({ ...data, folderId: activeFolder });
    // editNote is cleared by onClose, not here, so auto-save can keep working
  };

  const openNew = () => { setEditNote(null); setModalOpen(true); };

  const hasActiveFilter = activeTag !== 'All' || sortOrder !== 'newest';

  const menuFolder = menuAnchor ? folders.find(f => f.id === menuAnchor.folderId) : null;
  const menuFolderIdx = menuAnchor ? folders.findIndex(f => f.id === menuAnchor.folderId) : -1;

  return (
    <div className="bg-background min-h-screen">
      <TopBar
        title="Notes"
        rightSlot={
          <div className="flex items-center gap-1">
            <div className="flex items-center bg-surface-container rounded-lg p-0.5 gap-0.5">
              {([
                { mode: 'folders' as const, icon: 'folder', label: 'Folders' },
                { mode: 'list' as const, icon: 'format_list_bulleted', label: 'List' },
                { mode: 'grid' as const, icon: 'grid_view', label: 'Grid' },
                { mode: 'masonry' as const, icon: 'view_agenda', label: 'Cards' },
              ]).map(({ mode, icon, label }) => (
                <button
                  key={mode}
                  onClick={() => cycleView(mode)}
                  title={label}
                  className={`p-1 rounded-md transition-all ${view === mode ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  <span className="material-symbols-outlined text-[18px]">{icon}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setFilterPanelOpen(v => !v)}
              className={`relative p-1.5 rounded-xl transition-colors ${filterPanelOpen ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
            >
              <span className="material-symbols-outlined text-[20px]">filter_list</span>
              {hasActiveFilter && !filterPanelOpen && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-primary" />
              )}
            </button>
            <button onClick={() => setTagManagerOpen(true)} className="p-1.5 rounded-xl text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">label</span>
            </button>
          </div>
        }
      />

      {/* Sticky filter section: folder bar + tag chips */}
      {view !== 'folders' && <div className="sticky top-14 z-30 bg-surface-container-low shadow-sm" style={{ top: 'calc(56px + env(safe-area-inset-top, 0px))' }}>

        {/* Search bar */}
        <div className="px-4 pt-2 pb-1">
          <div className="flex items-center gap-2 bg-surface-container rounded-xl px-3 h-9 border border-outline-variant/20">
            <span className="material-symbols-outlined text-[16px] text-outline shrink-0">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search notes..."
              className="flex-1 bg-transparent font-inter text-sm text-on-surface placeholder:text-outline outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="shrink-0">
                <span className="material-symbols-outlined text-[16px] text-outline">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Folder bar — DnD sortable */}
        <div className="flex gap-2 px-4 py-2 overflow-x-auto no-scrollbar items-center border-b border-outline-variant/25">
          {/* All button */}
          <button
            onClick={() => { setActiveFolder(null); setActiveTag('All'); }}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full font-inter font-semibold text-xs border transition-all ${
              activeFolder === null
                ? 'bg-primary text-on-primary border-primary'
                : 'border-outline-variant/60 text-on-surface-variant bg-surface-container-lowest/60 hover:border-primary/50'
            }`}
          >
            <span className="material-symbols-outlined text-[13px]">notes</span>
            All
          </button>

          {/* Sortable folder chips */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleFolderDragEnd}>
            <SortableContext items={folders.map(f => f.id)} strategy={horizontalListSortingStrategy}>
              {folders.map((folder) => (
                <SortableFolderChip
                  key={folder.id}
                  folder={folder}
                  isActive={activeFolder === folder.id}
                  isMenuOpen={menuAnchor?.folderId === folder.id}
                  onSelect={() => { setActiveFolder(folder.id); setActiveTag('All'); }}
                  onMenuClick={handleMenuClick}
                />
              ))}
            </SortableContext>
          </DndContext>

          {/* New folder button */}
          <button
            onClick={() => { setEditFolder(null); setFolderModalOpen(true); }}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-outline-variant/60 text-on-surface-variant font-inter text-xs hover:border-primary/50 transition-all"
          >
            <span className="material-symbols-outlined text-[13px]">create_new_folder</span>
            New folder
          </button>
        </div>

        {/* Collapsible filter panel */}
        {filterPanelOpen && (
          <div className="border-t border-outline-variant/25 px-4 py-3 space-y-3 bg-surface-container-low">
            {/* Sort */}
            <div className="flex items-center gap-3">
              <span className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline w-10 shrink-0">Sort</span>
              <div className="flex gap-2">
                {([
                  { value: 'newest', label: 'Newest first', icon: 'arrow_downward' },
                  { value: 'oldest', label: 'Oldest first', icon: 'arrow_upward' },
                ] as const).map(({ value, label, icon }) => (
                  <button
                    key={value}
                    onClick={() => setSortOrder(value)}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full border font-inter text-xs font-semibold transition-all ${
                      sortOrder === value
                        ? 'bg-primary text-on-primary border-primary'
                        : 'border-outline-variant/60 text-on-surface-variant hover:border-primary/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[12px]">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* Tags */}
            <div className="flex items-start gap-3">
              <span className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline w-10 shrink-0 pt-1.5">Tag</span>
              <div className="flex gap-2 flex-wrap">
                {['All', ...filterTags].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(tag)}
                    className={`flex-shrink-0 px-3 py-1 rounded-full font-inter font-semibold text-xs uppercase tracking-wide border transition-all duration-200 ${
                      activeTag === tag
                        ? 'bg-primary text-on-primary border-primary'
                        : 'border-outline-variant/60 text-on-surface-variant bg-surface-container-lowest/60 hover:border-primary/50 hover:text-primary'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            {/* Clear */}
            {hasActiveFilter && (
              <button
                onClick={() => { setActiveTag('All'); setSortOrder('newest'); }}
                className="text-xs font-inter font-semibold text-primary hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>}

      {/* Notes content */}
      <main className="max-w-screen-xl mx-auto px-4 py-4 pb-36">
        {view === 'folders' ? (
          <>
            <p className="font-inter text-xs font-semibold uppercase tracking-wider text-outline mb-3">
              {folders.length} folder{folders.length !== 1 ? 's' : ''} · {notes.length} notes total
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* All Notes card */}
              <button
                onClick={() => openFolder(null)}
                className="bg-primary/10 rounded-2xl p-5 flex flex-col items-center gap-2 hover:bg-primary/15 active:scale-[0.97] transition-all text-center"
              >
                <span className="material-symbols-outlined text-[40px] text-primary">notes</span>
                <p className="font-manrope font-bold text-sm text-on-surface">All Notes</p>
                <p className="font-inter text-xs text-on-surface-variant">{notes.length} note{notes.length !== 1 ? 's' : ''}</p>
              </button>

              {/* Folder cards */}
              {folders.map((folder) => (
                <div key={folder.id} className="relative group">
                  <button
                    onClick={() => openFolder(folder.id)}
                    className="w-full bg-surface-container rounded-2xl p-5 flex flex-col items-center gap-2 hover:bg-surface-container-high active:scale-[0.97] transition-all text-center"
                  >
                    <span className="text-4xl leading-none">{folder.emoji}</span>
                    <p className="font-manrope font-bold text-sm text-on-surface truncate w-full">{folder.name}</p>
                    <p className="font-inter text-xs text-on-surface-variant">
                      {folderNoteCounts[folder.id] ?? 0} note{(folderNoteCounts[folder.id] ?? 0) !== 1 ? 's' : ''}
                    </p>
                  </button>
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => handleMenuClick(e, folder)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-surface-container-highest transition-all"
                  >
                    <span className="material-symbols-outlined text-[15px]">more_vert</span>
                  </button>
                </div>
              ))}

              {/* New folder card */}
              <button
                onClick={() => { setEditFolder(null); setFolderModalOpen(true); }}
                className="rounded-2xl p-5 flex flex-col items-center gap-2 active:scale-[0.97] transition-all text-center border-2 border-dashed border-outline-variant/40 hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="material-symbols-outlined text-[40px] text-outline">create_new_folder</span>
                <p className="font-inter text-sm text-on-surface-variant font-medium">New Folder</p>
              </button>
            </div>
          </>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="material-symbols-outlined text-[48px] text-outline mb-3">sticky_note_2</span>
            <p className="font-manrope font-semibold text-on-surface mb-1">No notes yet</p>
            <p className="font-work-sans text-sm text-on-surface-variant">Tap + to create your first note</p>
          </div>
        ) : (() => {
          const pinnedNotes   = filtered.filter((n) => n.pinned);
          const unpinnedNotes = filtered.filter((n) => !n.pinned);
          const hasBoth = pinnedNotes.length > 0 && unpinnedNotes.length > 0;

          const SectionHeader = ({ icon, label }: { icon: string; label: string }) => (
            <div className="flex items-center gap-2 mb-2 mt-1">
              <span className="material-symbols-outlined text-[13px] text-amber-500">{icon}</span>
              <p className="font-inter text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">{label}</p>
              <div className="flex-1 h-px bg-amber-200/60 dark:bg-amber-700/30" />
            </div>
          );
          const NotesHeader = () => (
            <div className="flex items-center gap-2 mb-2 mt-3">
              <span className="material-symbols-outlined text-[13px] text-outline">notes</span>
              <p className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Notes</p>
              <div className="flex-1 h-px bg-outline-variant/30" />
            </div>
          );

          if (view === 'list') return (
            <>
              {pinnedNotes.length > 0 && (
                <>
                  {hasBoth && <SectionHeader icon="push_pin" label="Pinned" />}
                  <div className="rounded-xl overflow-hidden border border-outline-variant/20 shadow-card">
                    {pinnedNotes.map((note) => (
                      <NoteCard key={note.id} note={note} onEdit={handleEdit} onDelete={deleteNote} onPin={togglePin} view="list" />
                    ))}
                  </div>
                </>
              )}
              {hasBoth && <NotesHeader />}
              {unpinnedNotes.length > 0 && (
                <div className="rounded-xl overflow-hidden border border-outline-variant/20 shadow-card">
                  {unpinnedNotes.map((note) => (
                    <NoteCard key={note.id} note={note} onEdit={handleEdit} onDelete={deleteNote} onPin={togglePin} view="list" />
                  ))}
                </div>
              )}
            </>
          );

          if (view === 'grid') return (
            <>
              {pinnedNotes.length > 0 && (
                <>
                  {hasBoth && <SectionHeader icon="push_pin" label="Pinned" />}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {pinnedNotes.map((note) => (
                      <NoteCard key={note.id} note={note} onEdit={handleEdit} onDelete={deleteNote} onPin={togglePin} view="grid" />
                    ))}
                  </div>
                </>
              )}
              {hasBoth && <NotesHeader />}
              {unpinnedNotes.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {unpinnedNotes.map((note) => (
                    <NoteCard key={note.id} note={note} onEdit={handleEdit} onDelete={deleteNote} onPin={togglePin} view="grid" />
                  ))}
                </div>
              )}
            </>
          );

          // masonry
          return (
            <>
              {pinnedNotes.length > 0 && (
                <>
                  {hasBoth && <SectionHeader icon="push_pin" label="Pinned" />}
                  <div className="masonry-grid" style={{ columnCount: 1 }}>
                    <style>{`
                      @media (min-width: 640px) { .masonry-grid { column-count: 2; } }
                      @media (min-width: 1024px) { .masonry-grid { column-count: 3; } }
                    `}</style>
                    {pinnedNotes.map((note) => (
                      <NoteCard key={note.id} note={note} onEdit={handleEdit} onDelete={deleteNote} onPin={togglePin} view="masonry" />
                    ))}
                  </div>
                </>
              )}
              {hasBoth && <NotesHeader />}
              {unpinnedNotes.length > 0 && (
                <div className="masonry-grid" style={{ columnCount: 1 }}>
                  {unpinnedNotes.map((note) => (
                    <NoteCard key={note.id} note={note} onEdit={handleEdit} onDelete={deleteNote} onPin={togglePin} view="masonry" />
                  ))}
                </div>
              )}
            </>
          );
        })()}
      </main>

      {/* FAB */}
      <button
        onClick={openNew}
        className="fixed bottom-28 right-4 w-14 h-14 bg-primary text-on-primary rounded-full shadow-fab flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-40"
        style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}
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

      {/* Portal-based folder dropdown — rendered at body level to escape overflow clipping */}
      {menuAnchor && menuFolder && createPortal(
        <div
          style={{ position: 'fixed', top: menuAnchor.top, left: menuAnchor.left, zIndex: 70 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-surface-container-lowest rounded-xl shadow-modal border border-outline-variant/30 min-w-[160px] overflow-hidden"
        >
          <button
            onClick={() => { reorderFolders(menuFolder.id, 'left'); setMenuAnchor(null); }}
            disabled={menuFolderIdx === 0}
            className="flex items-center gap-2 w-full px-4 py-2.5 font-inter text-sm text-on-surface hover:bg-surface-container text-left disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Move left
          </button>
          <button
            onClick={() => { reorderFolders(menuFolder.id, 'right'); setMenuAnchor(null); }}
            disabled={menuFolderIdx === folders.length - 1}
            className="flex items-center gap-2 w-full px-4 py-2.5 font-inter text-sm text-on-surface hover:bg-surface-container text-left disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            Move right
          </button>
          <div className="border-t border-outline-variant/20" />
          <button
            onClick={() => { setEditFolder(menuFolder); setFolderModalOpen(true); setMenuAnchor(null); }}
            className="flex items-center gap-2 w-full px-4 py-2.5 font-inter text-sm text-on-surface hover:bg-surface-container text-left"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
            Rename
          </button>
          <button
            onClick={() => {
              deleteFolder(menuFolder.id);
              setMenuAnchor(null);
              if (activeFolder === menuFolder.id) setActiveFolder(null);
            }}
            className="flex items-center gap-2 w-full px-4 py-2.5 font-inter text-sm text-error hover:bg-error/5 text-left"
          >
            <span className="material-symbols-outlined text-[16px]">delete</span>
            Delete
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
