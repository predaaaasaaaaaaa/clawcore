import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSON5 from "json5";
import { z } from "zod";
import { ConfigSchema, type ClawConfig } from "./types.js";
import { createLogger } from "../logger.js";

const log = createLogger("config");

const STATE_DIRNAME = ".clawcore";
const CONFIG_FILENAME = "clawcore.json";

/** Where ClawCore keeps everything: config, sessions, memory.db, login token.
 *  Override with CLAWCORE_STATE_DIR. Default: ~/.clawcore */
export function resolveStateDir(): string {
  return process.env.CLAWCORE_STATE_DIR ?? path.join(os.homedir(), STATE_DIRNAME);
}

export function resolveConfigPath(): string {
  return path.join(resolveStateDir(), CONFIG_FILENAME);
}

export function loadConfig(): ClawConfig {
  const configPath = resolveConfigPath();

  // No config yet → boot with safe defaults (no Telegram until a token is added).
  if (!fs.existsSync(configPath)) {
    log.warn(`No config at ${configPath} — using defaults`);
    return ConfigSchema.parse({});
  }

  let raw: string;
  try {
    raw = fs.readFileSync(configPath, "utf-8");
  } catch (err) {
    throw new Error(`Could not read config at ${configPath}: ${String(err)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON5.parse(raw);
  } catch (err) {
    throw new Error(`Config is not valid JSON5 (${configPath}): ${String(err)}`);
  }

  // Fail closed: an invalid config stops startup rather than running half-configured.
  const result = ConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Config validation failed (${configPath}):\n${issues}`);
  }

  log.info(`Config loaded from ${configPath}`);
  return result.data;
}