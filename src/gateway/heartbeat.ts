import fs from "node:fs";
import path from "node:path";
import type { ClawConfig } from "../config/types.js";
import type { Skill } from "../skills/loader.js";
import { runAgent } from "../agent/runner.js";
import { resolveWorkspaceDir } from "../workspace/bootstrap.js";
import { createLogger } from "../logger.js";

const log = createLogger("heartbeat");

// Canonical heartbeat prompt (matches OpenClaw's default).
const HEARTBEAT_PROMPT =
  "Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. " +
  "Do not infer or repeat old tasks from prior chats. " +
  "If nothing needs attention, reply with only: HEARTBEAT_OK";

/** True if HEARTBEAT.md has no real tasks (only blanks, comments, or empty bullets). */
export function isHeartbeatEffectivelyEmpty(content: string): boolean {
  return content.split("\n").every((line) => {
    const t = line.trim();
    if (!t) return true; // blank
    if (t.startsWith("#")) return true; // comment / header
    if (/^[-*+]\s*(\[[\sxX]?\]\s*)?$/.test(t)) return true; // empty list item
    return false; // real content
  });
}

/** Parse "30m" | "2h" | "45s" | "0m"(disabled) into milliseconds. */
function parseDurationMs(raw: string): number | null {
  const t = raw.trim().toLowerCase();
  if (!t || t === "0" || t === "0m") return null;
  const m = t.match(/^(\d+(?:\.\d+)?)(s|m|h)?$/);
  if (!m) return null;
  const val = parseFloat(m[1]);
  if (m[2] === "h") return val * 3_600_000;
  if (m[2] === "s") return val * 1_000;
  return val * 60_000; // default minutes
}

export function startHeartbeatRunner(params: {
  config: ClawConfig;
  skills: Skill[];
  sendAlert: (text: string) => Promise<void>;
}): { stop: () => void } {
  const intervalMs = parseDurationMs(params.config.heartbeat?.every ?? "30m");
  if (!intervalMs) {
    log.info("heartbeat disabled (every=0m)");
    return { stop: () => {} };
  }

  const timer = setInterval(async () => {
    // Skip entirely if there's nothing to check — no API call, no token cost.
    const p = path.join(resolveWorkspaceDir(), "HEARTBEAT.md");
    if (fs.existsSync(p) && isHeartbeatEffectivelyEmpty(fs.readFileSync(p, "utf-8"))) {
      log.debug("HEARTBEAT.md empty → skipping");
      return;
    }

    log.info("running heartbeat check...");
    try {
      const { reply } = await runAgent({
        config: params.config,
        skills: params.skills,
        history: [],
        userMessage: HEARTBEAT_PROMPT,
      });

      // Strip the HEARTBEAT_OK sentinel and suppress trivial output.
      const text = reply
        .replace(/^HEARTBEAT_OK[.!]?\s*/i, "")
        .replace(/\s*HEARTBEAT_OK[.!]?$/i, "")
        .trim();

      if (!text || text.length < 10) {
        log.debug("heartbeat: nothing to report");
        return;
      }

      log.info(`heartbeat alert: ${text.slice(0, 80)}`);
      await params.sendAlert(text);
    } catch (e) {
      log.error(`heartbeat failed: ${String(e)}`);
    }
  }, intervalMs);

  timer.unref?.(); // don't keep the process alive just for the heartbeat
  log.info(`heartbeat running every ${params.config.heartbeat?.every ?? "30m"}`);
  return { stop: () => clearInterval(timer) };
}