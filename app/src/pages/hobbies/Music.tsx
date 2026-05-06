import { useState, useEffect, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import TopBar from '../../components/layout/TopBar';
import { useHobbyStore } from '../../store/hobbyStore';
import {
  openSpotifyAuth,
  getTopTracks,
  getTopArtists,
  getRecentlyPlayed,
  getArtistDetails,
} from '../../services/spotifyAuth';

type TimeRange = 'short_term' | 'medium_term' | 'long_term';
const TIME_LABELS: Record<TimeRange, string> = {
  short_term: '4 Weeks',
  medium_term: '6 Months',
  long_term: 'All Time',
};

type Tab = 'stats' | 'trends';

function msToMinSec(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const GENRE_COLORS = ['#22c55e','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#a78bfa'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildGenreMap(artists: any[]): { name: string; count: number }[] {
  const counts: Record<string, number> = {};
  artists.forEach(a => (a.genres ?? []).forEach((g: string) => { counts[g] = (counts[g] ?? 0) + 1; }));
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
}

function artistImg(a: any) {
  return a.images?.[2]?.url ?? a.images?.[0]?.url;
}

function trackImg(t: any) {
  return t.album?.images?.[2]?.url ?? t.album?.images?.[0]?.url;
}

// ─── Small UI pieces ──────────────────────────────────────────────────────────


function Section({ title, icon, children, total, expanded, onToggle }: {
  title: string; icon: string; children: React.ReactNode;
  total: number; expanded: boolean; onToggle: () => void;
}) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-card">
      <div className="px-4 py-3 border-b border-outline-variant/20 flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-primary">{icon}</span>
        <p className="font-inter font-semibold text-sm text-on-surface flex-1">{title}</p>
        {total > 5 && (
          <button onClick={onToggle} className="font-inter text-xs text-primary font-semibold">
            {expanded ? 'Show less' : `+${total - 5} more`}
          </button>
        )}
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  );
}

function TrackRow({ track, rank }: { track: any; rank: number }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-outline-variant/10 last:border-0">
      <span className="font-manrope font-bold text-sm text-outline w-5 text-center shrink-0">{rank}</span>
      {trackImg(track) ? (
        <img src={trackImg(track)} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[16px] text-outline">music_note</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-inter font-semibold text-sm text-on-surface truncate">{track.name}</p>
        <p className="font-inter text-xs text-outline truncate">{track.artists?.map((a: any) => a.name).join(', ')}</p>
      </div>
      <span className="font-inter text-[10px] text-outline shrink-0">{msToMinSec(track.duration_ms)}</span>
    </div>
  );
}

function ArtistRow({ artist, rank, badge }: { artist: any; rank: number; badge?: { label: string; color: string } }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-outline-variant/10 last:border-0">
      <span className="font-manrope font-bold text-sm text-outline w-5 text-center shrink-0">{rank}</span>
      {artistImg(artist) ? (
        <img src={artistImg(artist)} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[16px] text-outline">person</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-inter font-semibold text-sm text-on-surface truncate">{artist.name}</p>
        {artist.genres?.length > 0 && (
          <p className="font-inter text-xs text-outline truncate">{artist.genres.slice(0, 2).join(', ')}</p>
        )}
      </div>
      {badge ? (
        <span className="font-inter text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: badge.color + '20', color: badge.color }}>
          {badge.label}
        </span>
      ) : artist.popularity !== undefined ? (
        <div className="flex items-center gap-0.5 shrink-0">
          <span className="material-symbols-outlined text-[12px] text-amber-400 icon-fill">star</span>
          <span className="font-inter text-xs text-outline">{artist.popularity}</span>
        </div>
      ) : null}
    </div>
  );
}

// ─── Trend card ───────────────────────────────────────────────────────────────

function TrendPill({ label, color, icon }: { label: string; color: string; icon: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-inter text-[10px] font-semibold"
      style={{ background: color + '20', color }}>
      <span className="material-symbols-outlined text-[11px]">{icon}</span>
      {label}
    </span>
  );
}

// ─── Connect screen ───────────────────────────────────────────────────────────

function ConnectScreen() {
  const isNative = Capacitor.isNativePlatform();
  return (
    <div className="bg-background min-h-screen">
      <TopBar title="Music" showBack />
      <main className="max-w-screen-xl mx-auto px-4 py-12 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-[40px] text-green-600">music_note</span>
        </div>
        <h2 className="font-manrope font-bold text-xl text-on-surface mb-2">Connect Spotify</h2>
        {isNative ? (
          <>
            <p className="font-inter text-sm text-on-surface-variant mb-6 max-w-xs mx-auto">
              See your top tracks, artists, genres and taste trends.
            </p>
            <button onClick={openSpotifyAuth}
              className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-full font-inter font-semibold text-sm mx-auto hover:bg-green-600 active:scale-95 transition-all">
              <span className="material-symbols-outlined text-[20px]">open_in_new</span>
              Connect with Spotify
            </button>
            <p className="font-inter text-xs text-outline mt-4">Read-only access. Free account works.</p>
          </>
        ) : (
          <p className="font-inter text-sm text-on-surface-variant max-w-xs mx-auto">
            Spotify connection is only available in the Android app.
          </p>
        )}
      </main>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface AllRangeData {
  short: any[];
  medium: any[];
  long: any[];
}

export default function Music() {
  const { spotifyToken, spotifyRefreshToken, isSpotifyValid, clearSpotifyToken, ensureSpotifyToken } = useHobbyStore();
  const connected = isSpotifyValid() || !!spotifyRefreshToken;

  const [tab, setTab]           = useState<Tab>('stats');
  const [timeRange, setTimeRange] = useState<TimeRange>('short_term');

  // Per-range data for the stats tab
  const [stats, setStats] = useState<{ tracks: any[]; artists: any[]; allArtistMap: Record<string, any>; recent: any[] } | null>(null);
  // All-range data for the trends tab
  const [allArtists, setAllArtists] = useState<AllRangeData | null>(null);
  const [allTracks,  setAllTracks]  = useState<AllRangeData | null>(null);

  const [loadingStats,  setLoadingStats]  = useState(false);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [error, setError] = useState('');

  const [tracksExpanded, setTracksExpanded] = useState(false);
  const [recentExpanded, setRecentExpanded] = useState(false);

  // Fetch per-range stats (auto-refreshes token if expired)
  useEffect(() => {
    if (!connected) return;
    setLoadingStats(true);
    setError('');
    ensureSpotifyToken().then(async token => {
      if (!token) { setError('Session expired. Please reconnect Spotify.'); setLoadingStats(false); return; }
      try {
        const [tr, ar, rr] = await Promise.all([
          getTopTracks(token, timeRange),
          getTopArtists(token, timeRange),
          getRecentlyPlayed(token),
        ]);
        const topTracks:  any[] = tr?.items ?? [];
        const topArtists: any[] = ar?.items ?? [];
        // Fetch full artist details for track artists not already in top-artists
        // so genre → track mapping works for all tracks, not just those with top-artists
        const topArtistIds = new Set(topArtists.map((a: any) => a.id));
        const extraIds = [...new Set(
          topTracks.flatMap((t: any) => (t.artists ?? []).map((a: any) => a.id as string))
        )].filter(id => !topArtistIds.has(id));
        const extraArtists = await getArtistDetails(token, extraIds);
        setStats({
          tracks:       topTracks,
          artists:      topArtists,
          allArtistMap: Object.fromEntries(
            [...topArtists, ...extraArtists].filter(Boolean).map((a: any) => [a.id, a])
          ),
          recent: (rr?.items ?? []).filter((i: any) => i?.track?.album).map((i: any) => i.track),
        });
      } catch { setError('Failed to load Spotify data.'); }
      finally { setLoadingStats(false); }
    });
  }, [connected, spotifyToken, timeRange]);

  // Fetch all 3 ranges for trends (auto-refreshes token if expired)
  useEffect(() => {
    if (!connected) return;
    setLoadingTrends(true);
    ensureSpotifyToken().then(token => {
      if (!token) { setLoadingTrends(false); return; }
      Promise.all([
        getTopArtists(token, 'short_term'),
        getTopArtists(token, 'medium_term'),
        getTopArtists(token, 'long_term'),
        getTopTracks(token, 'short_term'),
        getTopTracks(token, 'medium_term'),
        getTopTracks(token, 'long_term'),
      ]).then(([as, am, al, ts, tm, tl]) => {
        setAllArtists({ short: as?.items ?? [], medium: am?.items ?? [], long: al?.items ?? [] });
        setAllTracks({  short: ts?.items ?? [], medium: tm?.items ?? [], long: tl?.items ?? [] });
      }).finally(() => setLoadingTrends(false));
    });
  }, [connected, spotifyToken]);

  // Trend calculations
  const artistTrends = useMemo(() => {
    if (!allArtists) return { rising: [], consistent: [], classic: [] };
    const shortIds  = new Set(allArtists.short.slice(0, 10).map((a: any) => a.id));
    const mediumIds = new Set(allArtists.medium.slice(0, 10).map((a: any) => a.id));
    const longIds   = new Set(allArtists.long.slice(0, 10).map((a: any) => a.id));

    const rising:     any[] = [];
    const consistent: any[] = [];
    const classic:    any[] = [];

    allArtists.short.slice(0, 15).forEach(a => {
      if (longIds.has(a.id) && mediumIds.has(a.id)) consistent.push(a);
      else if (!longIds.has(a.id)) rising.push(a);
    });
    allArtists.long.slice(0, 15).forEach(a => {
      if (!shortIds.has(a.id) && !mediumIds.has(a.id)) classic.push(a);
    });

    return { rising: rising.slice(0, 5), consistent: consistent.slice(0, 5), classic: classic.slice(0, 5) };
  }, [allArtists]);

  const trackTrends = useMemo(() => {
    if (!allTracks) return { rising: [], consistent: [], classic: [] };
    const shortIds  = new Set(allTracks.short.slice(0, 10).map((t: any) => t.id));
    const mediumIds = new Set(allTracks.medium.slice(0, 10).map((t: any) => t.id));
    const longIds   = new Set(allTracks.long.slice(0, 10).map((t: any) => t.id));

    const rising:     any[] = [];
    const consistent: any[] = [];
    const classic:    any[] = [];

    allTracks.short.slice(0, 15).forEach(t => {
      if (longIds.has(t.id) && mediumIds.has(t.id)) consistent.push(t);
      else if (!longIds.has(t.id)) rising.push(t);
    });
    allTracks.long.slice(0, 15).forEach(t => {
      if (!shortIds.has(t.id) && !mediumIds.has(t.id)) classic.push(t);
    });

    return { rising: rising.slice(0, 5), consistent: consistent.slice(0, 5), classic: classic.slice(0, 5) };
  }, [allTracks]);

  // Genre comparison across ranges
  const genreTrends = useMemo(() => {
    if (!allArtists) return [];
    const short  = buildGenreMap(allArtists.short).slice(0, 10).map(g => g.name);
    const long   = buildGenreMap(allArtists.long).slice(0, 10).map(g => g.name);
    return buildGenreMap([...allArtists.short, ...allArtists.medium, ...allArtists.long]).slice(0, 10).map(g => ({
      ...g,
      inShort: short.includes(g.name),
      inLong:  long.includes(g.name),
    }));
  }, [allArtists]);

  // All artists combined (top-artists + track artists with full genre data)
  const allArtistMap: Record<string, any> = stats?.allArtistMap ?? {};

  // Genres from ALL artists (top-artists + extra track artists)
  const genres = useMemo(() => buildGenreMap(Object.values(allArtistMap)).slice(0, 15), [allArtistMap]);
  const maxGenreCount = genres[0]?.count ?? 1;

  // genre → tracks (using full artist map so every track's artist genres are resolved)
  const genreTrackMap = useMemo(() => {
    const m: Record<string, any[]> = {};
    (stats?.tracks ?? []).forEach((t: any) => {
      const tGenres = new Set<string>();
      (t.artists ?? []).forEach((a: any) => {
        (allArtistMap[a.id]?.genres ?? []).forEach((g: string) => tGenres.add(g));
      });
      tGenres.forEach(g => { if (!m[g]) m[g] = []; m[g].push(t); });
    });
    return m;
  }, [stats?.tracks, allArtistMap]);

  // artistId → tracks
  const artistTrackMap = useMemo(() => {
    const m: Record<string, any[]> = {};
    (stats?.tracks ?? []).forEach((t: any) => {
      (t.artists ?? []).forEach((a: any) => {
        if (!m[a.id]) m[a.id] = [];
        m[a.id].push(t);
      });
    });
    return m;
  }, [stats?.tracks]);

  if (!connected) return <ConnectScreen />;

  const tracks = stats?.tracks ?? [];
  const artists = stats?.artists ?? [];
  const recent  = stats?.recent ?? [];

  const visibleTracks = tracksExpanded ? tracks.slice(0, 15) : tracks.slice(0, 5);
  const visibleRecent = recentExpanded ? recent.slice(0, 15) : recent.slice(0, 5);

  return (
    <div className="bg-background min-h-screen">
      <TopBar title="Music" showBack
        rightSlot={
          <button onClick={clearSpotifyToken}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container"
            title="Disconnect">
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>
        }
      />

      <main className="max-w-screen-xl mx-auto px-4 py-4 pb-28 space-y-4">

        {/* Tab switcher */}
        <div className="flex bg-surface-container rounded-xl p-1 gap-1">
          {(['stats', 'trends'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg font-inter text-sm font-semibold capitalize transition-colors ${tab === t ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'}`}>
              {t === 'stats' ? 'Statistics' : 'Taste Trends'}
            </button>
          ))}
        </div>

        {/* ── STATISTICS TAB ── */}
        {tab === 'stats' && (
          <>
            {/* Time range */}
            <div className="flex gap-1.5">
              {(Object.keys(TIME_LABELS) as TimeRange[]).map(t => (
                <button key={t} onClick={() => setTimeRange(t)}
                  className={`flex-1 py-2 rounded-xl font-inter text-xs font-semibold transition-colors ${timeRange === t ? 'bg-green-500 text-white shadow-sm' : 'bg-surface-container text-on-surface-variant'}`}>
                  {TIME_LABELS[t]}
                </button>
              ))}
            </div>

            {loadingStats ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-12 space-y-3">
                <p className="font-inter text-sm text-error">{error}</p>
                <button onClick={clearSpotifyToken} className="px-4 py-2 bg-surface-container text-on-surface rounded-xl font-inter text-sm">
                  Reconnect
                </button>
              </div>
            ) : (
              <>
                {/* Overview */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-surface-container-lowest rounded-xl p-3 text-center shadow-sm">
                    <p className="font-manrope font-bold text-xl text-green-500">{tracks.length}</p>
                    <p className="font-inter text-[10px] text-outline">Top Tracks</p>
                  </div>
                  <div className="bg-surface-container-lowest rounded-xl p-3 text-center shadow-sm">
                    <p className="font-manrope font-bold text-xl text-on-surface">{artists.length}</p>
                    <p className="font-inter text-[10px] text-outline">Top Artists</p>
                  </div>
                  <div className="bg-surface-container-lowest rounded-xl p-3 text-center shadow-sm">
                    <p className="font-manrope font-bold text-xl text-on-surface">{genres.length}</p>
                    <p className="font-inter text-[10px] text-outline">Genres</p>
                  </div>
                </div>

                {/* Highlight card */}
                {tracks.length > 0 && (() => {
                  const top = tracks[0];
                  const avgPop = Math.round(tracks.reduce((s: number, t: any) => s + (t.popularity ?? 0), 0) / tracks.length);
                  const avgDur = Math.round(tracks.reduce((s: number, t: any) => s + t.duration_ms, 0) / tracks.length);
                  return (
                    <div className="bg-gradient-to-r from-green-500/10 to-green-500/5 border border-green-500/20 rounded-2xl p-4">
                      <p className="font-inter text-xs font-semibold text-green-600 uppercase tracking-wider mb-3">
                        {TIME_LABELS[timeRange]} Highlights
                      </p>
                      <div className="flex items-center gap-3 mb-3">
                        {trackImg(top) && <img src={trackImg(top)} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />}
                        <div className="min-w-0">
                          <p className="font-inter text-[10px] text-green-600 font-semibold uppercase">#1 Track</p>
                          <p className="font-manrope font-bold text-sm text-on-surface truncate">{top.name}</p>
                          <p className="font-inter text-xs text-outline truncate">{top.artists?.map((a: any) => a.name).join(', ')}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-white/30 rounded-xl py-2">
                          <p className="font-manrope font-bold text-base text-on-surface">{avgPop}<span className="font-inter font-normal text-xs text-outline">/100</span></p>
                          <p className="font-inter text-[9px] text-outline">Avg Popularity</p>
                        </div>
                        <div className="bg-white/30 rounded-xl py-2">
                          <p className="font-manrope font-bold text-base text-on-surface">{msToMinSec(avgDur)}</p>
                          <p className="font-inter text-[9px] text-outline">Avg Track Length</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Top Genres with inline tracks ── */}
                {genres.length > 0 && (
                  <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-card">
                    <div className="px-4 py-3 border-b border-outline-variant/20 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-primary">category</span>
                      <p className="font-inter font-semibold text-sm text-on-surface flex-1">Top Genres</p>
                      <span className="font-inter text-xs text-outline">{TIME_LABELS[timeRange]}</span>
                    </div>
                    <div className="divide-y divide-outline-variant/10">
                      {genres.slice(0, 5).map(({ name, count }, i) => {
                        const color = GENRE_COLORS[i % GENRE_COLORS.length];
                        const genreTracks = (genreTrackMap[name] ?? []).slice(0, 5);
                        return (
                          <div key={name} className="px-4 py-3">
                            {/* Genre header */}
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-white font-inter font-bold text-[10px]"
                                style={{ background: color }}>{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-inter font-semibold text-sm text-on-surface capitalize truncate">{name}</p>
                              </div>
                              <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden max-w-[80px]">
                                <div className="h-full rounded-full" style={{ width: `${Math.round((count / maxGenreCount) * 100)}%`, background: color }} />
                              </div>
                              <span className="font-inter text-[10px] text-outline shrink-0">{count} artists</span>
                            </div>
                            {/* Tracks for this genre */}
                            {genreTracks.length > 0 ? (
                              <div className="space-y-1 ml-7">
                                {genreTracks.map((t: any, ti: number) => (
                                  <div key={`${t.id}-${ti}`} className="flex items-center gap-2 py-1">
                                    {trackImg(t) ? (
                                      <img src={trackImg(t)} alt="" className="w-7 h-7 rounded shrink-0 object-cover" />
                                    ) : (
                                      <div className="w-7 h-7 rounded bg-surface-container shrink-0 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-[12px] text-outline">music_note</span>
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="font-inter text-xs font-semibold text-on-surface truncate">{t.name}</p>
                                      <p className="font-inter text-[10px] text-outline truncate">{t.artists?.map((a: any) => a.name).join(', ')}</p>
                                    </div>
                                    <span className="font-inter text-[10px] text-outline shrink-0">{msToMinSec(t.duration_ms)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="font-inter text-[10px] text-outline ml-7 italic">No top tracks in this genre this period</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Top Artists with inline tracks ── */}
                {artists.length > 0 && (
                  <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-card">
                    <div className="px-4 py-3 border-b border-outline-variant/20 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-primary">groups</span>
                      <p className="font-inter font-semibold text-sm text-on-surface flex-1">Top Artists</p>
                      <span className="font-inter text-xs text-outline">{TIME_LABELS[timeRange]}</span>
                    </div>
                    <div className="divide-y divide-outline-variant/10">
                      {artists.slice(0, 5).map((a: any, i: number) => {
                        const artistTracks = (artistTrackMap[a.id] ?? []).slice(0, 5);
                        return (
                          <div key={a.id} className="px-4 py-3">
                            {/* Artist header */}
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-manrope font-bold text-sm text-outline w-5 text-center shrink-0">{i + 1}</span>
                              {artistImg(a) ? (
                                <img src={artistImg(a)} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center shrink-0">
                                  <span className="material-symbols-outlined text-[18px] text-outline">person</span>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-inter font-semibold text-sm text-on-surface truncate">{a.name}</p>
                                {a.genres?.length > 0 && (
                                  <p className="font-inter text-[10px] text-outline truncate capitalize">{a.genres.slice(0, 3).join(' · ')}</p>
                                )}
                              </div>
                              {a.popularity !== undefined && (
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <span className="material-symbols-outlined text-[12px] text-amber-400 icon-fill">star</span>
                                  <span className="font-inter text-xs text-outline">{a.popularity}</span>
                                </div>
                              )}
                            </div>
                            {/* Tracks for this artist */}
                            {artistTracks.length > 0 ? (
                              <div className="space-y-1 ml-8">
                                {artistTracks.map((t: any, ti: number) => (
                                  <div key={`${t.id}-${ti}`} className="flex items-center gap-2 py-1">
                                    {trackImg(t) ? (
                                      <img src={trackImg(t)} alt="" className="w-7 h-7 rounded shrink-0 object-cover" />
                                    ) : (
                                      <div className="w-7 h-7 rounded bg-surface-container shrink-0 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-[12px] text-outline">music_note</span>
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="font-inter text-xs font-semibold text-on-surface truncate">{t.name}</p>
                                      <p className="font-inter text-[10px] text-outline truncate">{t.artists?.map((ar: any) => ar.name).join(', ')}</p>
                                    </div>
                                    <span className="font-inter text-[10px] text-outline shrink-0">{msToMinSec(t.duration_ms)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="font-inter text-[10px] text-outline ml-8 italic">No top tracks from this artist this period</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Top Tracks (collapsible) */}
                {tracks.length > 0 && (
                  <Section title="All Top Tracks" icon="queue_music"
                    total={Math.min(tracks.length, 15)} expanded={tracksExpanded} onToggle={() => setTracksExpanded(v => !v)}>
                    {visibleTracks.map((t: any, i: number) => <TrackRow key={`${t.id}-${i}`} track={t} rank={i + 1} />)}
                  </Section>
                )}

                {/* Recently Played */}
                {recent.length > 0 && (
                  <Section title="Recently Played" icon="history"
                    total={Math.min(recent.length, 15)} expanded={recentExpanded} onToggle={() => setRecentExpanded(v => !v)}>
                    {visibleRecent.map((t: any, i: number) => <TrackRow key={`${t.id}-${i}`} track={t} rank={i + 1} />)}
                  </Section>
                )}
              </>
            )}
          </>
        )}

        {/* ── TRENDS TAB ── */}
        {tab === 'trends' && (
          <>
            {loadingTrends ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Legend */}
                <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-card space-y-2">
                  <p className="font-inter font-semibold text-sm text-on-surface mb-3">How trends work</p>
                  <div className="flex items-center gap-3">
                    <TrendPill label="Rising" color="#22c55e" icon="trending_up" />
                    <p className="font-inter text-xs text-on-surface-variant">New to your top 10 recently</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <TrendPill label="Consistent" color="#3b82f6" icon="verified" />
                    <p className="font-inter text-xs text-on-surface-variant">In your top 10 across all time ranges</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <TrendPill label="Classic" color="#f59e0b" icon="history_edu" />
                    <p className="font-inter text-xs text-on-surface-variant">All-time favourite, less played recently</p>
                  </div>
                  <p className="font-inter text-[10px] text-outline pt-1">
                    Spotify doesn't expose year-by-year data. This analysis compares your 4-week, 6-month and all-time top lists to show how your taste has shifted.
                  </p>
                </div>

                {/* Artist trends */}
                {(artistTrends.rising.length > 0 || artistTrends.consistent.length > 0 || artistTrends.classic.length > 0) && (
                  <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-card">
                    <div className="px-4 py-3 border-b border-outline-variant/20 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-primary">groups</span>
                      <p className="font-inter font-semibold text-sm text-on-surface">Artist Trends</p>
                    </div>
                    <div className="px-4 py-2">
                      {artistTrends.rising.length > 0 && (
                        <>
                          <div className="flex items-center gap-2 py-2">
                            <TrendPill label="Rising" color="#22c55e" icon="trending_up" />
                          </div>
                          {artistTrends.rising.map((a, i) => (
                            <ArtistRow key={a.id} artist={a} rank={i + 1} badge={{ label: '↑ New fave', color: '#22c55e' }} />
                          ))}
                        </>
                      )}
                      {artistTrends.consistent.length > 0 && (
                        <>
                          <div className="flex items-center gap-2 py-2 mt-1">
                            <TrendPill label="Consistent" color="#3b82f6" icon="verified" />
                          </div>
                          {artistTrends.consistent.map((a, i) => (
                            <ArtistRow key={a.id} artist={a} rank={i + 1} badge={{ label: '⭑ Always', color: '#3b82f6' }} />
                          ))}
                        </>
                      )}
                      {artistTrends.classic.length > 0 && (
                        <>
                          <div className="flex items-center gap-2 py-2 mt-1">
                            <TrendPill label="Classic" color="#f59e0b" icon="history_edu" />
                          </div>
                          {artistTrends.classic.map((a, i) => (
                            <ArtistRow key={a.id} artist={a} rank={i + 1} badge={{ label: '♦ Classic', color: '#f59e0b' }} />
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Track trends */}
                {(trackTrends.rising.length > 0 || trackTrends.consistent.length > 0 || trackTrends.classic.length > 0) && (
                  <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-card">
                    <div className="px-4 py-3 border-b border-outline-variant/20 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-primary">queue_music</span>
                      <p className="font-inter font-semibold text-sm text-on-surface">Track Trends</p>
                    </div>
                    <div className="px-4 py-2">
                      {trackTrends.rising.length > 0 && (
                        <>
                          <div className="flex items-center gap-2 py-2"><TrendPill label="Rising" color="#22c55e" icon="trending_up" /></div>
                          {trackTrends.rising.map((t, i) => <TrackRow key={t.id} track={t} rank={i + 1} />)}
                        </>
                      )}
                      {trackTrends.consistent.length > 0 && (
                        <>
                          <div className="flex items-center gap-2 py-2 mt-1"><TrendPill label="Consistent" color="#3b82f6" icon="verified" /></div>
                          {trackTrends.consistent.map((t, i) => <TrackRow key={t.id} track={t} rank={i + 1} />)}
                        </>
                      )}
                      {trackTrends.classic.length > 0 && (
                        <>
                          <div className="flex items-center gap-2 py-2 mt-1"><TrendPill label="Classic" color="#f59e0b" icon="history_edu" /></div>
                          {trackTrends.classic.map((t, i) => <TrackRow key={t.id} track={t} rank={i + 1} />)}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Genre shift */}
                {genreTrends.length > 0 && (
                  <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-card">
                    <div className="px-4 py-3 border-b border-outline-variant/20 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-primary">category</span>
                      <p className="font-inter font-semibold text-sm text-on-surface">Genre Shift (All Time)</p>
                    </div>
                    <div className="px-4 py-3 space-y-2.5">
                      {genreTrends.map(({ name, count, inShort, inLong }, i) => (
                        <div key={name} className="flex items-center gap-2">
                          <span className="font-inter text-xs text-on-surface-variant w-28 truncate shrink-0">{name}</span>
                          <div className="flex-1 h-2 bg-surface-container rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.round((count / (genreTrends[0]?.count ?? 1)) * 100)}%`, background: GENRE_COLORS[i % GENRE_COLORS.length] }} />
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {inShort && <span className="w-1.5 h-1.5 rounded-full bg-green-500" title="In recent top" />}
                            {inLong  && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="In all-time top" />}
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center gap-3 pt-1">
                        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /><span className="font-inter text-[10px] text-outline">Recent top</span></div>
                        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /><span className="font-inter text-[10px] text-outline">All-time top</span></div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
