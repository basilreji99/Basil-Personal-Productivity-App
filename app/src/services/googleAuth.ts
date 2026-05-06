import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export async function openAuthUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url, windowName: '_self' });
  } else {
    window.location.href = url;
  }
}

const PRIMARY_SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/calendar.readonly',
  'openid',
  'email',
  'profile',
].join(' ');

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'openid',
  'email',
  'profile',
].join(' ');

export function buildAuthUrl(clientId: string): string {
  const redirectUri = `${window.location.origin}/`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: PRIMARY_SCOPES,
    include_granted_scopes: 'true',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export function buildCalendarAuthUrl(clientId: string): string {
  const redirectUri = `${window.location.origin}/`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: CALENDAR_SCOPES,
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export function parseTokenFromHash(hash: string): { token: string; expiry: number } | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const token = params.get('access_token');
  const expiresIn = parseInt(params.get('expires_in') || '3600');
  if (!token) return null;
  return { token, expiry: Date.now() + expiresIn * 1000 };
}

export async function fetchGoogleProfile(token: string): Promise<{ email: string; name: string; picture: string } | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
