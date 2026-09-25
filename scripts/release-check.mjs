import { spawn } from "node:child_process";
import process from "node:process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const steps = [
  { label: "TypeScript", args: ["run", "typecheck"], timeoutMs: 120_000 },
  { label: "ESLint", args: ["run", "lint"], timeoutMs: 120_000 },
  { label: "Tests", args: ["test"], timeoutMs: 180_000 },
  { label: "Database pgTAP", args: ["run", "test:db"], timeoutMs: 180_000 },
  { label: "Production build", args: ["run", "build"], timeoutMs: 240_000 },
  { label: "Admin axe", args: ["run", "test:axe:admin"], timeoutMs: 240_000 },
];

function runStep(step) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(npm, step.args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
      shell: process.platform === "win32",
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${step.label} exceeded ${Math.round(step.timeoutMs / 1000)} seconds.`));
    }, step.timeoutMs);

    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      if (code === 0) {
        console.log(`[release:check] ${step.label} passed in ${durationSeconds}s`);
        resolve();
      }
      else reject(new Error(`${step.label} failed (${signal ? `signal ${signal}` : `exit ${code}`}).`));
    });
  });
}

for (const step of steps) {
  console.log(`\n[release:check] ${step.label}`);
  try {
    await runStep(step);
  } catch (error) {
    console.error(`[release:check] FAILED: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    break;
  }
}

if (!process.exitCode) console.log("\n[release:check] PASS");
