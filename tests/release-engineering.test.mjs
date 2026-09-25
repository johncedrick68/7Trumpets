import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("release check is bounded and non-destructive", async () => {
  const source = await read("scripts/release-check.mjs");
  assert.match(source, /setTimeout/);
  assert.match(source, /child\.kill\(\)/);
  assert.match(source, /process\.exitCode = 1/);
  assert.match(source, /test:axe:admin/);
  assert.match(source, /test:db/);
  assert.doesNotMatch(source, /db push|vercel deploy|git push|git merge|supabase seed/i);
});

test("release documentation preserves explicit production gates", async () => {
  const source = await read("docs/RELEASE_PROCESS.md");
  assert.match(source, /git push.*never implies database migration/i);
  assert.match(source, /explicit production migration approval/i);
  assert.match(source, /No item in this table authorizes applying a migration/i);
});
