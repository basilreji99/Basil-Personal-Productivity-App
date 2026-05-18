const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  Design:      { bg: 'bg-tertiary/10',                                    text: 'text-tertiary' },
  Dev:         { bg: 'bg-primary/10',                                     text: 'text-primary' },
  Marketing:   { bg: 'bg-secondary/10',                                   text: 'text-secondary' },
  Personal:    { bg: 'bg-pink-100 dark:bg-pink-950/40',                   text: 'text-pink-600 dark:text-pink-400' },
  Work:        { bg: 'bg-blue-100 dark:bg-blue-950/40',                   text: 'text-blue-600 dark:text-blue-400' },
  Shopping:    { bg: 'bg-amber-100 dark:bg-amber-950/40',                 text: 'text-amber-700 dark:text-amber-400' },
  Health:      { bg: 'bg-green-100 dark:bg-green-950/40',                 text: 'text-green-700 dark:text-green-400' },
  Finance:     { bg: 'bg-cyan-100 dark:bg-cyan-950/40',                   text: 'text-cyan-700 dark:text-cyan-400' },
  Productivity:{ bg: 'bg-violet-100 dark:bg-violet-950/40',               text: 'text-violet-700 dark:text-violet-400' },
  Growth:      { bg: 'bg-emerald-100 dark:bg-emerald-950/40',             text: 'text-emerald-700 dark:text-emerald-400' },
  Urgent:      { bg: 'bg-red-100 dark:bg-red-950/40',                     text: 'text-red-600 dark:text-red-400' },
  Ideas:       { bg: 'bg-orange-100 dark:bg-orange-950/40',               text: 'text-orange-600 dark:text-orange-400' },
};

function getTagColors(tag: string) {
  if (TAG_COLORS[tag]) return TAG_COLORS[tag];
  const palettes = [
    { bg: 'bg-indigo-100 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-400' },
    { bg: 'bg-rose-100 dark:bg-rose-950/40',     text: 'text-rose-600 dark:text-rose-400' },
    { bg: 'bg-teal-100 dark:bg-teal-950/40',     text: 'text-teal-700 dark:text-teal-400' },
    { bg: 'bg-sky-100 dark:bg-sky-950/40',       text: 'text-sky-700 dark:text-sky-400' },
    { bg: 'bg-lime-100 dark:bg-lime-950/40',     text: 'text-lime-700 dark:text-lime-400' },
  ];
  let hash = 0;
  for (const c of tag) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return palettes[Math.abs(hash) % palettes.length];
}

interface TagChipProps {
  tag: string;
  onRemove?: () => void;
  size?: 'sm' | 'md';
  onClick?: () => void;
  active?: boolean;
}

export default function TagChip({ tag, onRemove, size = 'md', onClick, active }: TagChipProps) {
  const colors = getTagColors(tag);
  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-inter font-semibold uppercase tracking-wide transition-colors ${sizeClass} ${
        active
          ? `bg-primary text-on-primary`
          : `${colors.bg} ${colors.text}`
      } ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
      onClick={onClick}
    >
      {tag}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 hover:opacity-70"
        >
          <span className="material-symbols-outlined text-[12px]">close</span>
        </button>
      )}
    </span>
  );
}
