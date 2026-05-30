import fs from "node:fs";
import path from "node:path";
import type { ClawConfig } from "../config/types.js";
import type { Skill } from "../skills/loader.js";
import { runAgent } from "../agent/runner.js";
import { resolveWorkspaceDir } from "../workspace/bootstrap.js";
import { createLogger } from "../logger.js";

const log = createLogger("boot");

/** If BOOT.md exists, run its instructions once through the agent at startup.
 *  Useful for "on boot, check X and note it". Output is logged, not sent to chat. */
export async function runBootFile(params: { config: ClawConfig; skills: Skill[] }): Promise<void> {
  const bootPath = path.join(resolveWorkspaceDir(), "BOOT.md");
  if (!fs.existsSync(bootPath)) {
    log.debug("no BOOT.md — skipping startup task");
    return;
  }

  const content = fs.readFileSync(bootPath, "utf-8").trim();
  if (!content) return;

  log.info("running BOOT.md startup task...");
  try {
    const { reply } = await runAgent({
      config: params.config,
      skills: params.skills,
      history: [],
      userMessage: `You are running a one-time startup task. Follow these BOOT.md instructions exactly:\n\n${content}`,
    });
    log.info(`boot task done: ${reply.slice(0, 120)}`);
  } catch (e) {
    log.error(`boot task failed: ${String(e)}`);
  }
}