import { startGateway } from "./gateway/server.js";
import { loginCodex } from "./llm/codex-auth.js";
import { createLogger } from "./logger.js";

const log = createLogger("entry");

// Safety nets — never let one stray error take the bot down silently.
process.on("unhandledRejection", (reason) => log.error(`unhandled rejection: ${String(reason)}`));
process.on("uncaughtException", (err) => {
  log.error(`uncaught exception: ${String(err)}`);
  process.exit(1);
});
process.on("SIGINT", () => {
  log.info("shutting down...");
  process.exit(0);
});
process.on("SIGTERM", () => {
  log.info("shutting down...");
  process.exit(0);
});

const command = process.argv[2];

async function main(): Promise<void> {
  if (command === "login") {
    await loginCodex();
    log.info("Login complete. Now run: npm start");
    process.exit(0);
  }
  await startGateway();
}

main().catch((e) => {
  log.error(`fatal startup error: ${String(e)}`);
  process.exit(1);
});