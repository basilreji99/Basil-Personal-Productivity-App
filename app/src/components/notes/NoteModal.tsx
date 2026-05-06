import { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExt from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import ImageExt from '@tiptap/extension-image';
import Modal from '../ui/Modal';
import TagChip from '../ui/TagChip';
import type { Note, NoteColor } from '../../types';
import { useTagStore } from '../../store/tagStore';

const NOTE_COLORS: { value: NoteColor; label: string; bg: string; ring: string }[] = [
  { value: 'default', label: 'Default', bg: 'bg-surface-container-low', ring: 'ring-outline-variant' },
  { value: 'pink',    label: 'Pink',    bg: 'bg-pink-50',               ring: 'ring-pink-300' },
  { value: 'blue',    label: 'Blue',    bg: 'bg-blue-50',               ring: 'ring-blue-300' },
  { value: 'green',   label: 'Green',   bg: 'bg-green-50',              ring: 'ring-green-300' },
  { value: 'yellow',  label: 'Yellow',  bg: 'bg-yellow-50',             ring: 'ring-yellow-300' },
  { value: 'purple',  label: 'Purple',  bg: 'bg-purple-50',             ring: 'ring-purple-300' },
  { value: 'orange',  label: 'Orange',  bg: 'bg-orange-50',             ring: 'ring-orange-300' },
];

interface NoteModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Note>) => void;
  onDelete?: (id: string) => void;
  note?: Note | null;
}

function ToolbarBtn({
  active, onClick, icon, title,
}: { active?: boolean; onClick: () => void; icon: string; title: string }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors font-inter font-bold text-sm ${
        active ? 'bg-primary/15 text-primary' : 'text-on-surface-variant hover:bg-surface-container'
      }`}
    >
      {icon.startsWith('material:')
        ? <span className="material-symbols-outlined text-[18px]">{icon.slice(9)}</span>
        : <span>{icon}</span>}
    </button>
  );
}

export default function NoteModal({ open, onClose, onSave, onDelete, note }: NoteModalProps) {
  const { recordUsage, getSuggestions } = useTagStore();
  const [title, setTitle] = useState('');
  const [color, setColor] = useState<NoteColor>('default');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExt,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ImageExt.configure({ inline: true, allowBase64: true }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[180px] font-work-sans text-base text-on-surface leading-relaxed prose prose-sm max-w-none',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (open) {
      // Populate editor when opening
      const html = note?.content ?? '';
      editor.commands.setContent(html || '');
      setTitle(note?.title ?? '');
      setColor(note?.color ?? 'default');
      setTags(note?.tags ?? []);
      setConfirmingDelete(false);
    }
    setTagInput('');
  }, [open, note, editor]);

  const handleSave = () => {
    const html = editor?.getHTML() ?? '';
    const isEmpty = !title.trim() && (!html || html === '<p></p>');
    if (isEmpty) return;
    if (tags.length) recordUsage(tags);
    onSave({
      title: title.trim() || 'Untitled',
      content: html,
      noteType: 'text',
      checklistItems: [],
      images: [],
      color,
      tags,
    });
    onClose();
  };

  const suggestions = getSuggestions(tags, tagInput, 5);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
    if (e.key === 'Backspace' && !tagInput && tags.length) setTags(tags.slice(0, -1));
  };

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target?.result as string;
        if (src && editor) {
          editor.chain().focus().setImage({ src }).run();
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const colorConfig = NOTE_COLORS.find((c) => c.value === color) ?? NOTE_COLORS[0];

  if (!editor) return null;

  return (
    <Modal open={open} onClose={onClose} title={note ? 'Edit Note' : 'New Note'} size="lg">
      <div className={`flex flex-col ${colorConfig.bg}`}>

        {/* Formatting toolbar */}
        <div className="flex items-center gap-0.5 px-4 py-2 border-b border-outline-variant/20 flex-wrap">
          <ToolbarBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} icon="B" title="Bold" />
          <ToolbarBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} icon="I" title="Italic" />
          <ToolbarBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} icon="U" title="Underline" />

          <div className="w-px h-5 bg-outline-variant/30 mx-1" />

          <ToolbarBtn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} icon="material:format_align_left" title="Align left" />
          <ToolbarBtn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} icon="material:format_align_center" title="Align center" />
          <ToolbarBtn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} icon="material:format_align_right" title="Align right" />

          <div className="w-px h-5 bg-outline-variant/30 mx-1" />

          <ToolbarBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} icon="material:format_list_bulleted" title="Bullet list" />
          <ToolbarBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} icon="material:format_list_numbered" title="Numbered list" />

          <div className="w-px h-5 bg-outline-variant/30 mx-1" />

          <ToolbarBtn onClick={() => fileInputRef.current?.click()} icon="material:add_photo_alternate" title="Add image" />
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImagePick} />
        </div>

        {/* Title */}
        <div className="px-5 pt-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full bg-transparent border-none outline-none font-manrope font-bold text-xl text-on-surface placeholder:text-outline/50"
          />
        </div>

        {/* TipTap editor */}
        <div className="px-5 py-3 flex-1">
          <EditorContent editor={editor} />
        </div>

        {/* Color picker */}
        <div className="flex gap-2 px-5 pb-3">
          {NOTE_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              className={`w-7 h-7 rounded-full border-2 transition-all ${c.bg} ${
                color === c.value ? `ring-2 ring-offset-1 ${c.ring}` : 'border-transparent'
              }`}
              title={c.label}
            />
          ))}
        </div>

        {/* Tags */}
        <div className="px-5 pb-3 space-y-2">
          <div className="flex flex-wrap gap-1.5 items-center min-h-[32px]">
            {tags.map((tag) => (
              <TagChip key={tag} tag={tag} onRemove={() => setTags(tags.filter((t) => t !== tag))} size="sm" />
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={addTag}
              placeholder="Add tag..."
              className="bg-transparent border-none outline-none font-inter text-xs text-on-surface placeholder:text-outline/50 w-24"
            />
          </div>
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setTags([...tags, s]); }}
                  className="px-2.5 py-1 rounded-full bg-surface-container-low border border-outline-variant font-inter text-xs text-on-surface-variant hover:border-primary/50 hover:text-primary transition-colors"
                >
                  + {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center gap-2 px-5 py-4 border-t border-outline-variant/20">
          {note && onDelete ? (
            confirmingDelete ? (
              <div className="flex items-center gap-2">
                <span className="font-inter text-xs text-error">Delete this note?</span>
                <button
                  onClick={() => onDelete(note.id)}
                  className="px-3 py-1.5 rounded-lg bg-error text-on-error font-inter font-medium text-xs"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="px-3 py-1.5 rounded-lg text-on-surface-variant font-inter text-xs hover:bg-surface-container"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="p-2 rounded-lg text-on-surface-variant hover:bg-error-container/20 hover:text-error transition-colors"
                title="Delete note"
              >
                <span className="material-symbols-outlined text-[20px]">delete</span>
              </button>
            )
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-on-surface-variant font-inter font-medium text-sm hover:bg-surface-container transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-primary text-on-primary font-inter font-medium text-sm hover:opacity-90 transition-opacity"
            >
              {note ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
