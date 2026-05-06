import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import SearchOverlay from '../ui/SearchOverlay';

interface TopBarProps {
  title?: string;
  showBack?: boolean;
  rightSlot?: React.ReactNode;
}

export default function TopBar({ title = 'Productivity', showBack = false, rightSlot }: TopBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const onCalendar = location.pathname === '/calendar';

  return (
    <>
      <header className="bg-surface-container-lowest border-b border-outline-variant/30 sticky top-0 z-40 backdrop-blur-sm" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex justify-between items-center w-full px-4 h-14 max-w-screen-xl mx-auto">
          <div className="flex items-center gap-3">
            {showBack && (
              <button
                onClick={() => navigate(-1)}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[22px]">arrow_back</span>
              </button>
            )}
            <h1 className="font-manrope font-bold text-lg text-primary">{title}</h1>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate('/calendar')}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${onCalendar ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:bg-surface-container'}`}
              title="Calendar"
            >
              <span className={`material-symbols-outlined text-[22px] ${onCalendar ? 'icon-fill' : ''}`}>calendar_month</span>
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[22px]">search</span>
            </button>
            {rightSlot}
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center ml-1">
              <span className="text-white font-inter font-semibold text-xs">B</span>
            </div>
          </div>
        </div>
      </header>
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
