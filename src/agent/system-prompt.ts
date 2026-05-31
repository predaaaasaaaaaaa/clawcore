import os from "node:os";
import type { ClawConfig } from "../config/types.js";
import { loadWorkspaceFiles, resolveWorkspaceDir } from "../workspace/bootstrap.js";
import { searchMemory } from "../memory/index.js";
import { buildSkillsSystemPrompt, type Skill } from "../skills/loader.js";

/** Assemble the full system prompt: identity + tools + rules + machine context
 *  + the workspace files (SOUL/USER/AGENTS/MEMORY/daily) + relevant memory + skills. */
export function buildSystemPrompt(params: {
  config: ClawConfig;
  skills: Skill[];
  userMessage: string;
}): string {
  const { config, skills, userMessage } = params;

  const workspaceDir = resolveWorkspaceDir();
  const workspace = loadWorkspaceFiles("main");
  const workspaceSection = Object.keys(workspace).length
    ? [
        "# Workspace Files",
        `Your workspace directory is: ${workspaceDir}`,
        "These files are already loaded below — you don't need to re-read them. To read, write, edit, or delete any workspace file (AGENTS.md, IDENTITY.md, USER.md, MEMORY.md, BOOTSTRAP.md, etc.), use its full path inside that directory.",
        ...Object.entries(workspace).map(([n, c]) => `## ${n}\n\n${c}`),
      ].join("\n\n")
    : "";

  const mem = searchMemory(userMessage, 5);
  const memSection = mem.length
    ? "# Relevant Long-Term Memory\n\n" + mem.map((m) => `- ${m}`).join("\n")
    : "";

  return [
    "# Identity",
    `You are ${config.identity.name} (@${config.identity.handle}), a personal AI assistant running directly on your human's machine, reachable over Telegram. You have real access to this system through tools. Act — don't just explain.`,
    "",
    "# Tools",
    "bash, read_file, write_file, list_directory, delete_file, fetch_url, system_info, write_memory. Use them to actually accomplish tasks. If a command fails, read the error, fix it, and retry — don't give up after one attempt.",
    "",
    "# Core Rules",
    "- Act, don't advise: when asked to do something, do it with the tools.",
    "- Ask once before irreversible or external actions (deleting data, sending messages, installing software).",
    "- When you learn a durable fact about your human, call write_memory immediately.",
    "- Reply in plain text for Telegram — no markdown symbols (* _ ` #); they show up literally.",
    "",
    "# System",
    `OS: ${os.type()} ${os.release()} (${os.arch()}) | User: ${process.env.USER ?? process.env.USERNAME ?? "unknown"} | Host: ${os.hostname()}`,
    `Time: ${new Date().toISOString()}`,
    "",
    workspaceSection,
    memSection,
    buildSkillsSystemPrompt(skills),
  ]
    .filter(Boolean)
    .join("\n\n");
}