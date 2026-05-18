import { useState, useEffect, useRef, useCallback } from 'react';
import { requestDeviceCode, pollDeviceToken, type DeviceCodeData } from '../services/deviceFlow';

interface Props {
  clientId: string;
  clientSecret: string;
  onSuccess: (accessToken: string, expiry: number, refreshToken: string | null) => void;
  onClose: () => void;
}

export default function DeviceAuthModal({ clientId, clientSecret, onSuccess, onClose }: Props) {
  const [data, setData] = useState<DeviceCodeData | null>(null);
  const [status, setStatus] = useState<'loading' | 'waiting' | 'expired' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startFlow = useCallback(() => {
    setStatus('loading');
    setData(null);
    setErrorMsg('');
    if (pollRef.current) clearInterval(pollRef.current);

    requestDeviceCode(clientId)
      .then(result => {
        setData(result);
        setStatus('waiting');

        pollRef.current = setInterval(async () => {
          const poll = await pollDeviceToken(clientId, clientSecret, result.deviceCode);
          if (poll.status === 'authorized') {
            clearInterval(pollRef.current!);
            onSuccess(poll.accessToken, poll.expiry, poll.refreshToken);
          } else if (poll.status === 'expired') {
            clearInterval(pollRef.current!);
            setStatus('expired');
          } else if (poll.status === 'error') {
            clearInterval(pollRef.current!);
            setStatus('error');
            setErrorMsg('Token polling failed.');
          }
        }, (result.interval + 1) * 1000);
      })
      .catch((err: Error) => {
        setErrorMsg(err.message);
        setStatus('error');
      });
  }, [clientId, clientSecret, onSuccess]);

  useEffect(() => {
    startFlow();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [startFlow]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-surface rounded-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-inter font-semibold text-base text-on-surface">Sign in with Google</h2>
          <button onClick={onClose} className="p-1 text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {status === 'loading' && (
          <div className="flex items-center justify-center py-8">
            <span className="material-symbols-outlined text-[40px] text-primary animate-spin">sync</span>
          </div>
        )}

        {status === 'waiting' && data && (
          <div className="space-y-4">
            <p className="font-inter text-sm text-on-surface-variant leading-relaxed">
              Open <span className="text-primary font-medium">google.com/device</span> in any browser and enter this code:
            </p>
            <div className="bg-primary/10 rounded-2xl p-5 text-center">
              <p className="font-mono text-3xl font-bold tracking-[0.25em] text-primary select-all">
                {data.userCode}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[15px] text-primary animate-spin">sync</span>
              <span className="font-inter text-xs text-on-surface-variant">Waiting for you to sign in…</span>
            </div>
            <p className="font-inter text-[11px] text-center text-on-surface-variant/60">
              Code expires in {Math.round(data.expiresIn / 60)} minutes
            </p>
          </div>
        )}

        {status === 'expired' && (
          <div className="text-center py-4 space-y-4">
            <p className="font-inter text-sm text-on-surface-variant">Code expired.</p>
            <button
              onClick={startFlow}
              className="w-full py-2.5 rounded-xl bg-primary text-on-primary font-inter font-semibold text-sm"
            >
              Get a new code
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="py-2 space-y-3">
            <p className="font-inter text-sm text-error font-medium">Sign-in failed</p>
            {errorMsg && (
              <div className="bg-surface-container rounded-xl p-3 space-y-2">
                <p className="font-inter text-xs text-on-surface-variant break-words select-all">
                  {errorMsg}
                </p>
                <button
                  onClick={() => navigator.clipboard?.writeText(errorMsg)}
                  className="flex items-center gap-1 text-primary font-inter text-xs"
                >
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  Copy error
                </button>
              </div>
            )}
            <div className="bg-surface-container-low rounded-xl p-3 space-y-1">
              <p className="font-inter text-xs font-semibold text-on-surface">Things to check:</p>
              <ul className="font-inter text-xs text-on-surface-variant space-y-1 list-disc list-inside">
                <li>OAuth consent screen → add all scopes (drive.appdata, calendar, sheets)</li>
                <li>OAuth consent screen → add your Gmail as a test user</li>
                <li>Credential type must be TV and Limited Input devices</li>
              </ul>
            </div>
            <button
              onClick={startFlow}
              className="w-full py-2.5 rounded-xl bg-surface-container text-on-surface font-inter text-sm font-semibold"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
