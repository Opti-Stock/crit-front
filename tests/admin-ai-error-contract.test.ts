import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

test("admin services preserve paginated metadata", async () => {
  const sources = await Promise.all([
    "src/features/admin/services/users.service.ts",
    "src/features/admin/services/clinics.service.ts",
    "src/features/admin/services/rooms.service.ts",
    "src/features/admin/services/appointment-types.service.ts",
  ].map((file) => readFile(new URL(file, root), "utf8")));

  for (const source of sources) {
    assert.match(source, /requestWithMeta/);
    assert.match(source, /meta/);
  }
});

test("admin pages expose list controls, pagination and drawer creation", async () => {
  const sources = await Promise.all([
    "src/apps/admin/pages/users-page.ts",
    "src/apps/admin/pages/clinics-page.ts",
    "src/apps/admin/pages/rooms-page.ts",
    "src/apps/admin/pages/appointment-types-page.ts",
  ].map((file) => readFile(new URL(file, root), "utf8")));

  for (const source of sources) {
    assert.match(source, /renderAdminListControls/);
    assert.match(source, /renderAdminPagination/);
    assert.match(source, /renderAdminDrawer/);
    assert.match(source, /data-admin-sort-by/);
  }
});

test("error page has retry and back navigation actions", async () => {
  const source = await readFile(new URL("src/features/errors/error-page.ts", root), "utf8");
  assert.match(source, /data-error-action/);
  assert.match(source, /data-error-back/);
  assert.match(source, /history\.back/);
});

test("history AI panel handles disabled local assistance", async () => {
  const source = await readFile(new URL("src/features/ai-assistance/history-ai-panel.ts", root), "utf8");
  assert.match(source, /AI_DISABLED/);
  assert.match(source, /assistanceDisabled/);
  assert.match(source, /history-ai__summarize/);
});
