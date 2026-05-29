import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import readline from "node:readline/promises";
import {
  loginOpenAICodex,
  refreshOpenAICodexToken,
  type OAuthCredentials,
} from "@mariozechner/pi-ai/oauth";
import { resolveStateDir } from "../config/loader.js";
import { createLogger } from "../logger.js";

const log = createLogger("auth");

// ChatGPT login token. Lives in the state dir (~/.clawcore), never in the repo.
function credentialsPath(): string {
  return path.join(resolveStateDir(), "openai-codex-auth.json");
}

export function loadCredentials(): OAuthCredentials | null {
  const p = credentialsPath();
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as OAuthCredentials;
  } catch {
    return null;
  }
}

function saveCredentials(creds: OAuthCredentials): void {
  const p = credentialsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(creds, null, 2), { mode: 0o600 });
}

export function isLoggedIn(): boolean {
  return loadCredentials() !== null;
}

// Best-effort: open the auth URL in the default browser (cross-platform).
function openUrl(url: string): void {
  const cmd =
    process.platform === "win32" ? "cmd" :
    process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
  } catch {
    /* user can still paste the URL manually */
  }
}

/** Run the ChatGPT (OpenAI Codex) OAuth login and persist the credentials. */
export async function loginCodex(): Promise<OAuthCredentials> {
  log.info("Starting ChatGPT login (OpenAI Codex OAuth)...");

  const creds = await loginOpenAICodex({
    onAuth: ({ url, instructions }) => {
      console.log("\n🦞 Sign in to ChatGPT to authorize ClawCore:\n");
      console.log("   " + url + "\n");
      if (instructions) console.log("   " + instructions + "\n");
      openUrl(url);
    },
    onPrompt: async (prompt) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      try {
        return (await rl.question(prompt.message + " ")).trim();
      } finally {
        rl.close();
      }
    },
    onProgress: (msg) => log.info(msg),
  });

  saveCredentials(creds);
  log.info("ChatGPT login complete — credentials saved.");
  return creds;
}

/** Return a valid access token, refreshing it if it's expired or about to expire. */
export async function getValidAccessToken(): Promise<string> {
  const creds = loadCredentials();
  if (!creds) {
    throw new Error('Not logged in. Run "npm run login" to sign in with ChatGPT.');
  }

  const skewMs = 60_000; // refresh a minute early
  if (typeof creds.expires === "number" && Date.now() >= creds.expires - skewMs) {
    log.info("Access token expired — refreshing...");
    const refreshed = await refreshOpenAICodexToken(creds.refresh);
    saveCredentials(refreshed);
    return refreshed.access;
  }

  return creds.access;
}