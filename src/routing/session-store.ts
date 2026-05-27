import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../config/loader.js";

// One stored conversation turn. (Tool-call internals aren't persisted —
// only the visible user/assistant exchange, which is what we replay.)
export type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

// Each chat gets its own append-only .jsonl under ~/.clawcore/sessions/
function resolveSessionPath(key: string): string {
  const safe = key.replace(/[^a-z0-9_-]/gi, "_");
  const dir = path.join(resolveStateDir(), "sessions");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${safe}.jsonl`);
}

export function loadSession(key: string): Message[] {
  const file = resolveSessionPath(key);
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as Message;
      } catch {
        return null;
      }
    })
    .filter((m): m is Message => m !== null);
}

export function appendToSession(key: string, msg: Message): void {
  fs.appendFileSync(resolveSessionPath(key), JSON.stringify(msg) + "\n");
}

export function clearSession(key: string): void {
  const file = resolveSessionPath(key);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}