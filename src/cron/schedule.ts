import { Cron } from "croner";

// Mirrors OpenClaw's three schedule kinds.
export type CronSchedule =
  | { kind: "at"; at: string } // one-shot: ISO-8601 timestamp or epoch ms
  | { kind: "every"; everyMs: number; anchorMs?: number } // fixed interval
  | { kind: "cron"; expr: string; tz?: string }; // cron expression (+ optional IANA tz)

const ISO_TZ_RE = /(Z|[+-]\d{2}:?\d{2})$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T/;

function normalizeUtcIso(raw: string): string {
  if (ISO_TZ_RE.test(raw)) return raw;
  if (ISO_DATE_RE.test(raw)) return `${raw}T00:00:00Z`;
  if (ISO_DATE_TIME_RE.test(raw)) return `${raw}Z`;
  return raw;
}

export function parseAbsoluteTimeMs(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  }
  const parsed = Date.parse(normalizeUtcIso(raw));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Parse a relative duration like "90s", "5m", "2h", "1d", "in 10 minutes" → ms. */
export function parseDurationMs(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/^in\s+/, "");
  const m = s.match(
    /^(\d+(?:\.\d+)?)\s*(seconds|second|secs|sec|s|minutes|minute|mins|min|m|hours|hour|hrs|hr|h|days|day|d)$/,
  );
  if (!m) return null;
  const val = parseFloat(m[1]);
  if (!Number.isFinite(val) || val < 0) return null;
  const u = m[2];
  if (u.startsWith("s")) return val * 1000;
  if (u.startsWith("min") || u === "m") return val * 60_000;
  if (u.startsWith("h")) return val * 3_600_000;
  if (u.startsWith("d")) return val * 86_400_000;
  return null;
}

/** Resolve an `at` value (relative duration OR absolute epoch/ISO) to an absolute ISO string.
 *  Relative is tried first so the model never has to do date arithmetic. */
export function normalizeAtToIso(raw: string, nowMs = Date.now()): string | null {
  const t = raw.trim();
  if (!t) return null;
  const dur = parseDurationMs(t);
  if (dur !== null) return new Date(nowMs + dur).toISOString();
  const abs = parseAbsoluteTimeMs(t);
  if (abs !== null) return new Date(abs).toISOString();
  return null;
}

// Cache compiled cron expressions (croner is reused per expr+tz).
const cronCache = new Map<string, Cron>();
const CRON_CACHE_MAX = 100;

function resolveCron(expr: string, tz?: string): Cron {
  const timezone = tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const key = `${timezone}\u0000${expr}`;
  const cached = cronCache.get(key);
  if (cached) return cached;
  if (cronCache.size >= CRON_CACHE_MAX) {
    const oldest = cronCache.keys().next().value;
    if (oldest !== undefined) cronCache.delete(oldest);
  }
  const cron = new Cron(expr, { timezone, catch: false });
  cronCache.set(key, cron);
  return cron;
}

/** Next run time (ms), strictly after nowMs. undefined = never again. */
export function computeNextRunAtMs(schedule: CronSchedule, nowMs: number): number | undefined {
  if (schedule.kind === "at") {
    const at = parseAbsoluteTimeMs(schedule.at);
    if (at === null) return undefined;
    return at > nowMs ? at : undefined; // a one-shot in the past never fires
  }

  if (schedule.kind === "every") {
    const every = schedule.everyMs;
    if (!Number.isFinite(every) || every <= 0) return undefined;
    const anchor = schedule.anchorMs ?? nowMs;
    if (anchor > nowMs) return anchor;
    const steps = Math.floor((nowMs - anchor) / every) + 1;
    return anchor + steps * every;
  }

  // cron
  let cron: Cron;
  try {
    cron = resolveCron(schedule.expr, schedule.tz);
  } catch {
    return undefined;
  }
  const next = cron.nextRun(new Date(nowMs));
  let nextMs = next ? next.getTime() : NaN;
  if (!Number.isFinite(nextMs)) return undefined;

  // croner year-rollback workaround: retry from a moment later if not in the future.
  if (nextMs <= nowMs) {
    const retry = cron.nextRun(new Date(Math.floor(nowMs / 1000) * 1000 + 1000));
    nextMs = retry ? retry.getTime() : NaN;
    if (!Number.isFinite(nextMs) || nextMs <= nowMs) return undefined;
  }
  return nextMs;
}

/** Validate a schedule. Returns an error string, or null if valid. */
export function validateSchedule(schedule: CronSchedule): string | null {
  if (schedule.kind === "cron") {
    try {
      resolveCron(schedule.expr, schedule.tz);
    } catch (e) {
      return `invalid cron expression: ${String(e)}`;
    }
    return null;
  }
  if (schedule.kind === "at") {
    return parseAbsoluteTimeMs(schedule.at) === null ? "invalid 'at' timestamp" : null;
  }
  if (schedule.kind === "every") {
    return !Number.isFinite(schedule.everyMs) || schedule.everyMs <= 0
      ? "invalid 'every' interval (everyMs must be > 0)"
      : null;
  }
  return "unknown schedule kind";
}

/** Human-readable schedule for logs and tool replies. */
export function describeSchedule(schedule: CronSchedule): string {
  if (schedule.kind === "at") return `once at ${schedule.at}`;
  if (schedule.kind === "every") return `every ${Math.round(schedule.everyMs / 1000)}s`;
  return `cron "${schedule.expr}"${schedule.tz ? ` (${schedule.tz})` : ""}`;
}