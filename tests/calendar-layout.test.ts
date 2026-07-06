import assert from "node:assert/strict";
import test from "node:test";

import { layoutCalendarAppointments } from "../src/features/calendar/utils/calendar-layout.ts";
import { toCalendarAppointments } from "../src/features/calendar/utils/calendar-adapter.ts";
import { isMinuteStep } from "../src/features/calendar/utils/calendar-date.ts";
import type { AppointmentSummary } from "../src/types/operational.types.ts";

interface TestAppointment {
  id: string;
}

const layoutOptions = {
  pixelsPerMinute: 2,
  workdayStartHour: 7,
  workdayEndHour: 20,
  minEventHeightPx: 18,
};

function appointment(
  id: string,
  hour: number,
  minute: number,
  durationMinutes: number,
) {
  const startsAt = new Date(2026, 6, 1, hour, minute);
  const endsAt = new Date(startsAt);
  endsAt.setMinutes(endsAt.getMinutes() + durationMinutes);

  return {
    item: { id },
    startsAt,
    endsAt,
  };
}

function appointmentSummary(
  id: string,
  overrides: Partial<AppointmentSummary> = {},
): AppointmentSummary {
  return {
    id,
    patient: { id: "patient-1", fullName: "Paciente Demo" },
    collaborator: { id: "collaborator-1", fullName: "Terapeuta Demo" },
    clinic: { id: "clinic-1", name: "Clinica" },
    room: { id: "room-1", name: "Sala 1" },
    appointmentType: { id: "type-1", name: "Terapia" },
    startsAt: "2026-07-01T10:00:00.000Z",
    endsAt: "2026-07-01T10:45:00.000Z",
    preSessionMinutes: 0,
    postSessionMinutes: 0,
    status: "scheduled",
    ...overrides,
  };
}

test("calculates real block height for common appointment durations", () => {
  const durations = [15, 30, 45, 60, 90];

  durations.forEach((duration) => {
    const [block] = layoutCalendarAppointments<TestAppointment>(
      [appointment(`${duration}m`, 10, 0, duration)],
      layoutOptions,
    );

    assert.equal(block.durationMinutes, duration);
    assert.equal(block.topPx, 360);
    assert.equal(block.heightPx, duration * layoutOptions.pixelsPerMinute);
    assert.equal(block.leftPercent, 0);
    assert.equal(block.widthPercent, 100);
  });
});

test("keeps back-to-back appointments full width", () => {
  const blocks = layoutCalendarAppointments<TestAppointment>(
    [
      appointment("first", 10, 0, 60),
      appointment("second", 11, 0, 30),
    ],
    layoutOptions,
  );

  assert.deepEqual(
    blocks.map((block) => ({
      id: block.item.id,
      lane: block.lane,
      laneCount: block.laneCount,
      leftPercent: block.leftPercent,
      widthPercent: block.widthPercent,
    })),
    [
      { id: "first", lane: 0, laneCount: 1, leftPercent: 0, widthPercent: 100 },
      { id: "second", lane: 0, laneCount: 1, leftPercent: 0, widthPercent: 100 },
    ],
  );
});

test("places overlapping appointments side by side in the same day column", () => {
  const blocks = layoutCalendarAppointments<TestAppointment>(
    [
      appointment("alpha", 10, 0, 60),
      appointment("bravo", 10, 30, 60),
      appointment("charlie", 11, 30, 30),
    ],
    layoutOptions,
  );

  const alpha = blocks.find((block) => block.item.id === "alpha");
  const bravo = blocks.find((block) => block.item.id === "bravo");
  const charlie = blocks.find((block) => block.item.id === "charlie");

  assert.ok(alpha);
  assert.ok(bravo);
  assert.ok(charlie);
  assert.equal(alpha.laneCount, 2);
  assert.equal(bravo.laneCount, 2);
  assert.equal(alpha.widthPercent, 50);
  assert.equal(bravo.widthPercent, 50);
  assert.notEqual(alpha.leftPercent, bravo.leftPercent);
  assert.equal(charlie.laneCount, 1);
  assert.equal(charlie.leftPercent, 0);
  assert.equal(charlie.widthPercent, 100);
});

test("uses enough lanes for three appointments that overlap at the same time", () => {
  const blocks = layoutCalendarAppointments<TestAppointment>(
    [
      appointment("alpha", 10, 0, 60),
      appointment("bravo", 10, 15, 30),
      appointment("charlie", 10, 30, 60),
    ],
    layoutOptions,
  );

  assert.equal(blocks.length, 3);
  blocks.forEach((block) => {
    assert.equal(block.laneCount, 3);
    assert.ok(Math.abs(block.widthPercent - 100 / 3) < 0.0001);
  });
  [0, 100 / 3, 200 / 3].forEach((expectedLeft, index) => {
    assert.ok(Math.abs(blocks[index].leftPercent - expectedLeft) < 0.0001);
  });
});

test("does not expose incomplete appointments to calendar views", () => {
  const calendarAppointments = toCalendarAppointments(
    [
      appointmentSummary("valid"),
      appointmentSummary("missing-patient", {
        patient: { id: "patient-2", fullName: "" },
      }),
      appointmentSummary("invalid-start", {
        startsAt: "not-a-date",
      }),
      appointmentSummary("invalid-duration", {
        startsAt: "2026-07-01T10:00:00.000Z",
        endsAt: "2026-07-01T10:00:00.000Z",
      }),
    ],
    [],
  );

  assert.deepEqual(
    calendarAppointments.map((item) => item.appointment.id),
    ["valid"],
  );
});

test("validates appointment times in five minute increments", () => {
  assert.equal(isMinuteStep(new Date(2026, 6, 1, 10, 0), 5), true);
  assert.equal(isMinuteStep(new Date(2026, 6, 1, 10, 5), 5), true);
  assert.equal(isMinuteStep(new Date(2026, 6, 1, 10, 3), 5), false);
  assert.equal(isMinuteStep(new Date(2026, 6, 1, 11, 47), 5), false);
  assert.equal(isMinuteStep(new Date(2026, 6, 1, 10, 10, 1), 5), false);
  assert.equal(isMinuteStep(new Date("not-a-date"), 5), false);
});
