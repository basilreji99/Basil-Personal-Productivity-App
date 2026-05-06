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

interface NoteCardProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
}

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();

function NoteContent({ note }: { note: Note }) {
  const type = note.noteType ?? 'text';

  // Rich HTML content (from TipTap editor)
  const isHtml = note.content?.startsWith('<');
  if (type === 'text' && isHtml && note.content) {
    const plain = stripHtml(note.content);
    return (
      <p className="font-work-sans text-sm text-on-surface-variant line-clamp-6 whitespace-pre-wrap">
        {plain}
      </p>
    );
  }

  if (type === 'checklist' && note.checklistItems?.length > 0) {
    const visible = note.checklistItems.slice(0, 5);
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
    const lines = note.content.split('\n').filter(Boolean).slice(0, 5);
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
      <p className="font-work-sans text-sm text-on-surface-variant whitespace-pre-wrap line-clamp-6">
        {note.content}
      </p>
    );
  }

  return null;
}

export default function NoteCard({ note, onEdit, onDelete, onPin }: NoteCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const refCount = useTasksStore((s) =>
    s.tasks.filter((t) => t.linkedNoteIds?.includes(note.id)).length
  );

  return (
    <>
      <div
        className={`masonry-item ${NOTE_BG[note.color]} rounded-xl shadow-card hover:shadow-card-hover transition-all duration-200 cursor-pointer group relative`}
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

          {/* Image thumbnails */}
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

        {/* Hover action row */}
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
