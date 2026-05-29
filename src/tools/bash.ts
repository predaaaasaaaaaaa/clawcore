import { execSync } from "node:child_process";
import { createLogger } from "../logger.js";

const log = createLogger("tool:bash");

const MAX_OUTPUT = 10_000;       // chars returned to the model
const MAX_BUFFER = 10 * 1024 * 1024; // 10MB, prevents ENOBUFS on chatty commands

export type BashResult = { stdout: string; stderr: string; exitCode: number };

/** Run a shell command on the local machine.
 *  Uses the platform's default shell (cmd.exe on Windows, /bin/sh elsewhere).
 *  Never throws — failures come back as stderr + non-zero exitCode. */
export function executeBash(command: string, timeoutMs = 30_000): BashResult {
  log.info(`exec: ${command.slice(0, 120)}`);
  try {
    const stdout = execSync(command, {
      timeout: timeoutMs,
      maxBuffer: MAX_BUFFER,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout: truncate(stdout), stderr: "", exitCode: 0 };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: truncate(err.stdout ?? ""),
      stderr: (err.stderr ?? "").slice(0, 2_000),
      exitCode: err.status ?? 1,
    };
  }
}

function truncate(s: string): string {
  return s.length > MAX_OUTPUT ? s.slice(0, MAX_OUTPUT) + "\n[...truncated]" : s;
}