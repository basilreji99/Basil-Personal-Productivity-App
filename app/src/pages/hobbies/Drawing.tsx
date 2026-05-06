import { useState, useMemo, useRef } from 'react';
import TopBar from '../../components/layout/TopBar';
import Modal from '../../components/ui/Modal';
import { useHobbyStore } from '../../store/hobbyStore';
import { useSyncStore } from '../../store/syncStore';
import { useDriveImage } from '../../hooks/useDriveImage';
import { uploadImageToDrive, deleteDriveFile } from '../../services/driveImages';
import { saveToCache, removeFromCache } from '../../utils/imageCache';
import type { Artwork } from '../../types';

const SECTIONS = ['All', 'Glass Paint', 'Drawing & Painting', 'Crafts'] as const;
type Section = typeof SECTIONS[number];

const SECTION_ICONS: Record<string, string> = {
  'Glass Paint': 'water_drop',
  'Drawing & Painting': 'palette',
  'Crafts': 'texture',
};

const MEDIUMS = ['Watercolor', 'Pencil', 'Digital', 'Acrylic', 'Oil', 'Sketch', 'Ink', 'Charcoal', 'Pastel', 'Mixed Media', 'Glass Paint', 'Crafts'];

// ─── Media cell ───────────────────────────────────────────────────────────────

function MediaThumb({ artwork }: { artwork: Artwork }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const driveUrl = useDriveImage(artwork.driveFileId, artwork.image);
  const src = driveUrl;

  if (!src) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="material-symbols-outlined text-[40px] text-outline">palette</span>
      </div>
    );
  }
  if (artwork.mediaType === 'video') {
    return (
      <div className="w-full h-full relative">
        <video
          ref={videoRef}
          src={src}
          muted
          playsInline
          preload="metadata"
          className="w-full h-full object-cover"
          onLoadedMetadata={() => {
            if (videoRef.current) videoRef.current.currentTime = 0.1;
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
            <span className="material-symbols-outlined text-[26px] text-white icon-fill">play_arrow</span>
          </div>
        </div>
      </div>
    );
  }
  const rot = artwork.rotation ?? 0;
  return (
    <div className="w-full h-full overflow-hidden flex items-center justify-center">
      <img
        src={src}
        alt={artwork.title}
        className="w-full h-full object-cover transition-transform"
        style={{ transform: rot ? `rotate(${rot}deg)` : undefined, ...(rot === 90 || rot === 270 ? { width: '100%', height: '100%', objectFit: 'cover' } : {}) }}
      />
    </div>
  );
}

// ─── Artwork Modal ────────────────────────────────────────────────────────────

function ArtworkModal({ open, onClose, artwork }: { open: boolean; onClose: () => void; artwork?: Artwork | null }) {
  const { addArtwork, updateArtwork, deleteArtwork } = useHobbyStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle]           = useState('');
  const [medium, setMedium]         = useState('');
  const [section, setSection]       = useState<Artwork['section'] | ''>('');
  const [date, setDate]             = useState(today);
  const [notes, setNotes]           = useState('');
  const [image, setImage]           = useState<string | undefined>(undefined);
  const [driveFileId, setDriveFileId] = useState<string | undefined>(undefined);
  const [uploading, setUploading]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Drive-sourced preview for edit mode (when no local base64 preview)
  const drivePreviewUrl = useDriveImage(image ? undefined : driveFileId);
  const previewSrc = image ?? drivePreviewUrl ?? undefined;

  useMemo(() => {
    if (!open) return;
    if (artwork) {
      setTitle(artwork.title); setMedium(artwork.medium);
      setSection(artwork.section ?? ''); setDate(artwork.date);
      setNotes(artwork.notes); setImage(artwork.image);
      setDriveFileId(artwork.driveFileId);
    } else {
      setTitle(''); setMedium(''); setSection(''); setDate(today); setNotes('');
      setImage(undefined); setDriveFileId(undefined);
    }
    setUploading(false);
    setConfirmDelete(false);
  }, [open]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Immediate base64 preview while upload proceeds
    const reader = new FileReader();
    reader.onload = ev => setImage(ev.target?.result as string);
    reader.readAsDataURL(file);
    setDriveFileId(undefined);

    // Try to upload to Drive
    const { isTokenValid, accessToken } = useSyncStore.getState();
    if (isTokenValid() && accessToken) {
      setUploading(true);
      const ext = file.name.split('.').pop() ?? 'jpg';
      const fileId = await uploadImageToDrive(accessToken, file, `artwork-${Date.now()}.${ext}`);
      setUploading(false);
      if (fileId) {
        // Delete old Drive file if replacing
        if (artwork?.driveFileId) {
          deleteDriveFile(accessToken, artwork.driveFileId).catch(() => {});
          removeFromCache(artwork.driveFileId).catch(() => {});
        }
        setDriveFileId(fileId);
        saveToCache(fileId, file).catch(() => {}); // pre-cache for instant display
      }
    }
  };

  const handleSave = () => {
    const payload: Omit<Artwork, 'id' | 'createdAt'> = {
      title,
      medium,
      section: section || undefined,
      date,
      notes,
      image: driveFileId ? undefined : image,   // drop base64 if Drive succeeded
      driveFileId: driveFileId || undefined,
      mediaType: 'image',
    };
    if (artwork) updateArtwork(artwork.id, payload);
    else addArtwork(payload);
    onClose();
  };

  const handleDelete = () => {
    if (!artwork) return;
    if (artwork.driveFileId) {
      const { isTokenValid, accessToken } = useSyncStore.getState();
      if (isTokenValid() && accessToken) {
        deleteDriveFile(accessToken, artwork.driveFileId).catch(() => {});
      }
      removeFromCache(artwork.driveFileId).catch(() => {});
    }
    deleteArtwork(artwork.id);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={artwork ? 'Edit Artwork' : 'Add Artwork'} size="sm">
      <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
        {/* Image upload */}
        <div
          onClick={() => fileRef.current?.click()}
          className="w-full aspect-video bg-surface-container rounded-xl flex items-center justify-center cursor-pointer overflow-hidden border-2 border-dashed border-outline-variant/40 hover:border-primary/40 transition-colors relative">
          {previewSrc ? (
            <img src={previewSrc} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="text-center">
              <span className="material-symbols-outlined text-[36px] text-outline mb-1">add_photo_alternate</span>
              <p className="font-inter text-xs text-outline">Tap to add photo</p>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {driveFileId && !uploading && (
            <div className="absolute top-2 right-2 bg-black/50 rounded-full px-2 py-0.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px] text-green-400">cloud_done</span>
              <span className="font-inter text-[10px] text-white">Drive</span>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />

        <div className="space-y-1">
          <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Untitled"
            className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none focus:border-primary/50" />
        </div>

        <div className="space-y-1">
          <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Section</label>
          <div className="flex flex-wrap gap-1.5">
            {(['Glass Paint', 'Drawing & Painting', 'Crafts'] as const).map(s => (
              <button key={s} onClick={() => setSection(s)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-inter font-medium transition-colors ${section === s ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Medium</label>
          <div className="flex flex-wrap gap-1.5">
            {MEDIUMS.map(m => (
              <button key={m} onClick={() => setMedium(m)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-inter font-medium transition-colors ${medium === m ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                {m}
              </button>
            ))}
          </div>
          {medium && !MEDIUMS.includes(medium) && (
            <input value={medium} onChange={e => setMedium(e.target.value)} placeholder="Custom medium"
              className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none mt-2" />
          )}
        </div>

        <div className="space-y-1">
          <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none" />
        </div>

        <div className="space-y-1">
          <label className="font-inter text-[10px] font-semibold uppercase tracking-wider text-outline">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder="Techniques, inspiration..."
            className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 font-inter text-sm outline-none resize-none" />
        </div>

        <div className="flex justify-between items-center pt-2">
          {artwork ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="font-inter text-xs text-error">Delete?</span>
                <button onClick={handleDelete}
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
            <button onClick={handleSave} disabled={!title || uploading}
              className="px-4 py-2 rounded-lg bg-primary text-on-primary font-inter font-medium text-sm disabled:opacity-50">
              {artwork ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Full Screen Viewer ───────────────────────────────────────────────────────

function ArtworkViewer({
  artwork, onClose, onEdit, onRotate,
}: {
  artwork: Artwork;
  onClose: () => void;
  onEdit: () => void;
  onRotate: (delta: 90 | -90) => void;
}) {
  const rot = artwork.rotation ?? 0;
  const driveUrl = useDriveImage(artwork.driveFileId, artwork.image);
  const src = driveUrl;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white shrink-0">
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10">
          <span className="material-symbols-outlined text-[22px]">close</span>
        </button>
        <div className="text-center">
          <p className="font-manrope font-bold text-sm">{artwork.title}</p>
          <p className="font-inter text-[10px] text-white/60">
            {[artwork.section, artwork.medium].filter(Boolean).join(' · ')} · {artwork.date}
          </p>
        </div>
        <button onClick={onEdit} className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10">
          <span className="material-symbols-outlined text-[22px]">edit</span>
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        {!src ? (
          <div className="text-center text-white/40">
            <span className="material-symbols-outlined text-[80px]">palette</span>
            <p className="font-inter text-sm mt-2">No media attached</p>
          </div>
        ) : artwork.mediaType === 'video' ? (
          <video
            src={src}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-full rounded-xl"
          />
        ) : (
          <img
            src={src}
            alt={artwork.title}
            className="max-w-full max-h-full object-contain rounded-xl transition-transform duration-200"
            style={{ transform: rot ? `rotate(${rot}deg)` : undefined }}
          />
        )}
      </div>

      {/* Rotation controls — only for images */}
      {src && artwork.mediaType !== 'video' && (
        <div className="flex items-center justify-center gap-4 pb-4 shrink-0">
          <button
            onClick={() => onRotate(-90)}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white active:bg-white/20"
          >
            <span className="material-symbols-outlined text-[22px]">rotate_left</span>
          </button>
          <button
            onClick={() => onRotate(90)}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white active:bg-white/20"
          >
            <span className="material-symbols-outlined text-[22px]">rotate_right</span>
          </button>
        </div>
      )}

      {artwork.notes && (
        <div className="px-4 pb-8 shrink-0">
          <p className="font-inter text-sm text-white/70 text-center">{artwork.notes}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Drawing() {
  const { artworks, updateArtwork } = useHobbyStore();
  const [modalOpen, setModalOpen]     = useState(false);
  const [editArtwork, setEditArtwork] = useState<Artwork | null>(null);
  const [viewArtwork, setViewArtwork] = useState<Artwork | null>(null);
  const [activeSection, setActiveSection] = useState<Section>('All');

  const handleRotate = (delta: 90 | -90) => {
    if (!viewArtwork) return;
    const newRot = (((viewArtwork.rotation ?? 0) + delta) % 360 + 360) % 360 as 0 | 90 | 180 | 270;
    updateArtwork(viewArtwork.id, { rotation: newRot });
    setViewArtwork({ ...viewArtwork, rotation: newRot });
  };

  const filtered = useMemo(
    () => activeSection === 'All' ? artworks : artworks.filter(a => a.section === activeSection),
    [artworks, activeSection],
  );

  const sectionCounts = useMemo(() => ({
    'Glass Paint':        artworks.filter(a => a.section === 'Glass Paint').length,
    'Drawing & Painting': artworks.filter(a => a.section === 'Drawing & Painting').length,
    'Crafts':             artworks.filter(a => a.section === 'Crafts').length,
  }), [artworks]);

  return (
    <div className="bg-background min-h-screen">
      {viewArtwork ? (
        <ArtworkViewer
          artwork={viewArtwork}
          onClose={() => setViewArtwork(null)}
          onEdit={() => { setEditArtwork(viewArtwork); setModalOpen(true); setViewArtwork(null); }}
          onRotate={handleRotate}
        />
      ) : (
        <>
          <TopBar title="Drawing & Crafts" showBack />

          <main className="max-w-screen-xl mx-auto px-4 py-4 pb-28 space-y-4">

            {/* Section summary cards */}
            <div className="grid grid-cols-3 gap-2">
              {(['Glass Paint', 'Drawing & Painting', 'Crafts'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setActiveSection(s)}
                  className={`rounded-xl p-3 text-center shadow-sm transition-all ${
                    activeSection === s
                      ? 'bg-primary text-on-primary scale-[1.02]'
                      : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[22px] mb-1 ${activeSection === s ? 'text-on-primary' : 'text-primary'}`}>
                    {SECTION_ICONS[s]}
                  </span>
                  <p className={`font-manrope font-bold text-lg leading-none ${activeSection === s ? 'text-on-primary' : 'text-on-surface'}`}>
                    {sectionCounts[s]}
                  </p>
                  <p className={`font-inter text-[9px] mt-0.5 leading-tight ${activeSection === s ? 'text-on-primary/80' : 'text-outline'}`}>
                    {s}
                  </p>
                </button>
              ))}
            </div>

            {/* Section tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4">
              {SECTIONS.map(s => (
                <button key={s} onClick={() => setActiveSection(s)}
                  className={`px-3 py-1.5 rounded-full font-inter text-xs font-medium shrink-0 transition-colors ${
                    activeSection === s ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                  }`}>
                  {s}{s !== 'All' ? ` (${sectionCounts[s as keyof typeof sectionCounts]})` : ` (${artworks.length})`}
                </button>
              ))}
            </div>

            {/* Gallery grid */}
            {filtered.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {filtered.map(a => (
                  <button key={a.id} onClick={() => setViewArtwork(a)}
                    className="group relative aspect-square rounded-xl overflow-hidden bg-surface-container hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-sm">
                    <MediaThumb artwork={a} />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="font-inter font-semibold text-xs text-white truncate">{a.title}</p>
                      <p className="font-inter text-[9px] text-white/70">{a.medium}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <span className="material-symbols-outlined text-[56px] text-outline mb-3">palette</span>
                <p className="font-inter font-semibold text-sm text-on-surface mb-1">No artwork yet</p>
                <p className="font-inter text-xs text-on-surface-variant">Tap + to add your first piece</p>
              </div>
            )}
          </main>

          <button onClick={() => { setEditArtwork(null); setModalOpen(true); }}
            className="fixed right-4 bg-primary text-on-primary rounded-full shadow-fab flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-40 w-14 h-14"
            style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>
            <span className="material-symbols-outlined text-[28px]">add</span>
          </button>

          <ArtworkModal open={modalOpen} onClose={() => { setModalOpen(false); setEditArtwork(null); }} artwork={editArtwork} />
        </>
      )}
    </div>
  );
}
