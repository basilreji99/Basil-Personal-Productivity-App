const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  Design: { bg: 'bg-tertiary/10', text: 'text-tertiary' },
  Dev: { bg: 'bg-primary/10', text: 'text-primary' },
  Marketing: { bg: 'bg-secondary/10', text: 'text-secondary' },
  Personal: { bg: 'bg-pink-100', text: 'text-pink-600' },
  Work: { bg: 'bg-blue-100', text: 'text-blue-600' },
  Shopping: { bg: 'bg-amber-100', text: 'text-amber-700' },
  Health: { bg: 'bg-green-100', text: 'text-green-700' },
  Finance: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  Productivity: { bg: 'bg-violet-100', text: 'text-violet-700' },
  Growth: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  Urgent: { bg: 'bg-red-100', text: 'text-red-600' },
  Ideas: { bg: 'bg-orange-100', text: 'text-orange-600' },
};

function getTagColors(tag: string) {
  if (TAG_COLORS[tag]) return TAG_COLORS[tag];
  // Hash-based fallback
  const palettes = [
    { bg: 'bg-indigo-100', text: 'text-indigo-700' },
    { bg: 'bg-rose-100', text: 'text-rose-600' },
    { bg: 'bg-teal-100', text: 'text-teal-700' },
    { bg: 'bg-sky-100', text: 'text-sky-700' },
    { bg: 'bg-lime-100', text: 'text-lime-700' },
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
