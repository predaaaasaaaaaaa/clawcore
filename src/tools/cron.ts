import { addJob, listJobs, removeJob } from "../cron/store.js";
import { type CronSchedule, describeSchedule, normalizeAtToIso } from "../cron/schedule.js";
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
        return 'Error: \'schedule\' is required, e.g. { "kind": "at", "at": "5m" } or { "kind": "cron", "expr": "0 9 * * *" }.';
      }

      // Resolve a one-shot 'at' (relative like "5m" OR absolute ISO) to an absolute timestamp here,
      // so the model never has to compute dates. Engine always stores absolute.
      if (schedule.kind === "at") {
        const iso = normalizeAtToIso(String((schedule as { at?: unknown }).at ?? ""));
        if (!iso) {
          return 'Error: couldn\'t understand the \'at\' time. Use a relative duration like "5m", "90s", "2h", or an absolute ISO-8601 timestamp.';
        }
        (schedule as { at: string }).at = iso;
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
      const key =
        typeof args.id === "string"
          ? args.id
          : typeof args.jobId === "string"
            ? args.jobId
            : typeof args.name === "string"
              ? args.name
              : "";
      if (!key) return "Error: 'id' (or 'name') is required to remove a job.";

      if (removeJob(key)) return `Removed cron job ${key}.`;

      // Fall back to matching by name (case-insensitive).
      const match = listJobs().find((j) => j.name.toLowerCase() === key.toLowerCase());
      if (match && removeJob(match.id)) return `Removed cron job "${match.name}" (${match.id}).`;

      return `No cron job found matching "${key}".`;
    }

    default:
      return `Unknown cron action "${action}". Use: add, list, or remove.`;
  }
}