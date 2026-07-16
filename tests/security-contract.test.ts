import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

test("browser authentication does not persist or attach access tokens", async () => {
  const sources = await Promise.all([
    "src/features/auth/services/session.service.ts",
    "src/features/super-admin/services/super-admin-session.service.ts",
    "src/services/api-client.ts",
    "src/services/realtime/sse-client.ts",
  ].map((file) => readFile(new URL(file, root), "utf8")));

  for (const source of sources) {
    assert.doesNotMatch(source, /accessToken|Authorization:\s*`Bearer|localStorage/);
  }
});

test("custom error page covers the controlled demo failure states", async () => {
  const source = await readFile(new URL("src/features/errors/error-page.ts", root), "utf8");
  for (const state of ["401", "403", "404", "500", "503", "offline"]) {
    assert.match(source, new RegExp(`${state}:|"${state}":`));
  }
  assert.match(source, /requestId/);
});
