import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '';
const REDIRECT_URI = 'basilapp://spotify-callback';

const SCOPES = [
  'user-top-read',
  'user-read-recently-played',
  'playlist-read-private',
  'user-read-currently-playing',
].join(' ');

// ─── PKCE helpers ─────────────────────────────────────────────────────────────

function generateVerifier(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const arr = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(arr, b => chars[b % chars.length]).join('');
}

async function generateChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ─── Auth flow ────────────────────────────────────────────────────────────────

export async function openSpotifyAuth(): Promise<void> {
  const verifier = generateVerifier(64);
  const challenge = await generateChallenge(verifier);

  // Persist verifier so we can use it after the redirect comes back
  localStorage.setItem('spotify_pkce_verifier', verifier);

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    show_dialog: 'true',
  });

  const url = `https://accounts.spotify.com/authorize?${params}`;
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url, windowName: '_blank' });
  } else {
    window.location.href = url;
  }
}

export async function exchangeSpotifyCode(code: string): Promise<{ token: string; expiry: number; refreshToken?: string } | null> {
  const verifier = localStorage.getItem('spotify_pkce_verifier');
  if (!verifier) return null;

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  localStorage.removeItem('spotify_pkce_verifier');
  return {
    token: data.access_token,
    expiry: Date.now() + data.expires_in * 1000,
    refreshToken: data.refresh_token ?? undefined,
  };
}

export async function refreshSpotifyToken(refreshToken: string): Promise<{ token: string; expiry: number; refreshToken?: string } | null> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    token: data.access_token,
    expiry: Date.now() + data.expires_in * 1000,
    refreshToken: data.refresh_token ?? undefined,
  };
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getTopTracks(token: string, timeRange: 'short_term' | 'medium_term' | 'long_term' = 'short_term') {
  const res = await fetch(`https://api.spotify.com/v1/me/top/tracks?limit=20&time_range=${timeRange}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Spotify API error');
  return res.json();
}

export async function getTopArtists(token: string, timeRange: 'short_term' | 'medium_term' | 'long_term' = 'short_term') {
  const res = await fetch(`https://api.spotify.com/v1/me/top/artists?limit=20&time_range=${timeRange}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Spotify API error');
  return res.json();
}

export async function getRecentlyPlayed(token: string) {
  const res = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=20', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Spotify API error');
  return res.json();
}

export async function getUserPlaylists(token: string) {
  const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=20', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Spotify API error');
  return res.json();
}

export async function getArtistDetails(token: string, artistIds: string[]): Promise<any[]> {
  if (!artistIds.length) return [];
  const results: any[] = [];
  for (let i = 0; i < artistIds.length; i += 50) {
    const chunk = artistIds.slice(i, i + 50);
    const res = await fetch(`https://api.spotify.com/v1/artists?ids=${chunk.join(',')}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) continue;
    const data = await res.json();
    results.push(...(data.artists ?? []));
  }
  return results;
}
