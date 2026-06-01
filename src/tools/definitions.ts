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
      "Schedule tasks to run later, automatically, even when the user isn't chatting. The result is delivered to the user over Telegram. " +
      "Use this for reminders and recurring jobs ('remind me at 3pm', 'every day at 9am check X'). Actions:\n" +
      "- add: create a job. Requires name, prompt (what to do when it fires), and schedule.\n" +
      "- list: list all scheduled jobs.\n" +
      "- remove: delete a job by id.\n" +
      "Schedule kinds:\n" +
      '- one-shot at a time: { "kind": "at", "at": "2026-06-01T09:00:00Z" } (ISO-8601, prefer UTC)\n' +
      '- recurring cron expression: { "kind": "cron", "expr": "0 9 * * *", "tz": "Africa/Algiers" } (tz optional, IANA name)\n' +
      '- fixed interval: { "kind": "every", "everyMs": 3600000 }',
    parameters: Type.Object(
      {
        action: Type.Union([Type.Literal("add"), Type.Literal("list"), Type.Literal("remove")], {
          description: "add, list, or remove",
        }),
        name: Type.Optional(Type.String({ description: "Job name (for add)." })),
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
              at: Type.Optional(Type.String({ description: "ISO-8601 timestamp (kind=at)." })),
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