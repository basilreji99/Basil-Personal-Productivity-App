import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import HabitQuickSheet from './HabitQuickSheet';

const NAV_LEFT = [
  { to: '/', label: 'Home', icon: 'dashboard' },
  { to: '/finance', label: 'Finance', icon: 'payments' },
  { to: '/notes', label: 'Notes', icon: 'sticky_note_2' },
  { to: '/tasks', label: 'Tasks', icon: 'view_kanban' },
];

const NAV_RIGHT = [
  { to: '/health', label: 'Health', icon: 'monitor_heart' },
];

function NavItem({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center gap-1 px-1 py-1 flex-1 transition-all duration-200 ${
          isActive
            ? 'text-primary'
            : 'text-on-surface-variant opacity-60 hover:opacity-100 hover:text-primary'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`flex items-center justify-center w-14 h-8 rounded-full transition-all duration-200 ${isActive ? 'bg-primary/12 dark:bg-primary/25' : ''}`}>
            <span className={`material-symbols-outlined text-[22px] transition-all duration-200 ${isActive ? 'icon-fill' : ''}`}>
              {icon}
            </span>
          </span>
          <span className="font-inter text-[11px] font-semibold uppercase tracking-wide leading-none">
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

export default function BottomNav() {
  const [showHabits, setShowHabits] = useState(false);

  return (
    <>
      {showHabits && <HabitQuickSheet onClose={() => setShowHabits(false)} />}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-surface-container-lowest/90 backdrop-blur-md border-t border-outline-variant/20 shadow-nav"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 10px)' }}
      >
        <div className="flex justify-around items-center h-16 px-1 max-w-screen-xl mx-auto">
          {NAV_LEFT.map(item => <NavItem key={item.to} {...item} />)}

          {/* Quick Access — habit check-in sheet */}
          <button
            onClick={() => setShowHabits(true)}
            className="flex flex-col items-center justify-center gap-1 px-1 py-1 flex-1 transition-all duration-200 text-on-surface-variant opacity-60 hover:opacity-100 hover:text-primary"
          >
            <span className="flex items-center justify-center w-14 h-8 rounded-full transition-all duration-200">
              <span className="material-symbols-outlined text-[22px] transition-all duration-200">
                track_changes
              </span>
            </span>
            <span className="font-inter text-[11px] font-semibold uppercase tracking-wide leading-none">
              Quick
            </span>
          </button>

          {NAV_RIGHT.map(item => <NavItem key={item.to} {...item} />)}
        </div>
      </nav>
    </>
  );
}
