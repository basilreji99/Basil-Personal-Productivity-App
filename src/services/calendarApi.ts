export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
  isAllDay: boolean;
  colorId?: string;
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  backgroundColor?: string;
  primary?: boolean;
}

export const GOOGLE_COLOR_MAP: Record<string, string> = {
  '1': '#7986cb', '2': '#33b679', '3': '#8e24aa', '4': '#e67c73',
  '5': '#f6c026', '6': '#f5511d', '7': '#039be5', '8': '#616161',
  '9': '#3f51b5', '10': '#0b8043', '11': '#d60000',
};

function mapEvent(item: Record<string, unknown>): CalendarEvent {
  const start = item.start as { dateTime?: string; date?: string };
  const end = item.end as { dateTime?: string; date?: string };
  return {
    id: item.id as string,
    summary: (item.summary as string) || 'Untitled event',
    start: start?.dateTime || start?.date || '',
    end: end?.dateTime || end?.date || '',
    location: item.location as string | undefined,
    isAllDay: !!start?.date && !start?.dateTime,
    colorId: item.colorId as string | undefined,
  };
}

export async function getCalendarList(token: string): Promise<GoogleCalendar[]> {
  try {
    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader',
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []).map((item: Record<string, unknown>) => ({
      id: item.id as string,
      summary: (item.summary as string) || '',
      backgroundColor: item.backgroundColor as string | undefined,
      primary: item.primary as boolean | undefined,
    }));
  } catch {
    return [];
  }
}

export async function getEventsForRange(
  token: string,
  calendarId: string,
  start: string,
  end: string,
): Promise<CalendarEvent[]> {
  try {
    const params = new URLSearchParams({
      timeMin: start,
      timeMax: end,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []).map(mapEvent);
  } catch {
    return [];
  }
}

export async function getAllCalendarsEvents(
  token: string,
  start: string,
  end: string,
): Promise<CalendarEvent[]> {
  const calendars = await getCalendarList(token);
  const sources = calendars.length
    ? calendars.map(c => c.id)
    : ['primary'];
  const results = await Promise.all(
    sources.map(id => getEventsForRange(token, id, start, end)),
  );
  const seen = new Set<string>();
  const merged: CalendarEvent[] = [];
  for (const events of results) {
    for (const ev of events) {
      if (!seen.has(ev.id)) {
        seen.add(ev.id);
        merged.push(ev);
      }
    }
  }
  merged.sort((a, b) => a.start.localeCompare(b.start));
  return merged;
}

export async function getTodayEvents(token: string): Promise<CalendarEvent[]> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  return getAllCalendarsEvents(token, start, end);
}

export async function getUpcomingEvents(token: string, days = 7): Promise<CalendarEvent[]> {
  const now = new Date();
  const end = new Date();
  end.setDate(end.getDate() + days);
  return getAllCalendarsEvents(token, now.toISOString(), end.toISOString());
}
