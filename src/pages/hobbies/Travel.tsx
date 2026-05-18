import TopBar from '../../components/layout/TopBar';

export default function Travel() {
  return (
    <div className="bg-background min-h-screen">
      <TopBar title="Travel" />
      <main className="max-w-screen-xl mx-auto px-4 py-16 pb-28 flex flex-col items-center justify-center text-center">
        <span className="material-symbols-outlined text-[64px] text-outline mb-4">travel_explore</span>
        <p className="font-manrope font-bold text-lg text-on-surface mb-2">Your Travel Log</p>
        <p className="font-inter text-sm text-on-surface-variant max-w-xs">
          Track places visited, trips planned, and travel memories. Coming soon.
        </p>
      </main>
    </div>
  );
}
