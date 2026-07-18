import { readFile } from "node:fs/promises";

const files = [
  "src/features/auth/services/session.service.ts",
  "src/features/super-admin/services/super-admin-session.service.ts",
  "src/services/api-client.ts",
  "src/services/realtime/sse-client.ts",
];
const errors = [];

for (const file of files) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  if (/accessToken|Authorization:\s*`Bearer|localStorage/.test(source)) {
    errors.push(`${file}: browser credentials must remain in HttpOnly cookies`);
  }
}

const envSource = await readFile(new URL("../src/config/env.ts", import.meta.url), "utf8");
if (!envSource.includes('appConfig.appEnv !== "local"')) {
  errors.push("src/config/env.ts: non-local bypass guard is required");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("Frontend source security contract passed");
