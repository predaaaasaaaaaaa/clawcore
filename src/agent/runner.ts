import fs from "node:fs";
import path from "node:path";
import type {
  Api,
  AssistantMessage,
  Context,
  Message as PiMessage,
  Provider,
  TextContent,
  ToolCall,
  Usage,
} from "@mariozechner/pi-ai";
import type { ClawConfig } from "../config/types.js";
import type { Skill } from "../skills/loader.js";
import type { Message as SessionMessage } from "../routing/session-store.js";
import { llmComplete } from "../llm/client.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { TOOL_DEFINITIONS } from "../tools/definitions.js";
import { executeBash } from "../tools/bash.js";
import { readFile, writeFile, listDirectory, deleteFile } from "../tools/file.js";
import { fetchUrl } from "../tools/browser.js";
import { getSystemInfo } from "../tools/system.js";
import { appendDailyMemory, resolveWorkspaceDir } from "../workspace/bootstrap.js";
import { storeMemory } from "../memory/index.js";
import { createLogger } from "../logger.js";

const log = createLogger("agent");

const MAX_ITERATIONS = 20; // tool-call rounds per message before we bail
const MAX_HISTORY = 40;     // replayed past turns (context-trim — keeps context bounded)

const ZERO_USAGE: Usage = {
  input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

export async function runAgent(params: {
  config: ClawConfig;
  skills: Skill[];
  history: SessionMessage[];
  userMessage: string;
  signal?: AbortSignal;
}): Promise<{ reply: string; toolsUsed: string[] }> {
  const { config, skills, history, userMessage, signal } = params;

  const systemPrompt = buildSystemPrompt({ config, skills, userMessage });

  // Replay trimmed history, then the new user message.
  const messages: PiMessage[] = [
    ...historyToMessages(history.slice(-MAX_HISTORY)),
    { role: "user", content: userMessage, timestamp: Date.now() },
  ];

  const toolsUsed: string[] = [];

  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    log.debug(`loop iteration ${i}`);

    const context: Context = { systemPrompt, messages, tools: TOOL_DEFINITIONS };
    const assistant = await llmComplete({ config, context, signal });
    messages.push(assistant);

    const toolCalls = assistant.content.filter((c): c is ToolCall => c.type === "toolCall");

    if (assistant.stopReason !== "toolUse" || toolCalls.length === 0) {
      if (assistant.stopReason === "error") {
        return { reply: assistant.errorMessage || "Something went wrong talking to the model.", toolsUsed };
      }
      const reply = extractText(assistant) || "(done)";
      log.info(`done in ${i} iteration(s); tools: ${toolsUsed.join(", ") || "none"}`);
      return { reply, toolsUsed };
    }

    // Run each requested tool, append its result.
    for (const tc of toolCalls) {
      toolsUsed.push(tc.name);
      log.info(`tool: ${tc.name}`);
      const result = await executeTool(tc.name, tc.arguments);
      messages.push({
        role: "toolResult",
        toolCallId: tc.id,
        toolName: tc.name,
        content: [{ type: "text", text: result }],
        isError: /^error\b/i.test(result) || result.startsWith("Tool error"),
        timestamp: Date.now(),
      });
    }
  }

  log.warn(`hit max iterations (${MAX_ITERATIONS})`);
  return { reply: "I hit the step limit on that one — try breaking it into smaller requests.", toolsUsed };
}

function extractText(m: AssistantMessage): string {
  return m.content
    .filter((c): c is TextContent => c.type === "text")
    .map((c) => c.text)
    .join("\n")
    .trim();
}

// Past turns are stored as plain {role, content}. pi-ai assistant messages need
// metadata fields too; we fill inert placeholders (pi-ai only reads role+content on input).
function historyToMessages(history: SessionMessage[]): PiMessage[] {
  return history.map((m) => {
    const timestamp = Date.parse(m.timestamp) || Date.now();
    if (m.role === "user") {
      return { role: "user", content: m.content, timestamp };
    }
    return {
      role: "assistant",
      content: [{ type: "text", text: m.content }],
      api: "openai-codex-responses" as unknown as Api,
      provider: "openai-codex" as unknown as Provider,
      model: "history",
      usage: ZERO_USAGE,
      stopReason: "stop",
      timestamp,
    } satisfies AssistantMessage;
  });
}

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case "bash": {
        const r = executeBash(args.command as string, args.timeout_ms as number | undefined);
        return [
          r.stdout ? `stdout:\n${r.stdout}` : "",
          r.stderr ? `stderr:\n${r.stderr}` : "",
          `exit code: ${r.exitCode}`,
        ].filter(Boolean).join("\n");
      }
      case "read_file": return readFile(args.path as string);
      case "write_file": return writeFile(args.path as string, args.content as string);
      case "list_directory": return listDirectory(args.path as string);
      case "delete_file": return deleteFile(args.path as string);
      case "fetch_url": {
        const r = await fetchUrl(args.url as string);
        return r.error ? `Error: ${r.error}` : `Status: ${r.statusCode}\n\n${r.content}`;
      }
      case "system_info": return getSystemInfo();
      case "write_memory": {
        const content = args.content as string;
        const type = (args.type as string) === "daily" ? "daily" : "long_term";
        if (type === "daily") {
          appendDailyMemory(content);
        } else {
          fs.appendFileSync(path.join(resolveWorkspaceDir(), "MEMORY.md"), `\n- ${content}\n`, "utf-8");
        }
        storeMemory(type, content); // also index in SQLite so searchMemory can recall it
        return `Saved to ${type} memory.`;
      }
      default: return `Unknown tool: ${name}`;
    }
  } catch (e) {
    return `Tool error: ${String(e)}`;
  }
}