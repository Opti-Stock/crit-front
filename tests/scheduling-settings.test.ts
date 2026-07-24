import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { ROLE_NAVIGATION_CONFIG } from "../src/features/auth/config/role-navigation.config.ts";

test("scheduling navigation is limited to intended operational roles", () => {
  const entry = ROLE_NAVIGATION_CONFIG.find((item) => item.key === "scheduling");
  assert.deepEqual(entry?.allowedRoles, ["recepcion", "coordinador", "admin"]);
});

test("coordinators can access the appointment calendar", () => {
  const entry = ROLE_NAVIGATION_CONFIG.find((item) => item.key === "calendar");
  assert.equal(entry?.allowedRoles.includes("coordinador"), true);
});

test("scheduling service uses only same-origin Main API paths", async () => {
  const source = await readFile(
    new URL("../src/services/main-api/scheduling.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /mainApiClient/);
  assert.doesNotMatch(source, /https?:\/\//);
  assert.match(source, /\/scheduling\/clinics\//);
});
