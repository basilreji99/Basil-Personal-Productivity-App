import { useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import { useHobbyStore } from '../store/hobbyStore';
import { useFitnessStore } from '../store/fitnessStore';

const CATEGORIES = [
  {
    path: '/hobbies/music',
    icon: 'music_note',
    label: 'Music',
    description: 'Spotify stats and listening history',
    color: '#22c55e',
    bg: 'bg-green-50',
    border: 'border-green-100',
  },
  {
    path: '/hobbies/drawing',
    icon: 'palette',
    label: 'Drawing & Painting',
    description: 'Artwork gallery and progress',
    color: '#8b5cf6',
    bg: 'bg-violet-50',
    border: 'border-violet-100',
  },
  {
    path: '/hobbies/movies',
    icon: 'movie',
    label: 'Movies & Series',
    description: 'Reviews, ratings, and watchlist',
    color: '#ef4444',
    bg: 'bg-red-50',
    border: 'border-red-100',
  },
  {
    path: '/hobbies/fitness',
    icon: 'fitness_center',
    label: 'Fitness & Sports',
    description: 'Gym sessions and sports history',
    color: '#f97316',
    bg: 'bg-orange-50',
    border: 'border-orange-100',
  },
];

export default function Hobbies() {
  const navigate = useNavigate();
  const { reviews, watchlist, artworks } = useHobbyStore();
  const { gymSessions, sportSessions } = useFitnessStore();

  const counts = [
    reviews.length > 0 ? `${reviews.filter(r => r.rating >= 8).length} highly rated` : 'No data yet',
    `${artworks.length} pieces`,
    `${reviews.length} reviews · ${watchlist.length} watchlist`,
    `${gymSessions.length} gym · ${sportSessions.length} sport`,
  ];

  return (
    <div className="bg-background min-h-screen">
      <TopBar title="Hobbies" />

      <main className="max-w-screen-xl mx-auto px-4 py-6 pb-28 space-y-4">
        <div className="space-y-3">
          {CATEGORIES.map(({ path, icon, label, description, color, bg, border }, i) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border ${bg} ${border} hover:scale-[1.01] active:scale-[0.99] transition-transform shadow-sm text-left`}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + '20' }}>
                <span className="material-symbols-outlined text-[26px]" style={{ color }}>{icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-manrope font-bold text-base text-on-surface">{label}</p>
                <p className="font-inter text-xs text-on-surface-variant mt-0.5">{description}</p>
                <p className="font-inter text-[10px] mt-1" style={{ color }}>{counts[i]}</p>
              </div>
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant shrink-0">chevron_right</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
