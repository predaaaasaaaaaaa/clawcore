import express from "express";
import path from "node:path";
import { loadConfig, resolveStateDir } from "../config/loader.js";
import { loadSkillsFrom } from "../skills/loader.js";
import { startTelegramBot } from "../telegram/bot.js";
import { runBootFile } from "./boot.js";
import { startHeartbeatRunner } from "./heartbeat.js";
import { startCronService } from "../cron/service.js";
import { ensureWorkspaceFiles, resolveWorkspaceDir } from "../workspace/bootstrap.js";
import { isLoggedIn } from "../llm/codex-auth.js";
import { createLogger } from "../logger.js";

const log = createLogger("gateway");

export async function startGateway(): Promise<void> {
  log.info("🦞 Starting ClawCore gateway...");

  const config = loadConfig();
  log.info(`model: ${config.model} | port: ${config.port}`);

  await ensureWorkspaceFiles();

  // Skill discovery (OpenClaw precedence, lowest → highest):
  // bundled (ships with repo) → managed (~/.clawcore/skills) → workspace (<workspace>/skills).
  const skills = loadSkillsFrom([
    path.join(process.cwd(), "skills"),
    path.join(resolveStateDir(), "skills"),
    path.join(resolveWorkspaceDir(), "skills"),
  ]);
  log.info(`skills: ${skills.map((s) => s.name).join(", ") || "none"}`);

  if (!isLoggedIn()) {
    log.warn('Not logged into ChatGPT yet — run "npm run login". The bot will start but can\'t think until you do.');
  }

  // Local health endpoint.
  const app = express();
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      version: "clawcore-0.1",
      model: config.model,
      loggedIn: isLoggedIn(),
      skills: skills.map((s) => s.name),
      stateDir: resolveStateDir(),
    });
  });
  app.listen(config.port, "127.0.0.1", () => log.info(`health on http://127.0.0.1:${config.port}/health`));

  // Telegram channel + alert sink for the heartbeat.
  let sendAlert: ((text: string) => Promise<void>) | null = null;
  if (config.telegram) {
    try {
      const bot = startTelegramBot({ config, skills });
      const ownerId = config.telegram.allowFrom[0];
      if (ownerId) {
        sendAlert = (text) => bot.api.sendMessage(ownerId, text).then(() => {});
      }
      log.info("Telegram channel up ✅");
    } catch (e) {
      log.error(`Telegram failed to start: ${String(e)}`);
    }
  } else {
    log.warn("no Telegram config — add telegram.token + allowFrom to clawcore.json");
  }

 // Proactive heartbeat (only if we can deliver alerts and it's not disabled).
  if (sendAlert && config.heartbeat?.every !== "0m") {
    startHeartbeatRunner({ config, skills, sendAlert });
  }

  // Cron scheduler (needs Telegram delivery to report results).
  if (sendAlert) {
    startCronService({ config, skills, sendAlert });
  }

  // Optional one-time startup task.
  await runBootFile({ config, skills });

  log.info("🦞 ClawCore is running. Waiting for messages...");
}