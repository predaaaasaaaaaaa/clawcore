import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../config/loader.js";
import {
  type CronSchedule,
  computeNextRunAtMs,
  validateSchedule,
} from "./schedule.js";
import { createLogger } from "../logger.js";

const log = createLogger("cron");

export type CronJobState = {
  nextRunAtMs?: number;
  lastRunAtMs?: number;
  lastStatus?: "ok" | "error";
};

export type CronJob = {
  id: string;
  name: string;
  schedule: CronSchedule;
  prompt: string; // what the agent should do when it fires
  enabled: boolean;
  deleteAfterRun: boolean; // one-shot jobs remove themselves after running
  createdAtMs: number;
  state: CronJobState;
};

export type CronStore = { version: 1; jobs: CronJob[] };

function storePath(): string {
  return path.join(resolveStateDir(), "cron.json");
}

export function loadStore(): CronStore {
  const p = storePath();
  if (!fs.existsSync(p)) return { version: 1, jobs: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(p, "utf-8")) as Partial<CronStore>;
    return { version: 1, jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [] };
  } catch (e) {
    log.warn(`could not read cron store, starting empty: ${String(e)}`);
    return { version: 1, jobs: [] };
  }
}

export function saveStore(store: CronStore): void {
  const p = storePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(store, null, 2), "utf-8");
}

export function listJobs(): CronJob[] {
  return loadStore().jobs;
}

export function getJob(id: string): CronJob | undefined {
  return loadStore().jobs.find((j) => j.id === id);
}

/** Create and persist a new job. Throws (with a clear message) on a bad schedule. */
export function addJob(input: {
  name: string;
  schedule: CronSchedule;
  prompt: string;
  enabled?: boolean;
  deleteAfterRun?: boolean;
}): CronJob {
  const err = validateSchedule(input.schedule);
  if (err) throw new Error(err);

  const now = Date.now();
  const job: CronJob = {
    id: randomUUID().slice(0, 8),
    name: input.name,
    schedule: input.schedule,
    prompt: input.prompt,
    enabled: input.enabled ?? true,
    deleteAfterRun: input.deleteAfterRun ?? input.schedule.kind === "at",
    createdAtMs: now,
    state: { nextRunAtMs: computeNextRunAtMs(input.schedule, now) },
  };

  const store = loadStore();
  store.jobs.push(job);
  saveStore(store);
  log.info(`added cron job "${job.name}" (${job.id})`);
  return job;
}

export function removeJob(id: string): boolean {
  const store = loadStore();
  const before = store.jobs.length;
  store.jobs = store.jobs.filter((j) => j.id !== id);
  if (store.jobs.length === before) return false;
  saveStore(store);
  log.info(`removed cron job ${id}`);
  return true;
}

/** Persist updated state for one job (used by the service after each run). */
export function updateJobState(id: string, patch: Partial<CronJobState>): void {
  const store = loadStore();
  const job = store.jobs.find((j) => j.id === id);
  if (!job) return;
  job.state = { ...job.state, ...patch };
  saveStore(store);
}

/** Recompute nextRunAtMs for all enabled jobs (called on startup). */
export function recomputeNextRuns(now = Date.now()): CronStore {
  const store = loadStore();
  for (const job of store.jobs) {
    job.state.nextRunAtMs = job.enabled ? computeNextRunAtMs(job.schedule, now) : undefined;
  }
  saveStore(store);
  return store;
}