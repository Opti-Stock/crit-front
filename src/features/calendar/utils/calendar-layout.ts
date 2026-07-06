import {
  WORKDAY_END_HOUR,
  WORKDAY_START_HOUR,
} from "./calendar-date.ts";

export interface CalendarLayoutInput<T> {
  item: T;
  startsAt: string | Date;
  endsAt: string | Date;
}

export interface CalendarLayoutOptions {
  pixelsPerMinute: number;
  workdayStartHour?: number;
  workdayEndHour?: number;
  minEventHeightPx?: number;
}

export interface CalendarLayoutBlock<T> {
  item: T;
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
  topPx: number;
  heightPx: number;
  lane: number;
  laneCount: number;
  leftPercent: number;
  widthPercent: number;
}

interface NormalizedCalendarEvent<T> extends CalendarLayoutInput<T> {
  startsAt: Date;
  endsAt: Date;
  startMs: number;
  endMs: number;
  durationMinutes: number;
  topPx: number;
  heightPx: number;
}

export function layoutCalendarAppointments<T>(
  appointments: readonly CalendarLayoutInput<T>[],
  options: CalendarLayoutOptions,
): CalendarLayoutBlock<T>[] {
  const workdayStartHour = options.workdayStartHour ?? WORKDAY_START_HOUR;
  const workdayEndHour = options.workdayEndHour ?? WORKDAY_END_HOUR;
  const minEventHeightPx = options.minEventHeightPx ?? 18;

  const normalized = appointments
    .map((appointment) =>
      normalizeAppointment(appointment, {
        ...options,
        workdayStartHour,
        workdayEndHour,
        minEventHeightPx,
      }),
    )
    .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs);

  const groups = groupOverlappingAppointments(normalized);

  return groups.flatMap((group) =>
    positionOverlappingGroup(group).map((block) => ({
      ...block,
      leftPercent: (block.lane / block.laneCount) * 100,
      widthPercent: 100 / block.laneCount,
    })),
  );
}

function normalizeAppointment<T>(
  appointment: CalendarLayoutInput<T>,
  options: Required<CalendarLayoutOptions>,
): NormalizedCalendarEvent<T> {
  const startsAt = toDate(appointment.startsAt);
  const endsAt = toDate(appointment.endsAt);
  const durationMinutes = Math.max(
    0,
    Math.round((endsAt.getTime() - startsAt.getTime()) / 60000),
  );
  const topMinutes = clampToWorkday(
    minutesSinceWorkdayStart(startsAt, options.workdayStartHour),
    options.workdayStartHour,
    options.workdayEndHour,
  );
  const endMinutes = clampToWorkday(
    minutesSinceWorkdayStart(endsAt, options.workdayStartHour),
    options.workdayStartHour,
    options.workdayEndHour,
  );
  const visibleMinutes = Math.max(0, endMinutes - topMinutes);
  const heightPx =
    visibleMinutes > 0
      ? Math.max(visibleMinutes * options.pixelsPerMinute, options.minEventHeightPx)
      : 0;

  return {
    ...appointment,
    startsAt,
    endsAt,
    startMs: startsAt.getTime(),
    endMs: endsAt.getTime(),
    durationMinutes,
    topPx: topMinutes * options.pixelsPerMinute,
    heightPx,
  };
}

function groupOverlappingAppointments<T>(
  appointments: readonly NormalizedCalendarEvent<T>[],
): NormalizedCalendarEvent<T>[][] {
  const groups: NormalizedCalendarEvent<T>[][] = [];
  let currentGroup: NormalizedCalendarEvent<T>[] = [];
  let currentGroupEnd = 0;

  appointments.forEach((appointment) => {
    if (currentGroup.length === 0 || appointment.startMs < currentGroupEnd) {
      currentGroup.push(appointment);
      currentGroupEnd = Math.max(currentGroupEnd, appointment.endMs);
      return;
    }

    groups.push(currentGroup);
    currentGroup = [appointment];
    currentGroupEnd = appointment.endMs;
  });

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

function positionOverlappingGroup<T>(
  group: readonly NormalizedCalendarEvent<T>[],
): Omit<CalendarLayoutBlock<T>, "leftPercent" | "widthPercent">[] {
  const laneEnds: number[] = [];
  const blocks = group.map((appointment) => {
    const laneIndex = laneEnds.findIndex((laneEnd) => laneEnd <= appointment.startMs);
    const lane = laneIndex === -1 ? laneEnds.length : laneIndex;
    laneEnds[lane] = appointment.endMs;

    return {
      item: appointment.item,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      durationMinutes: appointment.durationMinutes,
      topPx: appointment.topPx,
      heightPx: appointment.heightPx,
      lane,
      laneCount: 1,
    };
  });
  const laneCount = Math.max(laneEnds.length, 1);

  return blocks.map((block) => ({
    ...block,
    laneCount,
  }));
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function minutesSinceWorkdayStart(date: Date, workdayStartHour: number): number {
  return date.getHours() * 60 + date.getMinutes() - workdayStartHour * 60;
}

function clampToWorkday(
  minutes: number,
  workdayStartHour: number,
  workdayEndHour: number,
): number {
  const workdayMinutes = (workdayEndHour - workdayStartHour) * 60;
  return Math.min(Math.max(minutes, 0), workdayMinutes);
}
