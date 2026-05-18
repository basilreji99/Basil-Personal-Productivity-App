import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotesStore } from '../../store/notesStore';
import { useTasksStore } from '../../store/tasksStore';
import { useHabitsStore } from '../../store/habitsStore';

const COMMANDS = [
  { cmd: '/note', label: 'New note', icon: 'sticky_note_2', hint: '/note <title>' },
  { cmd: '/task', label: 'New task', icon: 'add_task', hint: '/task <title>' },
  { cmd: '/habit', label: 'New habit', icon: 'track_changes', hint: '/habit <name>' },
  { cmd: '/finance', label: 'Add expense', icon: 'payments', hint: '/finance <description> <amount>' },
  { cmd: '/timer', label: 'Start timer', icon: 'timer', hint: '/timer' },
];

export default function Streamliner() {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current); }, []);
  const navigate = useNavigate();
  const addNote = useNotesStore((s) => s.addNote);
  const addTask = useTasksStore((s) => s.addTask);
  const addHabit = useHabitsStore((s) => s.addHabit);

  const matchedCommands = value.startsWith('/')
    ? COMMANDS.filter((c) => c.cmd.startsWith(value.split(' ')[0]))
    : [];

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const [cmd, ...rest] = value.trim().split(' ');
    const args = rest.join(' ').trim();

    switch (cmd) {
      case '/note':
        if (args) {
          addNote({ title: args });
          navigate(`/notes`);
          setValue('');
        }
        break;
      case '/task':
        if (args) {
          addTask({ title: args });
          navigate('/tasks');
          setValue('');
        }
        break;
      case '/habit':
        if (args) {
          addHabit({ name: args });
          navigate('/habits');
          setValue('');
        }
        break;
      case '/timer':
        navigate('/');
        setValue('');
        break;
      default:
        if (value.trim() && !value.startsWith('/')) {
          addTask({ title: value.trim() });
          navigate('/tasks');
          setValue('');
        }
    }
  };

  const handleCommandSelect = (cmd: string) => {
    setValue(cmd + ' ');
    inputRef.current?.focus();
  };

  return (
    <div className="fixed bottom-16 left-0 right-0 z-40 pointer-events-none">
      <div className="max-w-lg mx-auto px-4 pb-2 pointer-events-auto">
        {focused && matchedCommands.length > 0 && (
          <div className="mb-2 bg-inverse-surface rounded-xl overflow-hidden shadow-modal animate-slide-up">
            {matchedCommands.map((c) => (
              <button
                key={c.cmd}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleCommandSelect(c.cmd);
                }}
                className="flex items-center gap-3 w-full px-4 py-3 text-inverse-on-surface hover:bg-white/10 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] text-outline">{c.icon}</span>
                <span className="font-inter text-sm font-medium">{c.label}</span>
                <span className="ml-auto font-mono text-xs text-outline">{c.hint}</span>
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div
            className={`flex items-center gap-3 bg-inverse-surface/95 backdrop-blur-xl rounded-2xl px-4 h-12 shadow-modal transition-all duration-200 ${
              focused ? 'ring-2 ring-primary/30' : ''
            }`}
          >
            <span className="material-symbols-outlined text-[18px] text-outline">terminal</span>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => { blurTimerRef.current = setTimeout(() => setFocused(false), 150); }}
              placeholder="Type / for commands or add a quick task..."
              className="streamliner-input text-inverse-on-surface placeholder:text-outline/60 flex-1"
            />
            {value && (
              <button type="submit" className="text-primary">
                <span className="material-symbols-outlined text-[20px]">send</span>
              </button>
            )}
            {!value && (
              <kbd className="bg-white/10 text-outline text-[10px] font-mono px-1.5 py-0.5 rounded">⌘K</kbd>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
