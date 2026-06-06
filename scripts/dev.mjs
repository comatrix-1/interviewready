import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();

const processes = [
  {
    name: "backend",
    cwd: resolve(root, "backend"),
    command: process.platform === "win32" ? "npx.cmd" : "npx",
    args: [
      "portless",
      "run",
      "--name",
      "interviewready-backend",
      "uv",
      "run",
      "fastapi",
      "dev",
    ],
  },
  {
    name: "frontend",
    cwd: resolve(root, "frontend"),
    command: process.platform === "win32" ? "npx.cmd" : "npx",
    args: [
      "portless",
      "run",
      "--name",
      "interviewready-frontend",
      "npm",
      "run",
      "dev",
    ],
  },
];

const children = processes.map(({ command, args, cwd }) =>
  spawn(command, args, {
    cwd,
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      PORTLESS_HTTPS: process.env.PORTLESS_HTTPS ?? "0",
    },
  }),
);

process.on("SIGINT", () => {
  children.forEach((child) => child.kill());
  process.exit();
});

process.on("SIGTERM", () => {
  children.forEach((child) => child.kill());
  process.exit();
});