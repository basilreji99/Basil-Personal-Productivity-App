import Modal from './Modal';
import { useTagStore } from '../../store/tagStore';

interface TagManagerProps {
  open: boolean;
  onClose: () => void;
}

export default function TagManager({ open, onClose }: TagManagerProps) {
  const { usage, pinned, pin, unpin, remove } = useTagStore();

  const allTags = Object.entries(usage)
    .sort((a, b) => {
      const aPinned = pinned.includes(a[0]);
      const bPinned = pinned.includes(b[0]);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return b[1] - a[1];
    });

  return (
    <Modal open={open} onClose={onClose} title="Manage Tags" size="sm">
      <div className="p-4 space-y-1 max-h-[60vh] overflow-y-auto">
        {allTags.length === 0 ? (
          <p className="text-center font-inter text-sm text-on-surface-variant py-6">
            No tags yet. Add tags to your notes or tasks and they'll appear here.
          </p>
        ) : (
          <>
            <p className="font-inter text-xs text-on-surface-variant mb-3">
              Pinned tags always show in filter bars. Others show by most used (top 8).
            </p>
            {allTags.map(([tag, count]) => {
              const isPinned = pinned.includes(tag);
              return (
                <div key={tag} className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-surface-container group">
                  <span className="flex-1 font-inter text-sm text-on-surface truncate">{tag}</span>
                  <span className="font-inter text-xs text-outline bg-surface-container px-1.5 py-0.5 rounded-full">
                    {count}
                  </span>
                  <button
                    onClick={() => isPinned ? unpin(tag) : pin(tag)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      isPinned
                        ? 'text-primary bg-primary/10'
                        : 'text-on-surface-variant hover:text-primary hover:bg-primary/10'
                    }`}
                    title={isPinned ? 'Unpin tag' : 'Pin tag to filter bar'}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isPinned ? 'push_pin' : 'push_pin'}
                    </span>
                  </button>
                  <button
                    onClick={() => remove(tag)}
                    className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove tag"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>
    </Modal>
  );
}
