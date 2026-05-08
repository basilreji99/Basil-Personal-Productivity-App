import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: 'dashboard', iconFill: 'dashboard' },
  { to: '/notes', label: 'Notes', icon: 'sticky_note_2', iconFill: 'sticky_note_2' },
  { to: '/tasks', label: 'Tasks', icon: 'view_kanban', iconFill: 'view_kanban' },
  { to: '/habits', label: 'Habits', icon: 'track_changes', iconFill: 'track_changes' },
  { to: '/health', label: 'Health', icon: 'monitor_heart', iconFill: 'monitor_heart' },
];

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-surface-container-lowest/90 backdrop-blur-md border-t border-outline-variant/20 shadow-nav"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 10px)' }}
    >
      <div className="flex justify-around items-center h-16 px-1 max-w-screen-xl mx-auto">
        {NAV_ITEMS.map(({ to, label, icon, iconFill }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 px-1.5 py-1 rounded-lg flex-1 transition-all duration-200 ${
                isActive
                  ? 'text-primary'
                  : 'text-on-surface-variant opacity-60 hover:opacity-100 hover:text-primary'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`material-symbols-outlined text-[22px] transition-all duration-200 ${isActive ? 'icon-fill scale-110' : ''}`}
                >
                  {isActive ? iconFill : icon}
                </span>
                <span className="font-inter text-[9px] font-semibold uppercase tracking-wide leading-none">
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
