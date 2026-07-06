export type CalendarViewMode = "day" | "work-week" | "week" | "month" | "agenda";

export const CALENDAR_TIME_ZONE = "America/Mexico_City";
export const WORKDAY_START_HOUR = 7;
export const WORKDAY_END_HOUR = 20;

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months, 1);
  return next;
}

export function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return startOfDay(addDays(date, mondayOffset));
}

export function endExclusive(date: Date): Date {
  return addDays(startOfDay(date), 1);
}

export function getVisibleDays(anchorDate: Date, view: CalendarViewMode): Date[] {
  if (view === "day" || view === "agenda") {
    return [startOfDay(anchorDate)];
  }

  if (view === "work-week") {
    const start = startOfWeek(anchorDate);
    return Array.from({ length: 5 }, (_, index) => addDays(start, index));
  }

  if (view === "week") {
    const start = startOfWeek(anchorDate);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }

  const first = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function getRangeForView(
  anchorDate: Date,
  view: CalendarViewMode,
): { from: string; to: string } {
  if (view === "month") {
    const days = getVisibleDays(anchorDate, view);
    return {
      from: days[0].toISOString(),
      to: endExclusive(days[days.length - 1]).toISOString(),
    };
  }

  const days = getVisibleDays(anchorDate, view);
  return {
    from: days[0].toISOString(),
    to: endExclusive(days[days.length - 1]).toISOString(),
  };
}

export function moveAnchorDate(
  anchorDate: Date,
  view: CalendarViewMode,
  direction: -1 | 1,
): Date {
  if (view === "day" || view === "agenda") {
    return addDays(anchorDate, direction);
  }

  if (view === "work-week" || view === "week") {
    return addDays(anchorDate, direction * 7);
  }

  return addMonths(anchorDate, direction);
}

export function toDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function formatDayHeader(date: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function formatRangeLabel(anchorDate: Date, view: CalendarViewMode): string {
  if (view === "month") {
    return new Intl.DateTimeFormat("es-MX", {
      month: "long",
      year: "numeric",
    }).format(anchorDate);
  }

  const days = getVisibleDays(anchorDate, view);
  const first = days[0];
  const last = days[days.length - 1];

  if (toDateKey(first) === toDateKey(last)) {
    return new Intl.DateTimeFormat("es-MX", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(first);
  }

  return `${new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
  }).format(first)} - ${new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(last)}`;
}

export function formatTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatInputDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function clampAppointmentTop(date: Date): number {
  const minutes = (date.getHours() - WORKDAY_START_HOUR) * 60 + date.getMinutes();
  const workdayMinutes = (WORKDAY_END_HOUR - WORKDAY_START_HOUR) * 60;
  return Math.min(Math.max(minutes, 0), workdayMinutes);
}

export function minutesBetween(start: Date, end: Date): number {
  return Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
}
