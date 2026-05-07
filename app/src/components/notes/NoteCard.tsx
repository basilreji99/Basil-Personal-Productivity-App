import { useState } from 'react';
import TagChip from '../ui/TagChip';
import ConfirmDialog from '../ui/ConfirmDialog';
import type { Note } from '../../types';
import { useTasksStore } from '../../store/tasksStore';

const NOTE_BG: Record<string, string> = {
  default: 'bg-surface-container-lowest',
  pink: 'bg-pink-50',
  blue: 'bg-blue-50',
  green: 'bg-green-50',
  yellow: 'bg-yellow-50',
  purple: 'bg-purple-50',
  orange: 'bg-orange-50',
};

const NOTE_BG_DARK: Record<string, string> = {
  default: '',
  pink: 'dark:bg-pink-950/40',
  blue: 'dark:bg-blue-950/40',
  green: 'dark:bg-green-950/40',
  yellow: 'dark:bg-yellow-950/40',
  purple: 'dark:bg-purple-950/40',
  orange: 'dark:bg-orange-950/40',
};

export type NoteViewMode = 'masonry' | 'grid' | 'list';

interface NoteCardProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  view?: NoteViewMode;
}

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();

function getPlainPreview(note: Note): string {
  const type = note.noteType ?? 'text';
  if (type === 'text' && note.content) {
    return note.content.startsWith('<') ? stripHtml(note.content) : note.content;
  }
  if (type === 'checklist' && note.checklistItems?.length > 0) {
    return note.checklistItems.map(i => i.text).join(', ');
  }
  if (note.content) return note.content.split('\n').filter(Boolean).join(' ');
  return '';
}

function NoteContent({ note, clamp = 6 }: { note: Note; clamp?: number }) {
  const type = note.noteType ?? 'text';

  const isHtml = note.content?.startsWith('<');
  if (type === 'text' && isHtml && note.content) {
    return (
      <p className={`font-work-sans text-sm text-on-surface-variant whitespace-pre-wrap line-clamp-${clamp}`}>
        {stripHtml(note.content)}
      </p>
    );
  }

  if (type === 'checklist' && note.checklistItems?.length > 0) {
    const visible = note.checklistItems.slice(0, Math.min(clamp, 5));
    const remaining = note.checklistItems.length - visible.length;
    return (
      <ul className="space-y-1 mt-1">
        {visible.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
              item.checked ? 'border-tertiary bg-tertiary' : 'border-outline-variant'
            }`}>
              {item.checked && (
                <span className="material-symbols-outlined text-[9px] text-on-tertiary icon-fill">check</span>
              )}
            </span>
            <span className={`font-work-sans text-xs ${item.checked ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
              {item.text}
            </span>
          </li>
        ))}
        {remaining > 0 && (
          <li className="font-inter text-[10px] text-outline">+{remaining} more</li>
        )}
      </ul>
    );
  }

  if ((type === 'bullets' || type === 'numbered') && note.content) {
    const lines = note.content.split('\n').filter(Boolean).slice(0, clamp);
    const remaining = note.content.split('\n').filter(Boolean).length - lines.length;
    return (
      <ul className="space-y-0.5 mt-1">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <span className="font-work-sans text-xs text-on-surface-variant shrink-0 mt-0.5 select-none">
              {type === 'bullets' ? '•' : `${i + 1}.`}
            </span>
            <span className="font-work-sans text-xs text-on-surface-variant line-clamp-1">{line}</span>
          </li>
        ))}
        {remaining > 0 && (
          <li className="font-inter text-[10px] text-outline">+{remaining} more</li>
        )}
      </ul>
    );
  }

  if (note.content) {
    return (
      <p className={`font-work-sans text-sm text-on-surface-variant whitespace-pre-wrap line-clamp-${clamp}`}>
        {note.content}
      </p>
    );
  }

  return null;
}

export default function NoteCard({ note, onEdit, onDelete, onPin, view = 'masonry' }: NoteCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const refCount = useTasksStore((s) =>
    s.tasks.filter((t) => t.linkedNoteIds?.includes(note.id)).length
  );

  const bgClass = `${NOTE_BG[note.color] ?? NOTE_BG.default} ${NOTE_BG_DARK[note.color] ?? ''}`;

  // ── List view ──────────────────────────────────────────────────────────────
  if (view === 'list') {
    const preview = getPlainPreview(note);
    return (
      <>
        <div
          className={`group flex items-center gap-3 px-4 py-3 ${bgClass} cursor-pointer hover:bg-surface-container active:bg-surface-container-high transition-colors border-b border-outline-variant/15`}
          onClick={() => onEdit(note)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              {note.pinned && (
                <span className="material-symbols-outlined text-[11px] text-primary icon-fill shrink-0">push_pin</span>
              )}
              <p className="font-inter font-semibold text-sm text-on-surface truncate leading-snug">
                {note.title || 'Untitled'}
              </p>
            </div>
            {preview && (
              <p className="font-work-sans text-xs text-on-surface-variant truncate mt-0.5 leading-snug">{preview}</p>
            )}
          </div>
          {note.images?.[0] && (
            <img src={note.images[0]} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onPin(note.id); }}
            className={`p-1.5 rounded-lg transition-all shrink-0 ${note.pinned ? 'text-primary' : 'text-on-surface-variant opacity-0 group-hover:opacity-60 hover:!opacity-100'}`}
          >
            <span className={`material-symbols-outlined text-[15px] ${note.pinned ? 'icon-fill' : ''}`}>push_pin</span>
          </button>
        </div>
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => onDelete(note.id)}
          title="Delete Note"
          message={`"${note.title || 'This note'}" will be permanently deleted.`}
          confirmLabel="Delete"
          danger
        />
      </>
    );
  }

  // ── Grid view ──────────────────────────────────────────────────────────────
  if (view === 'grid') {
    return (
      <>
        <div
          className={`${bgClass} rounded-xl shadow-card hover:shadow-card-hover transition-all duration-200 cursor-pointer group relative flex flex-col h-48 overflow-hidden`}
          onClick={() => onEdit(note)}
        >
          {note.images?.[0] && (
            <img src={note.images[0]} alt="" className="w-full h-24 object-cover rounded-t-xl" />
          )}
          <div className="p-3 flex-1 flex flex-col gap-1">
            {note.pinned && (
              <span className="material-symbols-outlined text-[12px] text-primary icon-fill absolute top-2 right-2">push_pin</span>
            )}
            {note.title && (
              <h3 className="font-inter font-semibold text-xs text-on-surface pr-3 line-clamp-2">{note.title}</h3>
            )}
            <div className="flex-1">
              <NoteContent note={note} clamp={4} />
            </div>
            {note.tags.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {note.tags.slice(0, 2).map((tag) => (
                  <TagChip key={tag} tag={tag} size="sm" />
                ))}
                {note.tags.length > 2 && (
                  <span className="font-inter text-[9px] text-outline self-center">+{note.tags.length - 2}</span>
                )}
              </div>
            )}
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-2 pb-2">
            <button
              onClick={(e) => { e.stopPropagation(); onPin(note.id); }}
              className={`p-1 rounded-lg hover:bg-surface-container transition-colors ${note.pinned ? 'text-primary' : 'text-on-surface-variant'}`}
            >
              <span className={`material-symbols-outlined text-[14px] ${note.pinned ? 'icon-fill' : ''}`}>push_pin</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              className="p-1 rounded-lg hover:bg-error-container/20 text-on-surface-variant hover:text-error transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">delete</span>
            </button>
          </div>
        </div>
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => onDelete(note.id)}
          title="Delete Note"
          message={`"${note.title || 'This note'}" will be permanently deleted.`}
          confirmLabel="Delete"
          danger
        />
      </>
    );
  }

  // ── Masonry / elongated card view (default) ────────────────────────────────
  return (
    <>
      <div
        className={`masonry-item ${bgClass} rounded-xl shadow-card hover:shadow-card-hover transition-all duration-200 cursor-pointer group relative max-h-[300px] overflow-hidden`}
        onClick={() => onEdit(note)}
      >
        <div className="p-4">
          {note.pinned && (
            <span className="material-symbols-outlined text-[14px] text-primary icon-fill absolute top-3 right-3">push_pin</span>
          )}

          {note.title && (
            <h3 className="font-inter font-semibold text-sm text-on-surface mb-1 pr-5">{note.title}</h3>
          )}

          <NoteContent note={note} />

          {note.images?.length > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {note.images.slice(0, 3).map((src, i) => (
                <img key={i} src={src} alt="" className="w-14 h-14 object-cover rounded-lg" />
              ))}
              {note.images.length > 3 && (
                <div className="w-14 h-14 rounded-lg bg-surface-container flex items-center justify-center">
                  <span className="font-inter text-xs text-outline">+{note.images.length - 3}</span>
                </div>
              )}
            </div>
          )}

          {note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {note.tags.map((tag) => (
                <TagChip key={tag} tag={tag} size="sm" />
              ))}
            </div>
          )}

          {refCount > 0 && (
            <div className="flex items-center gap-1 mt-2">
              <span className="material-symbols-outlined text-[12px] text-primary">task_alt</span>
              <span className="font-inter text-[10px] text-primary font-medium">
                {refCount} task{refCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-3 pb-3">
          <button
            onClick={(e) => { e.stopPropagation(); onPin(note.id); }}
            className={`p-1.5 rounded-lg hover:bg-surface-container transition-colors ${note.pinned ? 'text-primary' : 'text-on-surface-variant'}`}
            title={note.pinned ? 'Unpin' : 'Pin'}
          >
            <span className={`material-symbols-outlined text-[16px] ${note.pinned ? 'icon-fill' : ''}`}>push_pin</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
            className="p-1.5 rounded-lg hover:bg-error-container/20 text-on-surface-variant hover:text-error transition-colors"
            title="Delete"
          >
            <span className="material-symbols-outlined text-[16px]">delete</span>
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => onDelete(note.id)}
        title="Delete Note"
        message={`"${note.title || 'This note'}" will be permanently deleted.`}
        confirmLabel="Delete"
        danger
      />
    </>
  );
}
