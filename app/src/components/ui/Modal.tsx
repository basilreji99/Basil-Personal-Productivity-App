import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
  hideHeader?: boolean;
}

const sizeClass = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  full: 'max-w-full h-full',
};

export default function Modal({ open, onClose, title, children, size = 'md', hideHeader = false }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm animate-fade-in" />
      <div
        className={`relative bg-surface-container-lowest w-full ${sizeClass[size]} rounded-t-2xl sm:rounded-2xl shadow-modal animate-slide-up sm:animate-scale-in overflow-hidden flex flex-col max-h-[92dvh]`}
      >
        {!hideHeader && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 shrink-0">
            <h3 className="font-manrope font-semibold text-lg text-on-surface">{title}</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
