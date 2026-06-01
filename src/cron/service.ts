import type { ClawConfig } from "../config/types.js";
import type { Skill } from "../skills/loader.js";
import { runAgent } from "../agent/runner.js";
import {
  type CronJob,
  listJobs,
  removeJob,
  updateJobState,
  recomputeNextRuns,
} from "./store.js";
import { computeNextRunAtMs } from "./schedule.js";
import { createLogger } from "../logger.js";

const log = createLogger("cron");

// Cap on a single setTimeout delay. Forces a recompute at least once a minute,
// which also absorbs clock drift and setTimeout's max-delay limit. (Matches OpenClaw.)
const MAX_TIMER_DELAY_MS = 60_000;

export function startCronService(params: {
  config: ClawConfig;
  skills: Skill[];
  sendAlert: (text: string) => Promise<void>;
}): { stop: () => void } {
  const { config, skills, sendAlert } = params;
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;

  // Recompute next-run times from "now" on boot (missed runs during downtime are skipped).
  recomputeNextRuns();
  const active = listJobs().filter((j) => j.enabled).length;
  log.info(`cron service started (${active} active job${active === 1 ? "" : "s"})`);

  // Run a job in an isolated session (no Telegram history) and deliver the result.
  async function fire(job: CronJob): Promise<"ok" | "error"> {
    log.info(`running cron job "${job.name}" (${job.id})`);
    const userMessage =
      `You are running a scheduled task named "${job.name}". ` +
      `Do the following and report the result concisely:\n\n${job.prompt}`;
    try {
      const { reply } = await runAgent({ config, skills, history: [], userMessage });
      await sendAlert(`⏰ ${job.name}\n\n${reply}`);
      return "ok";
    } catch (e) {
      log.error(`cron job "${job.name}" failed: ${String(e)}`);
      await sendAlert(`⏰ ${job.name} failed: ${String(e)}`).catch(() => {});
      return "error";
    }
  }

  async function tick(): Promise<void> {
    if (stopped) return;
    const now = Date.now();
    const due = listJobs().filter(
      (j) => j.enabled && typeof j.state.nextRunAtMs === "number" && j.state.nextRunAtMs <= now,
    );

    for (const job of due) {
      if (stopped) return;
      const status = await fire(job);
      const after = Date.now();
      if (job.schedule.kind === "at" && job.deleteAfterRun) {
        removeJob(job.id); // one-shot cleans itself up
      } else {
        updateJobState(job.id, {
          lastRunAtMs: after,
          lastStatus: status,
          nextRunAtMs: computeNextRunAtMs(job.schedule, after),
        });
      }
    }

    schedule();
  }

  function schedule(): void {
    if (stopped) return;
    const now = Date.now();
    let soonest = Infinity;
    for (const j of listJobs()) {
      if (j.enabled && typeof j.state.nextRunAtMs === "number") {
        soonest = Math.min(soonest, j.state.nextRunAtMs);
      }
    }
    const delay =
      soonest === Infinity ? MAX_TIMER_DELAY_MS : Math.max(0, Math.min(soonest - now, MAX_TIMER_DELAY_MS));
    timer = setTimeout(() => void tick(), delay);
    timer.unref?.();
  }

  schedule();

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}