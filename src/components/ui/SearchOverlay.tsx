import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useNotesStore } from '../../store/notesStore';
import { useTasksStore } from '../../store/tasksStore';
import { useHabitsStore } from '../../store/habitsStore';
import { useFinanceStore } from '../../store/financeStore';
import { useFitnessStore } from '../../store/fitnessStore';
import type { SearchResult } from '../../types';

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

export default function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const notes        = useNotesStore((s) => s.notes);
  const tasks        = useTasksStore((s) => s.tasks);
  const habits       = useHabitsStore((s) => s.habits);
  const transactions = useFinanceStore((s) => s.transactions);
  const { gymSessions, sportSessions } = useFitnessStore();

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const results: SearchResult[] = query.trim().length < 1 ? [] : [
    ...notes
      .filter((n) =>
        n.title.toLowerCase().includes(query.toLowerCase()) ||
        n.content.toLowerCase().includes(query.toLowerCase()),
      )
      .slice(0, 4)
      .map((n) => ({
        type: 'note' as const,
        id: n.id,
        title: n.title,
        subtitle: n.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').slice(0, 60),
        icon: 'sticky_note_2',
        color: 'text-pink-500',
        navigateTo: '/notes',
        navigateState: { openNoteId: n.id },
      })),
    ...tasks
      .filter((t) =>
        t.title.toLowerCase().includes(query.toLowerCase()) ||
        t.description.toLowerCase().includes(query.toLowerCase()),
      )
      .slice(0, 4)
      .map((t) => ({
        type: 'task' as const,
        id: t.id,
        title: t.title,
        subtitle: t.status,
        icon: 'task_alt',
        color: 'text-primary',
        navigateTo: `/tasks/${t.id}`,
      })),
    ...habits
      .filter((h) => h.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 3)
      .map((h) => ({
        type: 'habit' as const,
        id: h.id,
        title: h.name,
        subtitle: h.description,
        icon: h.icon,
        color: 'text-habit-green',
        navigateTo: '/habits',
      })),
    ...transactions
      .filter((t) => t.description.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 3)
      .map((t) => ({
        type: 'transaction' as const,
        id: t.id,
        title: t.description,
        subtitle: `${t.type === 'income' ? '+' : '-'}$${t.amount.toFixed(2)} · ${t.category}`,
        icon: 'payments',
        color: 'text-finance-cyan',
        navigateTo: '/finance',
      })),
    ...gymSessions
      .filter((s) => s.type.toLowerCase().includes(query.toLowerCase()) || (s.notes ?? '').toLowerCase().includes(query.toLowerCase()))
      .slice(0, 3)
      .map((s) => ({
        type: 'note' as const,
        id: s.id,
        title: s.type,
        subtitle: `Gym · ${s.date}`,
        icon: 'fitness_center',
        color: 'text-orange-500',
        navigateTo: '/hobbies/fitness',
      })),
    ...sportSessions
      .filter((s) => s.sport.toLowerCase().includes(query.toLowerCase()) || (s.notes ?? '').toLowerCase().includes(query.toLowerCase()))
      .slice(0, 3)
      .map((s) => ({
        type: 'note' as const,
        id: s.id,
        title: s.sport,
        subtitle: `Sport · ${s.date}`,
        icon: 'sports_soccer',
        color: 'text-green-500',
        navigateTo: '/hobbies/fitness',
      })),
  ];

  const handleSelect = (result: SearchResult) => {
    navigate(result.navigateTo, result.navigateState ? { state: result.navigateState } : {});
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-4 max-w-lg mx-auto w-full bg-surface-container-lowest rounded-2xl shadow-modal overflow-hidden animate-scale-in" style={{ marginTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant/20">
          <span className="material-symbols-outlined text-[22px] text-on-surface-variant">search</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes, tasks, habits..."
            className="flex-1 bg-transparent text-on-surface font-work-sans text-base outline-none placeholder:text-outline"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[60dvh] overflow-y-auto">
          {query.trim().length < 1 ? (
            <div className="p-8 text-center text-on-surface-variant font-work-sans text-sm">
              Search notes, tasks, habits, finance, gym &amp; sports
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant font-work-sans text-sm">
              No results for "<span className="font-medium text-on-surface">{query}</span>"
            </div>
          ) : (
            <div className="py-2">
              {(['note', 'task', 'habit', 'transaction'] as const).map((type) => {
                const group = results.filter((r) => r.type === type);
                if (group.length === 0) return null;
                const groupLabel = type === 'note' ? 'Notes' : type === 'task' ? 'Tasks' : type === 'habit' ? 'Habits' : 'Finance';
                return (
                  <div key={type}>
                    <div className="px-4 py-2">
                      <span className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">{groupLabel}</span>
                    </div>
                    {group.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => handleSelect(r)}
                        className="flex items-center gap-3 w-full px-4 py-3 hover:bg-surface-container transition-colors text-left"
                      >
                        <span className={`material-symbols-outlined text-[20px] ${r.color}`}>{r.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-inter font-medium text-sm text-on-surface truncate">{r.title}</p>
                          {r.subtitle && (
                            <p className="font-work-sans text-xs text-on-surface-variant truncate mt-0.5">{r.subtitle}</p>
                          )}
                        </div>
                        <span className="material-symbols-outlined text-[16px] text-outline-variant">arrow_forward</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
