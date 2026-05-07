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
  { value: 'default', label: 'Default', bg: 'bg-surface-container-low',                                    ring: 'ring-outline-variant' },
  { value: 'pink',    label: 'Pink',    bg: 'bg-pink-50 dark:bg-pink-950/50',                              ring: 'ring-pink-300 dark:ring-pink-700' },
  { value: 'blue',    label: 'Blue',    bg: 'bg-blue-50 dark:bg-blue-950/50',                              ring: 'ring-blue-300 dark:ring-blue-700' },
  { value: 'green',   label: 'Green',   bg: 'bg-green-50 dark:bg-green-950/50',                            ring: 'ring-green-300 dark:ring-green-700' },
  { value: 'yellow',  label: 'Yellow',  bg: 'bg-yellow-50 dark:bg-yellow-950/50',                          ring: 'ring-yellow-300 dark:ring-yellow-700' },
  { value: 'purple',  label: 'Purple',  bg: 'bg-purple-50 dark:bg-purple-950/50',                          ring: 'ring-purple-300 dark:ring-purple-700' },
  { value: 'orange',  label: 'Orange',  bg: 'bg-orange-50 dark:bg-orange-950/50',                          ring: 'ring-orange-300 dark:ring-orange-700' },
];

interface NoteModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Note>) => void;
  onDelete?: (id: string) => void;
  note?: Note | null;
}

function ToolbarBtn({
  active, onClick, icon, title, danger,
}: { active?: boolean; onClick: () => void; icon: string; title: string; danger?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg transition-colors font-inter font-bold text-sm ${
        active
          ? 'bg-primary/15 text-primary'
          : danger
          ? 'text-on-surface-variant hover:bg-error/10 hover:text-error'
          : 'text-on-surface-variant hover:bg-surface-container'
      }`}
    >
      {icon.startsWith('material:')
        ? <span className="material-symbols-outlined text-[18px]">{icon.slice(9)}</span>
        : <span>{icon}</span>}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="flex-shrink-0 w-px h-5 bg-outline-variant/30 mx-0.5" />;
}

export default function NoteModal({ open, onClose, onSave, onDelete, note }: NoteModalProps) {
  const { recordUsage, getSuggestions } = useTagStore();
  const [title, setTitle] = useState('');
  const [color, setColor] = useState<NoteColor>('default');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-save
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSavedIndicatorRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoSaved, setAutoSaved] = useState(false);

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
        class: 'note-editor outline-none min-h-[180px] font-work-sans text-base text-on-surface leading-relaxed',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (open) {
      const html = note?.content ?? '';
      editor.commands.setContent(html || '');
      setTitle(note?.title ?? '');
      setColor(note?.color ?? 'default');
      setTags(note?.tags ?? []);
      setConfirmingDelete(false);
    }
    setTagInput('');
  }, [open, note, editor]);

  // Cancel pending auto-save when modal closes
  useEffect(() => {
    if (!open) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      setAutoSaved(false);
    }
  }, [open]);

  // Ref always holds latest state so the timer callback never goes stale
  const latestAutoSaveRef = useRef<() => void>(() => {});
  latestAutoSaveRef.current = () => {
    if (!note) return;
    const html = editor?.getHTML() ?? '';
    const isEmpty = !title.trim() && (!html || html === '<p></p>');
    if (isEmpty) return;
    if (tags.length) recordUsage(tags);
    onSave({ title: title.trim() || 'Untitled', content: html, noteType: 'text', checklistItems: [], images: [], color, tags });
    setAutoSaved(true);
    if (autoSavedIndicatorRef.current) clearTimeout(autoSavedIndicatorRef.current);
    autoSavedIndicatorRef.current = setTimeout(() => setAutoSaved(false), 2000);
  };

  const scheduleAutoSave = () => {
    if (!note) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => latestAutoSaveRef.current(), 1500);
  };

  // Wire auto-save to TipTap editor content changes
  useEffect(() => {
    if (!editor || !note) return;
    const handler = () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => latestAutoSaveRef.current(), 1500);
    };
    editor.on('update', handler);
    return () => { editor.off('update', handler); };
  }, [editor, note?.id]);

  const colorConfig = NOTE_COLORS.find((c) => c.value === color) ?? NOTE_COLORS[0];

  const handleSave = () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
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
    if (t && !tags.includes(t)) { setTags([...tags, t]); scheduleAutoSave(); }
    setTagInput('');
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
    if (e.key === 'Backspace' && !tagInput && tags.length) { setTags(tags.slice(0, -1)); scheduleAutoSave(); }
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

  if (!editor) return null;

  return (
    <Modal open={open} onClose={onClose} title={note ? 'Edit Note' : 'New Note'} size="lg">
      <div className={`flex flex-col ${colorConfig.bg}`}>

        {/* Formatting toolbar — sticky so it stays visible when scrolling long notes */}
        <div className={`sticky top-0 z-10 ${colorConfig.bg} flex items-center gap-0.5 px-3 py-2 border-b border-outline-variant/20 overflow-x-auto no-scrollbar`}>
          {/* Paragraph style */}
          <select
            title="Paragraph style"
            value={
              editor.isActive('heading', { level: 1 }) ? 'h1'
              : editor.isActive('heading', { level: 2 }) ? 'h2'
              : editor.isActive('heading', { level: 3 }) ? 'h3'
              : 'p'
            }
            onMouseDown={(e) => e.preventDefault()}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'p') editor.chain().focus().setParagraph().run();
              else editor.chain().focus().toggleHeading({ level: Number(v[1]) as 1|2|3 }).run();
            }}
            className="flex-shrink-0 h-8 px-1.5 rounded-lg font-inter text-xs text-on-surface bg-surface-container border-none outline-none cursor-pointer"
          >
            <option value="p">Normal</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
          </select>

          <ToolbarDivider />

          {/* Text style */}
          <ToolbarBtn active={editor.isActive('bold')}          onClick={() => editor.chain().focus().toggleBold().run()}          icon="B"                         title="Bold (Ctrl+B)" />
          <ToolbarBtn active={editor.isActive('italic')}        onClick={() => editor.chain().focus().toggleItalic().run()}        icon="I"                         title="Italic (Ctrl+I)" />
          <ToolbarBtn active={editor.isActive('underline')}     onClick={() => editor.chain().focus().toggleUnderline().run()}     icon="U"                         title="Underline (Ctrl+U)" />
          <ToolbarBtn active={editor.isActive('strike')}        onClick={() => editor.chain().focus().toggleStrike().run()}        icon="material:strikethrough_s"  title="Strikethrough" />
          <ToolbarBtn active={editor.isActive('code')}          onClick={() => editor.chain().focus().toggleCode().run()}          icon="material:code"             title="Inline code" />

          <ToolbarDivider />

          {/* Alignment */}
          <ToolbarBtn active={editor.isActive({ textAlign: 'left' })}   onClick={() => editor.chain().focus().setTextAlign('left').run()}   icon="material:format_align_left"   title="Align left" />
          <ToolbarBtn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} icon="material:format_align_center" title="Align center" />
          <ToolbarBtn active={editor.isActive({ textAlign: 'right' })}  onClick={() => editor.chain().focus().setTextAlign('right').run()}  icon="material:format_align_right"  title="Align right" />

          <ToolbarDivider />

          {/* Lists */}
          <ToolbarBtn active={editor.isActive('bulletList')}  onClick={() => editor.chain().focus().toggleBulletList().run()}  icon="material:format_list_bulleted" title="Bullet list" />
          <ToolbarBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} icon="material:format_list_numbered" title="Numbered list" />

          <ToolbarDivider />

          {/* Block elements */}
          <ToolbarBtn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} icon="material:format_quote"    title="Blockquote" />
          <ToolbarBtn active={editor.isActive('codeBlock')}  onClick={() => editor.chain().focus().toggleCodeBlock().run()}  icon="material:integration_instructions" title="Code block" />
          <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} icon="material:horizontal_rule" title="Horizontal rule" />

          <ToolbarDivider />

          {/* Image */}
          <ToolbarBtn onClick={() => fileInputRef.current?.click()} icon="material:add_photo_alternate" title="Add image" />
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImagePick} />

          <ToolbarDivider />

          {/* History */}
          <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} icon="material:undo" title="Undo (Ctrl+Z)" />
          <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} icon="material:redo" title="Redo (Ctrl+Y)" />
        </div>

        {/* Title */}
        <div className="px-5 pt-4">
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); scheduleAutoSave(); }}
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
              onClick={() => { setColor(c.value); scheduleAutoSave(); }}
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
              <TagChip
                key={tag}
                tag={tag}
                onRemove={() => { setTags(tags.filter((t) => t !== tag)); scheduleAutoSave(); }}
                size="sm"
              />
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
                  onMouseDown={(e) => { e.preventDefault(); setTags([...tags, s]); scheduleAutoSave(); }}
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

          <div className="flex items-center gap-2">
            {autoSaved && (
              <span className="flex items-center gap-1 font-inter text-xs text-tertiary">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Saved
              </span>
            )}
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
