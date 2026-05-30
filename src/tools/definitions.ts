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
];