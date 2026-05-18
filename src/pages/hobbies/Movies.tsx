import { useState, useMemo, useEffect, useRef } from 'react';
import TopBar from '../../components/layout/TopBar';
import Modal from '../../components/ui/Modal';
import { useHobbyStore } from '../../store/hobbyStore';
import type { MediaReview, WatchlistItem, MediaType, WatchStatus, MediaPriority } from '../../types';

// ─── Star rating ──────────────────────────────────────────────────────────────

function StarRating({ value, onChange, readonly }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
        <button key={n} disabled={readonly} onClick={() => onChange?.(n)}
          className={`text-[18px] ${readonly ? '' : 'hover:scale-110 transition-transform'}`}>
          <span className={`material-symbols-outlined text-[18px] ${n <= value ? 'text-amber-400 icon-fill' : 'text-outline'}`}>
            star
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Review Modal ─────────────────────────────────────────────────────────────

const COMMON_GENRES = ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Thriller', 'Romance', 'Documentary', 'Animation', 'Fantasy'];
const STATUS_OPTIONS: { value: WatchStatus; label: string }[] = [
  { value: 'watched', label: 'Watched' },
  { value: 'watching', label: 'Watching' },
  { value: 'dropped', label: 'Dropped' },
];

function ReviewModal({ open, onClose, review }: { open: boolean; onClose: () => void; review?: MediaReview | null }) {
  const { addReview, updateReview, deleteReview } = useHobbyStore();

  const [title, setTitle]   = useState('');
  const [type, setType]     = useState<MediaType>('movie');
  const [status, setStatus] = useState<WatchStatus>('watched');
  const [rating, setRating] = useState(7);
  const [reviewText, setReviewText] = useState('');
  const [genres, setGenres] = useState<string[]>([]);
  const [year, setYear]     = useState('');
  const [seasons, setSeasons] = useState('');
  const [watchedDate, setWatchedDate] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCoverImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!open) return;
    if (review) {
      setTitle(review.title); setType(review.type); setStatus(review.status);
      setRating(review.rating); setReviewText(review.review); setGenres(review.genres);
      setYear(review.year?.toString() ?? ''); setSeasons(review.seasons?.toString() ?? '');
      setWatchedDate(review.watchedDate ?? '');
    } else {
      setTitle(''); setType('movie'); setStatus('watched'); setRating(7);
      setReviewText(''); setGenres([]); setYear(''); setSeasons(''); setWatchedDate('');
    }
    setCoverImage(review?.images?.[0] ?? null);
    setConfirmDelete(false);
  }, [open]);

  const toggleGenre = (g: string) =>
    setGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);

  const handleSave = () => {
    const existingExtra = (review?.images ?? []).slice(1);
    const images = coverImage ? [coverImage, ...existingExtra] : existingExtra;
    const payload = {
      title, type, status, rating, review: reviewText, images,
      genres, year: year ? parseInt(year) : undefined,
      seasons: seasons ? parseInt(seasons) : undefined,
      watchedDate: watchedDate || undefined,
    };
    if (review) updateReview(review.id, payload);
    else addReview(payload);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={review ? 'Edit Review' : 'Add Review'} size="sm">
      <div className="flex flex-col">
        <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Cover Photo */}
          <div className="space-y-1">
            <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Cover Photo</label>
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
            {coverImage ? (
              <div className="relative w-20 h-28">
                <img src={coverImage} alt="Cover" className="w-full h-full object-cover rounded-xl" />
                <button type="button" onClick={() => setCoverImage(null)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-error rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-error text-[12px]">close</span>
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => coverInputRef.current?.click()}
                className="w-20 h-28 border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center gap-1 hover:border-primary/50 transition-colors">
                <span className="material-symbols-outlined text-[22px] text-on-surface-variant">add_photo_alternate</span>
                <span className="font-inter text-[10px] text-on-surface-variant">Cover</span>
              </button>
            )}
          </div>

          <div className="space-y-1">
            <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Movie or series name"
              className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none focus:border-primary/50" />
          </div>

          <div className="flex gap-2">
            {(['movie', 'series'] as MediaType[]).map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`flex-1 py-2 rounded-lg font-inter text-sm font-medium capitalize transition-colors ${type === t ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                {t}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {STATUS_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setStatus(opt.value)}
                className={`flex-1 py-1.5 rounded-lg font-inter text-xs font-medium transition-colors ${status === opt.value ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-surface-container text-on-surface-variant'}`}>
                {opt.label}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Rating</label>
            <div className="flex items-center gap-3">
              <StarRating value={rating} onChange={setRating} />
              <span className="font-manrope font-bold text-lg text-primary">{rating}/10</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Review</label>
            <textarea value={reviewText} onChange={e => setReviewText(e.target.value)} rows={3}
              placeholder="Your thoughts..."
              className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none focus:border-primary/50 resize-none" />
          </div>

          <div className="space-y-1">
            <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Genres</label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_GENRES.map(g => (
                <button key={g} onClick={() => toggleGenre(g)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-inter font-medium transition-colors ${genres.includes(g) ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Year</label>
              <input type="number" value={year} onChange={e => setYear(e.target.value)} placeholder="2024"
                className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none" />
            </div>
            {type === 'series' ? (
              <div className="space-y-1">
                <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Seasons</label>
                <input type="number" value={seasons} onChange={e => setSeasons(e.target.value)} placeholder="3"
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none" />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Watch Date</label>
                <input type="date" value={watchedDate} onChange={e => setWatchedDate(e.target.value)}
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none" />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center px-5 py-4 border-t border-outline-variant/20 shrink-0">
          {review ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="font-inter text-xs text-error">Delete?</span>
                <button onClick={() => { deleteReview(review.id); onClose(); }}
                  className="px-3 py-1.5 rounded-lg bg-error text-on-error font-inter text-xs font-medium">Yes</button>
                <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-on-surface-variant font-inter text-xs">No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="p-2 text-on-surface-variant hover:text-error">
                <span className="material-symbols-outlined text-[20px]">delete</span>
              </button>
            )
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-on-surface-variant font-inter text-sm hover:bg-surface-container">Cancel</button>
            <button onClick={handleSave} disabled={!title}
              className="px-4 py-2 rounded-lg bg-primary text-on-primary font-inter font-medium text-sm disabled:opacity-50">
              {review ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Watchlist Modal ──────────────────────────────────────────────────────────

function WatchlistModal({ open, onClose, item }: { open: boolean; onClose: () => void; item?: WatchlistItem | null }) {
  const { addWatchlistItem, updateWatchlistItem, deleteWatchlistItem, moveToReview } = useHobbyStore();

  const [title, setTitle]       = useState('');
  const [type, setType]         = useState<MediaType>('movie');
  const [reason, setReason]     = useState('');
  const [priority, setPriority] = useState<MediaPriority>('medium');
  const [genres, setGenres]     = useState<string[]>([]);
  const [markWatched, setMarkWatched] = useState(false);
  const [watchRating, setWatchRating] = useState(7);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setTitle(item.title); setType(item.type); setReason(item.reason);
      setPriority(item.priority); setGenres(item.genres);
    } else {
      setTitle(''); setType('movie'); setReason(''); setPriority('medium'); setGenres([]);
    }
    setMarkWatched(false); setWatchRating(7); setConfirmDelete(false);
  }, [open]);

  const toggleGenre = (g: string) =>
    setGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);

  const handleSave = () => {
    if (markWatched && item) {
      moveToReview(item.id, watchRating, '', 'watched', new Date().toISOString().slice(0, 10));
    } else if (item) {
      updateWatchlistItem(item.id, { title, type, reason, priority, genres });
    } else {
      addWatchlistItem({ title, type, reason, priority, genres });
    }
    onClose();
  };

  const priorityColors: Record<MediaPriority, string> = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-surface-container text-on-surface-variant border-outline-variant/30',
  };

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Edit Watchlist' : 'Add to Watchlist'} size="sm">
      <div className="p-5 space-y-4">
        <div className="space-y-1">
          <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Movie or series name"
            className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none focus:border-primary/50" />
        </div>

        <div className="flex gap-2">
          {(['movie', 'series'] as MediaType[]).map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`flex-1 py-2 rounded-lg font-inter text-sm font-medium capitalize ${type === t ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Why watch it?</label>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. recommended by friend"
            className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none" />
        </div>

        <div className="space-y-1">
          <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Priority</label>
          <div className="flex gap-2">
            {(['high', 'medium', 'low'] as MediaPriority[]).map(p => (
              <button key={p} onClick={() => setPriority(p)}
                className={`flex-1 py-1.5 rounded-lg font-inter text-xs font-medium capitalize border transition-colors ${priority === p ? priorityColors[p] : 'bg-surface-container text-on-surface-variant border-transparent'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Genres</label>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_GENRES.map(g => (
              <button key={g} onClick={() => toggleGenre(g)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-inter font-medium ${genres.includes(g) ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                {g}
              </button>
            ))}
          </div>
        </div>

        {item && (
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`w-10 h-6 rounded-full transition-colors ${markWatched ? 'bg-primary' : 'bg-surface-container'}`}
              onClick={() => setMarkWatched(v => !v)}>
              <div className={`w-5 h-5 rounded-full bg-white dark:bg-gray-200 shadow m-0.5 transition-transform ${markWatched ? 'translate-x-4' : ''}`} />
            </div>
            <span className="font-inter text-sm text-on-surface">Mark as watched</span>
          </label>
        )}

        {markWatched && (
          <div className="space-y-1">
            <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Quick Rating</label>
            <div className="flex items-center gap-3">
              <StarRating value={watchRating} onChange={setWatchRating} />
              <span className="font-manrope font-bold text-lg text-primary">{watchRating}/10</span>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center pt-2">
          {item ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="font-inter text-xs text-error">Remove?</span>
                <button onClick={() => { deleteWatchlistItem(item.id); onClose(); }}
                  className="px-3 py-1.5 rounded-lg bg-error text-on-error font-inter text-xs">Yes</button>
                <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-on-surface-variant font-inter text-xs">No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="p-2 text-on-surface-variant hover:text-error">
                <span className="material-symbols-outlined text-[20px]">delete</span>
              </button>
            )
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-on-surface-variant font-inter text-sm hover:bg-surface-container">Cancel</button>
            <button onClick={handleSave} disabled={!title}
              className="px-4 py-2 rounded-lg bg-primary text-on-primary font-inter font-medium text-sm disabled:opacity-50">
              {markWatched ? 'Move to Reviews' : item ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Review Card ──────────────────────────────────────────────────────────────

function ReviewCard({ review, onEdit }: { review: MediaReview; onEdit: () => void }) {
  const statusColor = { watched: 'text-tertiary', watching: 'text-primary', dropped: 'text-error' }[review.status];
  const coverImage = review.images?.[0];

  return (
    <button onClick={onEdit}
      className="w-full bg-surface-container-lowest rounded-xl p-4 shadow-sm text-left hover:bg-surface-container/50 active:scale-[0.99] transition-all">
      <div className="flex items-start gap-3">
        {coverImage && (
          <img src={coverImage} alt="" className="w-12 h-[68px] object-cover rounded-lg shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-inter text-[10px] text-on-surface-variant uppercase tracking-wide">
                  {review.type}
                </span>
                <span className={`font-inter text-[10px] font-semibold uppercase ${statusColor}`}>{review.status}</span>
              </div>
              <p className="font-manrope font-bold text-sm text-on-surface truncate">{review.title}</p>
              {review.year && <p className="font-inter text-xs text-outline">{review.year}{review.seasons ? ` · ${review.seasons}S` : ''}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="material-symbols-outlined text-[16px] text-amber-400 icon-fill">star</span>
              <span className="font-manrope font-bold text-base text-on-surface">{review.rating}</span>
              <span className="font-inter text-xs text-outline">/10</span>
            </div>
          </div>
          {review.review && (
            <p className="font-inter text-xs text-on-surface-variant mt-2 line-clamp-2">{review.review}</p>
          )}
          {review.genres.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {review.genres.slice(0, 3).map(g => (
                <span key={g} className="px-2 py-0.5 bg-surface-container rounded-full font-inter text-[10px] text-on-surface-variant">{g}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'reviews' | 'watchlist';

export default function Movies() {
  const { reviews, watchlist } = useHobbyStore();
  const [tab, setTab] = useState<Tab>('reviews');
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [editReview, setEditReview] = useState<MediaReview | null>(null);
  const [editWatchlist, setEditWatchlist] = useState<WatchlistItem | null>(null);
  const [filter, setFilter] = useState<'all' | 'movie' | 'series'>('all');
  const [sortRating, setSortRating] = useState(false);

  const filteredReviews = useMemo(() => {
    let list = filter === 'all' ? reviews : reviews.filter(r => r.type === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => r.title.toLowerCase().includes(q));
    }
    if (sortRating) list = [...list].sort((a, b) => b.rating - a.rating);
    return list;
  }, [reviews, filter, sortRating, searchQuery]);

  const filteredWatchlist = useMemo(() => {
    let list = filter === 'all' ? watchlist : watchlist.filter(w => w.type === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(w => w.title.toLowerCase().includes(q));
    }
    return list;
  }, [watchlist, filter, searchQuery]);

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="bg-background min-h-screen">
      <TopBar title="Movies & Series" showBack />

      <main className="max-w-screen-xl mx-auto px-4 py-4 pb-28 space-y-4">

        {/* Stats row */}
        {reviews.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-surface-container-lowest rounded-xl p-3 text-center shadow-sm">
              <p className="font-manrope font-bold text-xl text-on-surface">{reviews.length}</p>
              <p className="font-inter text-[10px] text-outline">Reviews</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-3 text-center shadow-sm">
              <p className="font-manrope font-bold text-xl text-amber-500">{avgRating}</p>
              <p className="font-inter text-[10px] text-outline">Avg Rating</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-3 text-center shadow-sm">
              <p className="font-manrope font-bold text-xl text-on-surface">{watchlist.length}</p>
              <p className="font-inter text-[10px] text-outline">Watchlist</p>
            </div>
          </div>
        )}

        {/* Search bar */}
        <div className="flex items-center gap-2 bg-surface-container-lowest rounded-xl px-3 h-10 border border-outline-variant/20">
          <span className="material-symbols-outlined text-[16px] text-outline shrink-0">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by title..."
            className="flex-1 bg-transparent font-inter text-sm text-on-surface placeholder:text-outline outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="shrink-0">
              <span className="material-symbols-outlined text-[16px] text-outline">close</span>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex bg-surface-container rounded-xl p-1 gap-1">
          {(['reviews', 'watchlist'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg font-inter text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'}`}>
              {t} {t === 'reviews' ? `(${reviews.length})` : `(${watchlist.length})`}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 items-center">
          <div className="flex gap-1">
            {(['all', 'movie', 'series'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full font-inter text-xs font-medium capitalize transition-colors ${filter === f ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                {f}
              </button>
            ))}
          </div>
          {tab === 'reviews' && (
            <button onClick={() => setSortRating(v => !v)} className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-inter text-on-surface-variant bg-surface-container">
              <span className="material-symbols-outlined text-[14px]">sort</span>
              {sortRating ? 'By rating' : 'Recent'}
            </button>
          )}
        </div>

        {/* Content */}
        {tab === 'reviews' ? (
          filteredReviews.length > 0 ? (
            <div className="space-y-3">
              {filteredReviews.map(r => (
                <ReviewCard key={r.id} review={r} onEdit={() => { setEditReview(r); setReviewOpen(true); }} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-[48px] text-outline mb-3">movie</span>
              <p className="font-inter text-sm text-on-surface-variant">No reviews yet</p>
            </div>
          )
        ) : (
          watchlist.length > 0 ? (
            <div className="space-y-2">
              {filteredWatchlist.map(w => (
                <button key={w.id} onClick={() => { setEditWatchlist(w); setWatchlistOpen(true); }}
                  className="w-full flex items-center gap-3 bg-surface-container-lowest rounded-xl px-4 py-3 shadow-sm text-left hover:bg-surface-container/50 active:scale-[0.99] transition-all">
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
                    {w.type === 'movie' ? 'local_movies' : 'tv'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-inter font-semibold text-sm text-on-surface truncate">{w.title}</p>
                    {w.reason && <p className="font-inter text-xs text-outline truncate">{w.reason}</p>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full font-inter text-[10px] font-medium capitalize
                    ${w.priority === 'high' ? 'bg-red-100 text-red-700' : w.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-surface-container text-on-surface-variant'}`}>
                    {w.priority}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-[48px] text-outline mb-3">bookmark</span>
              <p className="font-inter text-sm text-on-surface-variant">Watchlist is empty</p>
            </div>
          )
        )}
      </main>

      {/* FABs */}
      <div className="fixed right-4 z-40 flex flex-col gap-3"
        style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>
        <button onClick={() => { setEditWatchlist(null); setWatchlistOpen(true); }}
          className="w-12 h-12 bg-surface-container-lowest rounded-full shadow-fab flex items-center justify-center border border-outline-variant/20 hover:scale-105 active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-[22px] text-on-surface-variant">bookmark_add</span>
        </button>
        <button onClick={() => { setEditReview(null); setReviewOpen(true); }}
          className="w-14 h-14 bg-primary text-on-primary rounded-full shadow-fab flex items-center justify-center hover:scale-105 active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-[26px]">add</span>
        </button>
      </div>

      <ReviewModal open={reviewOpen} onClose={() => { setReviewOpen(false); setEditReview(null); }} review={editReview} />
      <WatchlistModal open={watchlistOpen} onClose={() => { setWatchlistOpen(false); setEditWatchlist(null); }} item={editWatchlist} />
    </div>
  );
}
