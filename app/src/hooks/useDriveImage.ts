import { useState, useEffect } from 'react';
import { getFromCache, saveToCache } from '../utils/imageCache';
import { fetchDriveFile } from '../services/driveImages';
import { useSyncStore } from '../store/syncStore';

export function useDriveImage(driveFileId: string | null | undefined, fallback?: string): string | null {
  const [src, setSrc] = useState<string | null>(fallback ?? null);
  const accessToken = useSyncStore(s => s.accessToken);
  const isTokenValid = useSyncStore(s => s.isTokenValid);

  useEffect(() => {
    if (!driveFileId) { setSrc(fallback ?? null); return; }

    let cancelled = false;
    let blobUrl: string | null = null;

    (async () => {
      let blob = await getFromCache(driveFileId);
      if (!blob) {
        if (!accessToken || !isTokenValid()) { setSrc(fallback ?? null); return; }
        blob = await fetchDriveFile(accessToken, driveFileId);
        if (!blob || cancelled) return;
        await saveToCache(driveFileId, blob);
      }
      if (cancelled) return;
      blobUrl = URL.createObjectURL(blob);
      setSrc(blobUrl);
    })();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [driveFileId, accessToken]);

  return src;
}
