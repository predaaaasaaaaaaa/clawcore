import { Type } from "typebox";
import type { Tool } from "@mariozechner/pi-ai";

// pi-ai Tool = { name, description, parameters (typebox schema) }.
// The runner maps each name to its executor; pi-ai converts these schemas
// to the provider's tool-call format automatically.
export const TOOL_DEFINITIONS: Tool[] = [
  {
    name: "bash",
    description:
      "Execute a shell command on the local machine (cmd.exe on Windows, /bin/sh on macOS/Linux). Use for scripts, system state, file ops, services. Returns stdout, stderr, exit code.",
    parameters: Type.Object({
      command: Type.String({ description: "The shell command to execute." }),
      timeout_ms: Type.Optional(
        Type.Number({ description: "Timeout in milliseconds. Default 30000." }),
      ),
    }),
  },
  {
    name: "read_file",
    description: "Read a UTF-8 text file from the local filesystem.",
    parameters: Type.Object({
      path: Type.String({ description: "Absolute or relative file path." }),
    }),
  },
  {
    name: "write_file",
    description: "Write (create or overwrite) a UTF-8 text file.",
    parameters: Type.Object({
      path: Type.String({ description: "Path to write to." }),
      content: Type.String({ description: "Full file content." }),
    }),
  },
  {
    name: "list_directory",
    description: "List the entries of a directory.",
    parameters: Type.Object({
      path: Type.String({ description: "Directory path." }),
    }),
  },
  {
    name: "delete_file",
    description:
      "Delete a single file (refuses directories). Ask the user first before deleting anything they didn't explicitly tell you to remove.",
    parameters: Type.Object({
      path: Type.String({ description: "Path of the file to delete." }),
    }),
  },
  {
    name: "fetch_url",
    description:
      "Fetch a web page or API URL and return readable text. Use to check sites, read docs, or fetch JSON.",
    parameters: Type.Object({
      url: Type.String({ description: "Full URL including https://" }),
    }),
  },
  {
    name: "system_info",
    description:
      "Get a structured snapshot of the machine: OS, CPU load, RAM, disk, network. Prefer this over multiple bash commands for system health.",
    parameters: Type.Object({}),
  },
  {
    name: "write_memory",
    description:
      "Save a note to persistent memory. Use when the user says 'remember this' or you learn an important durable fact. type='daily' for today's notes, type='long_term' for permanent facts.",
    parameters: Type.Object({
      content: Type.String({ description: "The fact or note to remember." }),
      type: Type.Union([Type.Literal("daily"), Type.Literal("long_term")], {
        description: "daily or long_term",
      }),
    }),
  },
  {
    name: "cron",
    description:
      "Schedule tasks to run later, automatically, even when the user isn't chatting. Results are delivered over Telegram. Actions: add (needs name, prompt, schedule), list, remove (needs id or name).\n" +
      "CHOOSING THE SCHEDULE KIND:\n" +
      "- A reminder/task at ONE future moment is ONE-SHOT → kind:'at'. For 'in N minutes/hours/seconds', set \"at\" to a RELATIVE DURATION STRING and let the system resolve it. DO NOT compute a timestamp yourself. Examples: 'remind me in 1 minute' → at:'1m'; 'in 90 seconds' → at:'90s'; 'in 2 hours' → at:'2h'. For an explicit clock time you may pass an absolute ISO-8601 string instead.\n" +
      "- Use kind:'cron' (or 'every') ONLY for REPEATING tasks ('every day at 9am', 'each morning', 'every 30 minutes').\n" +
      "Schedule shapes:\n" +
      '- one-shot relative: { "kind": "at", "at": "5m" }   (also accepts "90s", "2h", "1d")\n' +
      '- one-shot absolute: { "kind": "at", "at": "2026-06-04T21:00:00Z" }\n' +
      '- recurring cron:    { "kind": "cron", "expr": "0 9 * * *", "tz": "Africa/Algiers" }\n' +
      '- fixed interval:    { "kind": "every", "everyMs": 1800000 }\n' +
      "To remove a job, call list first to get its id, then remove with that id (or the job name).",
    parameters: Type.Object(
      {
        action: Type.Union([Type.Literal("add"), Type.Literal("list"), Type.Literal("remove")], {
          description: "add, list, or remove",
        }),
        name: Type.Optional(Type.String({ description: "Job name (for add; also usable for remove)." })),
        prompt: Type.Optional(
          Type.String({ description: "What the agent should do when the job fires (for add)." }),
        ),
        schedule: Type.Optional(
          Type.Object(
            {
              kind: Type.Optional(
                Type.Union([Type.Literal("at"), Type.Literal("every"), Type.Literal("cron")]),
              ),
              expr: Type.Optional(Type.String({ description: "Cron expression (kind=cron)." })),
              tz: Type.Optional(Type.String({ description: "IANA timezone (kind=cron)." })),
              at: Type.Optional(
                Type.String({ description: 'Relative duration ("5m","90s","2h") or absolute ISO-8601 (kind=at).' }),
              ),
              everyMs: Type.Optional(Type.Number({ description: "Interval in ms (kind=every)." })),
              anchorMs: Type.Optional(Type.Number({ description: "Optional interval anchor (kind=every)." })),
            },
            { additionalProperties: true },
          ),
        ),
        id: Type.Optional(Type.String({ description: "Job id (for remove)." })),
      },
      { additionalProperties: true },
    ),
  },
];