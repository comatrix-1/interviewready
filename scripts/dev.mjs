import { spawn } from "node:child_process";
import { get } from "node:http";
import { resolve } from "node:path";

const root = process.cwd();

const BACKEND_HEALTH_URL = "http://localhost:8000/health";
const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 60_000;

function waitForBackend() {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    function poll() {
      get(BACKEND_HEALTH_URL, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else if (Date.now() - start >= POLL_TIMEOUT_MS) {
          reject(new Error(`Backend not ready after ${POLL_TIMEOUT_MS}ms`));
        } else {
          setTimeout(poll, POLL_INTERVAL_MS);
        }
        res.resume(); // drain the response
      }).on("error", () => {
        if (Date.now() - start >= POLL_TIMEOUT_MS) {
          reject(new Error(`Backend not ready after ${POLL_TIMEOUT_MS}ms`));
        } else {
          setTimeout(poll, POLL_INTERVAL_MS);
        }
      });
    }

    poll();
  });
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const spawnOpts = {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PORTLESS_HTTPS: process.env.PORTLESS_HTTPS ?? "0" },
};

const backend = spawn(
  npx,
  ["portless", "run", "--name", "interviewready-backend", "uv", "run", "fastapi", "dev"],
  { ...spawnOpts, cwd: resolve(root, "backend") },
);

const children = [backend];

function spawnFrontend() {
  const frontend = spawn(
    npx,
    ["portless", "run", "--name", "interviewready-frontend", "npm", "run", "dev"],
    { ...spawnOpts, cwd: resolve(root, "frontend") },
  );
  children.push(frontend);
}

console.log("[dev] Waiting for backend to be ready...");
waitForBackend()
  .then(() => {
    console.log("[dev] Backend ready. Starting frontend.");
    spawnFrontend();
  })
  .catch((err) => {
    console.error(`[dev] ${err.message}. Starting frontend anyway.`);
    spawnFrontend();
  });

function shutdown() {
  children.forEach((child) => child.kill());
  process.exit();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);