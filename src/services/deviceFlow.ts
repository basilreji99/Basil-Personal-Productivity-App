const DEVICE_CODE_ENDPOINT = 'https://oauth2.googleapis.com/device/code';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/calendar.readonly',
  'openid',
  'email',
  'profile',
].join(' ');

export interface DeviceCodeData {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
  interval: number;
}

export type PollResult =
  | { status: 'authorized'; accessToken: string; refreshToken: string | null; expiry: number }
  | { status: 'pending' }
  | { status: 'expired' }
  | { status: 'error' };

// Throws with a human-readable message on failure
export async function requestDeviceCode(clientId: string): Promise<DeviceCodeData> {
  const res = await fetch(DEVICE_CODE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, scope: SCOPES }).toString(),
  });
  const d = await res.json();
  if (!res.ok) {
    throw new Error(d.error_description || d.error || `HTTP ${res.status}`);
  }
  return {
    deviceCode: d.device_code,
    userCode: d.user_code,
    verificationUrl: d.verification_url,
    expiresIn: d.expires_in,
    interval: d.interval ?? 5,
  };
}

export async function pollDeviceToken(
  clientId: string,
  clientSecret: string,
  deviceCode: string,
): Promise<PollResult> {
  try {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        device_code: deviceCode,
        grant_type: 'urn:ietf:wg:oauth:2.0:device_authorization_grant',
      }).toString(),
    });
    const data = await res.json();
    if (res.ok) {
      return {
        status: 'authorized',
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        expiry: Date.now() + (data.expires_in ?? 3600) * 1000,
      };
    }
    if (data.error === 'authorization_pending' || data.error === 'slow_down') return { status: 'pending' };
    if (data.error === 'expired_token') return { status: 'expired' };
    return { status: 'error' };
  } catch {
    return { status: 'error' };
  }
}
