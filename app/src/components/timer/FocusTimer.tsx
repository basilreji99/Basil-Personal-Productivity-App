import { useEffect } from 'react';
import { useTimerStore } from '../../store/timerStore';
import { formatTime } from '../../utils/dateUtils';
import type { TimerMode } from '../../types';

const MODE_LABELS: Record<TimerMode, string> = {
  work: 'Focus',
  short_break: 'Short Break',
  long_break: 'Long Break',
};

const MODE_COLORS: Record<TimerMode, string> = {
  work: 'text-primary',
  short_break: 'text-tertiary',
  long_break: 'text-secondary',
};

const MODE_BG: Record<TimerMode, string> = {
  work: 'bg-primary/10',
  short_break: 'bg-tertiary/10',
  long_break: 'bg-secondary/10',
};

interface FocusTimerProps {
  compact?: boolean;
}

export default function FocusTimer({ compact = false }: FocusTimerProps) {
  const { mode, timeLeft, isRunning, pomodoroCount, currentTaskTitle, customDurations, setMode, start, pause, reset, tick } =
    useTimerStore();

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isRunning, tick]);

  const progress = 1 - timeLeft / customDurations[mode];
  const circumference = 2 * Math.PI * 44;

  if (compact) {
    return (
      <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${MODE_BG[mode]}`}>
        <span className={`material-symbols-outlined text-[20px] ${MODE_COLORS[mode]}`}>timer</span>
        <div className="flex-1">
          <p className={`font-inter font-bold text-sm ${MODE_COLORS[mode]}`}>{formatTime(timeLeft)}</p>
          <p className="font-inter text-xs text-on-surface-variant">{MODE_LABELS[mode]}{currentTaskTitle ? ` · ${currentTaskTitle}` : ''}</p>
        </div>
        <button
          onClick={isRunning ? pause : start}
          className={`w-8 h-8 rounded-full flex items-center justify-center ${MODE_COLORS[mode]} hover:opacity-80 transition-opacity`}
        >
          <span className="material-symbols-outlined text-[20px]">{isRunning ? 'pause' : 'play_arrow'}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-card">
      {/* Mode tabs */}
      <div className="flex gap-1 bg-surface-container rounded-xl p-1 mb-6">
        {(['work', 'short_break', 'long_break'] as TimerMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-1.5 rounded-lg font-inter font-medium text-xs transition-all duration-200 ${
              mode === m
                ? 'bg-surface-container-lowest shadow-sm text-on-surface'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Circle timer */}
      <div className="flex flex-col items-center gap-4 mb-6">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="6" className="text-surface-container" />
            <circle
              cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="6"
              className={MODE_COLORS[mode]}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`font-manrope font-bold text-2xl ${MODE_COLORS[mode]}`}>{formatTime(timeLeft)}</span>
            <span className="font-inter text-[10px] text-on-surface-variant uppercase tracking-wider">{MODE_LABELS[mode]}</span>
          </div>
        </div>

        {currentTaskTitle && (
          <p className="font-inter text-xs text-on-surface-variant text-center">
            <span className="material-symbols-outlined text-[12px] mr-1">task_alt</span>
            {currentTaskTitle}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <button onClick={reset} className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors">
          <span className="material-symbols-outlined text-[22px]">replay</span>
        </button>
        <button
          onClick={isRunning ? pause : start}
          className={`w-16 h-16 rounded-full flex items-center justify-center text-on-primary shadow-fab transition-all duration-200 hover:scale-105 active:scale-95 ${
            mode === 'work' ? 'bg-primary' : mode === 'short_break' ? 'bg-tertiary' : 'bg-secondary'
          }`}
        >
          <span className="material-symbols-outlined text-[32px] icon-fill">{isRunning ? 'pause' : 'play_arrow'}</span>
        </button>
        <div className="w-10 h-10 rounded-full flex items-center justify-center">
          <span className="font-inter text-xs text-on-surface-variant font-bold">#{pomodoroCount}</span>
        </div>
      </div>
    </div>
  );
}
