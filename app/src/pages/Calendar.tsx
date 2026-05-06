import { useState, useEffect, useMemo } from 'react';
import TopBar from '../components/layout/TopBar';
import MonthGrid from '../components/calendar/MonthGrid';
import EventModal from '../components/calendar/EventModal';
import { useSyncStore } from '../store/syncStore';
import { useCalendarStore, type LocalEvent, type UnifiedEvent } from '../store/calendarStore';
import { useFitnessStore } from '../store/fitnessStore';
import { useTasksStore } from '../store/tasksStore';
import { useNavigate } from 'react-router-dom';
import { buildCalendarAuthUrl, openAuthUrl } from '../services/googleAuth';

function formatTime(timeStr?: string, isAllDay?: boolean) {
  if (isAllDay || !timeStr) return 'All day';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

function toYMD(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function Calendar() {
  const {
    profile, clientId, setClientId, startAuth, clearAuth,
    syncNow, fetchCalendar, accessToken, isTokenValid,
    syncStatus, lastSyncedAt,
  } = useSyncStore();

  const {
    accounts, localEvents,
    isFetching,
    setPendingAddAccount, addLocalEvent, updateLocalEvent, deleteLocalEvent,
    fetchAllEvents, getEventsForDate, getEventCountsByDate, removeAccount,
  } = useCalendarStore();

  const { gymSessions, sportSessions } = useFitnessStore();
  const { tasks } = useTasksStore();
  const navigate = useNavigate();

  // Build fitness events as UnifiedEvent objects for calendar display
  const fitnessEvents = useMemo((): UnifiedEvent[] => {
    const gym: UnifiedEvent[] = gymSessions.map(s => ({
      id: `fit-gym-${s.id}`,
      title: `🏋️ ${s.type}`,
      date: s.date,
      isAllDay: true,
      color: '#f97316',
      source: 'local' as const,
    }));
    const sports: UnifiedEvent[] = sportSessions.map(s => ({
      id: `fit-sport-${s.id}`,
      title: `🏅 ${s.sport}`,
      date: s.date,
      isAllDay: true,
      color: '#22c55e',
      source: 'local' as const,
    }));
    return [...gym, ...sports];
  }, [gymSessions, sportSessions]);

  // Task due-date events
  const taskEvents = useMemo((): UnifiedEvent[] => {
    const ICON: Record<string, string> = { epic: '⚡', story: '📖', bug: '🐛' };
    return tasks
      .filter((t) => t.dueDate && t.status !== 'done')
      .map((t) => ({
        id: `task-${t.id}`,
        title: `${ICON[t.issueType] ?? '✓'} ${t.title}`,
        date: t.dueDate!.slice(0, 10),
        isAllDay: true,
        color: t.issueType === 'epic' ? '#9333ea' : t.issueType === 'story' ? '#3b82f6' : t.issueType === 'bug' ? '#ef4444' : '#6b7280',
        source: 'local' as const,
      }));
  }, [tasks]);

  const today = toYMD(new Date());
  const todayDate = new Date();

  const [viewYear, setViewYear] = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);
  const [eventModal, setEventModal] = useState<{ open: boolean; event?: LocalEvent; defaultDate?: string }>({ open: false });
  const [inputId, setInputId] = useState(clientId);
  const [showSetup, setShowSetup] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);

  const primaryToken = isTokenValid() ? accessToken : null;
  const connected = !!primaryToken;
  const hasAnyAccount = connected || accounts.length > 0;

  // Fetch events for current month view
  useEffect(() => {
    if (!hasAnyAccount) return;
    const start = new Date(viewYear, viewMonth, 1).toISOString();
    const end = new Date(viewYear, viewMonth + 1, 1).toISOString();
    fetchAllEvents(start, end, primaryToken);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewYear, viewMonth, hasAnyAccount, primaryToken]);

  const eventsByDate = useMemo(() => {
    const base = getEventCountsByDate();
    for (const ev of [...fitnessEvents, ...taskEvents]) {
      if (!base[ev.date]) base[ev.date] = [];
      base[ev.date].push(ev);
    }
    return base;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useCalendarStore.getState().cachedGoogleEvents, localEvents, fitnessEvents, taskEvents]);

  const dayEvents = useMemo(() => {
    const base = getEventsForDate(selectedDate);
    const fit  = fitnessEvents.filter(e => e.date === selectedDate);
    const tkev = taskEvents.filter(e => e.date === selectedDate);
    return [...base, ...fit, ...tkev].sort((a, b) => {
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      return (a.startTime ?? '').localeCompare(b.startTime ?? '');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, useCalendarStore.getState().cachedGoogleEvents, localEvents, fitnessEvents, taskEvents]);

  function handlePrev() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }

  function handleNext() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function handleToday() {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelectedDate(toYMD(now));
  }

  function handleConnect() {
    setClientId(inputId.trim());
    setTimeout(() => startAuth(), 50);
  }

  function handleAddAccount() {
    if (!clientId.trim()) return;
    setPendingAddAccount(true);
    openAuthUrl(buildCalendarAuthUrl(clientId.trim()));
  }

  function handleSaveEvent(data: Omit<LocalEvent, 'id'>) {
    if (eventModal.event) {
      updateLocalEvent(eventModal.event.id, data);
    } else {
      addLocalEvent(data);
    }
    setEventModal({ open: false });
  }

  function handleDeleteEvent() {
    if (eventModal.event) {
      deleteLocalEvent(eventModal.event.id);
    }
    setEventModal({ open: false });
  }

  function formatSelectedDate() {
    const d = new Date(selectedDate + 'T12:00:00');
    return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  }

  return (
    <div className="bg-background min-h-screen">
      <TopBar
        title="Calendar"
        rightSlot={
          <div className="flex items-center gap-1">
            {isFetching && (
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant animate-spin">sync</span>
            )}
            {hasAnyAccount && (
              <button
                onClick={() => { fetchCalendar(); const start = new Date(viewYear, viewMonth, 1).toISOString(); const end = new Date(viewYear, viewMonth + 1, 1).toISOString(); fetchAllEvents(start, end, primaryToken); }}
                className="p-1.5 rounded-xl text-on-surface-variant"
                title="Refresh"
              >
                <span className="material-symbols-outlined text-[20px]">refresh</span>
              </button>
            )}
            <button
              onClick={() => setShowAccounts(v => !v)}
              className="p-1.5 rounded-xl text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
            </button>
          </div>
        }
      />

      <main className="max-w-screen-xl mx-auto px-4 py-4 pb-32 space-y-4">

        {/* Account panel */}
        {showAccounts && (
          <div className="bg-surface-container rounded-2xl p-4 space-y-3">
            <p className="font-inter font-semibold text-sm text-on-surface">Google Accounts</p>

            {/* Primary account */}
            {profile ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 bg-surface-container-low rounded-xl px-3 py-2.5">
                  <img src={profile.picture} alt={profile.name} className="w-8 h-8 rounded-full" />
                  <div className="flex-1 min-w-0">
                    <p className="font-inter text-sm font-medium text-on-surface truncate">{profile.name}</p>
                    <p className="font-inter text-xs text-on-surface-variant truncate">{profile.email}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="px-2 py-0.5 rounded-full bg-primary-container font-inter text-[10px] font-semibold text-on-primary-container">Primary</span>
                    <button
                      onClick={() => clearAuth()}
                      className="p-1.5 text-on-surface-variant"
                      title="Disconnect"
                    >
                      <span className="material-symbols-outlined text-[16px]">logout</span>
                    </button>
                  </div>
                </div>
                {!connected && (
                  <button
                    onClick={handleConnect}
                    className="w-full py-2 rounded-xl bg-amber-500/10 text-amber-700 font-inter text-xs font-medium flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">refresh</span>
                    Session expired — tap to reconnect
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={inputId}
                  onChange={e => setInputId(e.target.value)}
                  placeholder="Paste your Google OAuth Client ID"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 font-inter text-sm text-on-surface placeholder:text-on-surface-variant outline-none focus:border-primary"
                />
                <button
                  onClick={handleConnect}
                  disabled={!inputId.trim()}
                  className="w-full py-2.5 rounded-xl bg-primary text-on-primary font-inter font-semibold text-sm disabled:opacity-50"
                >
                  Connect primary Google account
                </button>
                <button
                  onClick={() => setShowSetup(v => !v)}
                  className="w-full text-xs text-primary font-inter text-center"
                >
                  {showSetup ? 'Hide setup ▲' : 'How to get a Client ID? ▼'}
                </button>
                {showSetup && (
                  <div className="bg-surface-container-low rounded-xl p-3 space-y-2 text-xs font-inter text-on-surface-variant">
                    <p className="font-semibold text-on-surface">Google Cloud Console setup:</p>
                    <ol className="list-decimal list-inside space-y-1 leading-relaxed">
                      <li>Go to <span className="text-primary">console.cloud.google.com</span></li>
                      <li>Create a project → enable <strong className="text-on-surface">Google Calendar API</strong> + <strong className="text-on-surface">Drive API</strong></li>
                      <li>APIs &amp; Services → OAuth consent screen → External, add yourself as test user</li>
                      <li>Add scopes: <code className="bg-surface-container px-1 rounded">drive.appdata</code> and <code className="bg-surface-container px-1 rounded">calendar.readonly</code></li>
                      <li>Credentials → Create → OAuth 2.0 Client ID → Web application</li>
                      <li>Authorised JS origins: <code className="bg-surface-container px-1 rounded">http://localhost</code></li>
                      <li>Authorised redirect URIs: <code className="bg-surface-container px-1 rounded">http://localhost/</code></li>
                      <li>Copy the <strong className="text-on-surface">Client ID</strong> and paste above</li>
                    </ol>
                  </div>
                )}
              </div>
            )}

            {/* Additional accounts */}
            {accounts.map(acc => (
              <div key={acc.id} className="flex items-center gap-3 bg-surface-container-low rounded-xl px-3 py-2.5">
                <img src={acc.picture} alt={acc.name} className="w-8 h-8 rounded-full" />
                <div className="flex-1 min-w-0">
                  <p className="font-inter text-sm font-medium text-on-surface truncate">{acc.name}</p>
                  <p className="font-inter text-xs text-on-surface-variant truncate">{acc.email}</p>
                </div>
                <button
                  onClick={() => removeAccount(acc.id)}
                  className="p-1.5 text-on-surface-variant"
                >
                  <span className="material-symbols-outlined text-[16px]">remove_circle</span>
                </button>
              </div>
            ))}

            {/* Add account — visible whenever a client ID is configured */}
            {clientId.trim() && (
              <button
                onClick={handleAddAccount}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-outline-variant text-on-surface-variant font-inter text-sm"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Add another Google account
              </button>
            )}

            {/* Sync status */}
            {connected && (
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    syncStatus === 'success' ? 'bg-green-500' :
                    syncStatus === 'syncing' ? 'bg-amber-400 animate-pulse' :
                    syncStatus === 'error' ? 'bg-red-500' : 'bg-gray-300'
                  }`} />
                  <span className="font-inter text-xs text-on-surface-variant">
                    {syncStatus === 'syncing' ? 'Syncing…' :
                     syncStatus === 'success' ? 'Drive synced' :
                     syncStatus === 'error' ? 'Sync error' : 'Not synced'}
                  </span>
                </div>
                {lastSyncedAt && (
                  <span className="font-inter text-xs text-outline">
                    {new Date(lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                )}
                <button
                  onClick={() => { syncNow(); fetchCalendar(); }}
                  className="text-xs text-primary font-inter font-medium"
                >
                  Sync now
                </button>
              </div>
            )}
          </div>
        )}

        {/* Month grid */}
        <MonthGrid
          year={viewYear}
          month={viewMonth}
          eventsByDate={eventsByDate}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
        />

        {/* Selected day events */}
        <section>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="font-inter font-semibold text-sm text-on-surface">{formatSelectedDate()}</h2>
            <button
              onClick={() => setEventModal({ open: true, defaultDate: selectedDate })}
              className="flex items-center gap-1 text-xs text-primary font-inter font-medium"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              Add event
            </button>
          </div>

          {dayEvents.length === 0 ? (
            <div className="bg-surface-container rounded-xl px-4 py-6 text-center">
              <span className="material-symbols-outlined text-[32px] text-on-surface-variant">event_available</span>
              <p className="font-inter text-sm text-on-surface-variant mt-1">No events</p>
              {!hasAnyAccount && (
                <button
                  onClick={() => setShowAccounts(true)}
                  className="mt-2 text-xs text-primary font-inter"
                >
                  Connect a Google account to see your events
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {dayEvents.map(ev => (
                <button
                  key={ev.id}
                  onClick={() => {
                    if (ev.id.startsWith('task-')) {
                      navigate(`/tasks/${ev.id.slice(5)}`);
                    } else if (ev.source === 'local') {
                      const local = localEvents.find(e => e.id === ev.id);
                      if (local) setEventModal({ open: true, event: local });
                    }
                  }}
                  className="w-full bg-surface-container rounded-xl px-4 py-3 flex items-start gap-3 text-left active:bg-surface-container-high"
                >
                  <div
                    className="w-1 self-stretch rounded-full shrink-0 min-h-[20px]"
                    style={{ backgroundColor: ev.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-inter font-medium text-sm text-on-surface">{ev.title}</p>
                    {ev.location && (
                      <p className="font-inter text-xs text-on-surface-variant truncate mt-0.5">
                        <span className="material-symbols-outlined text-[12px] align-middle mr-0.5">location_on</span>
                        {ev.location}
                      </p>
                    )}
                    {ev.accountEmail && (
                      <p className="font-inter text-[10px] text-outline mt-0.5 truncate">{ev.accountEmail}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="font-inter text-xs text-on-surface-variant">
                      {formatTime(ev.startTime, ev.isAllDay)}
                    </span>
                    {ev.endTime && !ev.isAllDay && (
                      <p className="font-inter text-[10px] text-outline">– {formatTime(ev.endTime)}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* FAB */}
      <button
        onClick={() => setEventModal({ open: true, defaultDate: selectedDate })}
        className="fixed right-4 bg-primary-container text-on-primary-container rounded-2xl w-14 h-14 flex items-center justify-center shadow-lg"
        style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}
      >
        <span className="material-symbols-outlined text-[24px]">add</span>
      </button>

      {/* Event modal */}
      {eventModal.open && (
        <EventModal
          initial={eventModal.event}
          defaultDate={eventModal.defaultDate ?? selectedDate}
          onSave={handleSaveEvent}
          onDelete={eventModal.event ? handleDeleteEvent : undefined}
          onClose={() => setEventModal({ open: false })}
        />
      )}
    </div>
  );
}
