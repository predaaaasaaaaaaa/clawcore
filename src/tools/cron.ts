import { addJob, listJobs, removeJob } from "../cron/store.js";
import { type CronSchedule, describeSchedule } from "../cron/schedule.js";
import { createLogger } from "../logger.js";

const log = createLogger("tool:cron");

/** Agent-facing cron management: add | list | remove. Returns a plain-text result. */
export function executeCron(args: Record<string, unknown>): string {
  const action = String(args.action ?? "");
  log.info(`cron action: ${action}`);

  switch (action) {
    case "list": {
      const jobs = listJobs();
      if (!jobs.length) return "No cron jobs scheduled.";
      return jobs
        .map((j) => {
          const next =
            j.enabled && j.state.nextRunAtMs
              ? new Date(j.state.nextRunAtMs).toISOString()
              : j.enabled
                ? "—"
                : "(disabled)";
          return `• [${j.id}] ${j.name} — ${describeSchedule(j.schedule)} — next: ${next}`;
        })
        .join("\n");
    }

    case "add": {
      const name = typeof args.name === "string" ? args.name.trim() : "";
      const prompt = typeof args.prompt === "string" ? args.prompt.trim() : "";
      const schedule = args.schedule as CronSchedule | undefined;
      if (!name) return "Error: 'name' is required.";
      if (!prompt) return "Error: 'prompt' is required (what the job should do).";
      if (!schedule || typeof schedule !== "object" || !("kind" in schedule)) {
        return 'Error: \'schedule\' is required, e.g. { "kind": "cron", "expr": "0 9 * * *" } or { "kind": "at", "at": "2026-06-01T09:00:00Z" }.';
      }
      try {
        const job = addJob({ name, prompt, schedule });
        const next = job.state.nextRunAtMs
          ? new Date(job.state.nextRunAtMs).toISOString()
          : "never (check the schedule)";
        return `Scheduled "${job.name}" [${job.id}] — ${describeSchedule(job.schedule)}. Next run: ${next}`;
      } catch (e) {
        return `Error: ${String(e)}`;
      }
    }

    case "remove": {
      const id = typeof args.id === "string" ? args.id : typeof args.jobId === "string" ? args.jobId : "";
      if (!id) return "Error: 'id' is required to remove a job.";
      return removeJob(id) ? `Removed cron job ${id}.` : `No cron job found with id ${id}.`;
    }

    default:
      return `Unknown cron action "${action}". Use: add, list, or remove.`;
  }
}