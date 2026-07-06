import assert from "node:assert/strict";
import test from "node:test";

import { layoutCalendarAppointments } from "../src/features/calendar/utils/calendar-layout.ts";

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
