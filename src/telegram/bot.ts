import { Bot, GrammyError } from "grammy";
import type { ClawConfig } from "../config/types.js";
import type { Skill } from "../skills/loader.js";
import { runAgent } from "../agent/runner.js";
import { loadSession, appendToSession, clearSession } from "../routing/session-store.js";
import { createLogger } from "../logger.js";

const log = createLogger("telegram");
const MAX_MSG = 4096; // Telegram's per-message character limit

export function startTelegramBot(params: { config: ClawConfig; skills: Skill[] }): Bot {
  const { config, skills } = params;
  if (!config.telegram) throw new Error("no telegram config");

  const allow = config.telegram.allowFrom.map(String);
  const bot = new Bot(config.telegram.token);

  // Allowlist guard — runs before everything. Unknown users get told their own ID.
  bot.use(async (ctx, next) => {
    const userId = String(ctx.from?.id ?? "");
    if (!allow.includes(userId)) {
      log.warn(`blocked unauthorized user: ${userId}`);
      if (ctx.chat) {
        await ctx.reply(`Not authorized. Your Telegram ID is ${userId} — add it to allowFrom in clawcore.json.`);
      }
      return; // stop here — don't call next()
    }
    return next();
  });

  bot.command(["start", "help"], async (ctx) => {
    await ctx.reply(
      `🦞 Hi! I'm ${config.identity.name}.\n\n` +
        `I run on your machine and can:\n` +
        `• Run commands and scripts\n` +
        `• Read and write files\n` +
        `• Browse the web\n` +
        `• Remember things about you\n` +
        `• Check on your system proactively\n\n` +
        `/clear — start a fresh conversation\n` +
        `/skills — list my skills`,
    );
  });

  bot.command("clear", async (ctx) => {
    clearSession(`telegram:${ctx.chat.id}`);
    await ctx.reply("✅ Conversation cleared. Fresh start.");
  });

  bot.command("skills", async (ctx) => {
    const list = skills.length ? skills.map((s) => `• ${s.name}`).join("\n") : "(no skills loaded)";
    await ctx.reply(`Active skills:\n${list}`);
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith("/")) return; // unknown command — ignore

    const sessionKey = `telegram:${ctx.chat.id}`;
    log.info(`message from ${ctx.from?.id}: "${text.slice(0, 60)}"`);

    // Keep "typing…" alive while the agent works (tool loops can take a while).
    await ctx.replyWithChatAction("typing").catch(() => {});
    const typing = setInterval(() => void ctx.replyWithChatAction("typing").catch(() => {}), 4000);

    try {
      const history = loadSession(sessionKey);
      const { reply, toolsUsed } = await runAgent({ config, skills, history, userMessage: text });

      appendToSession(sessionKey, { role: "user", content: text, timestamp: new Date().toISOString() });
      appendToSession(sessionKey, { role: "assistant", content: reply, timestamp: new Date().toISOString() });
      if (toolsUsed.length) log.info(`tools used: ${toolsUsed.join(", ")}`);

      for (let i = 0; i < reply.length; i += MAX_MSG) {
        await ctx.reply(reply.slice(i, i + MAX_MSG));
      }
    } catch (e) {
      log.error(`agent error: ${String(e)}`);
      await ctx.reply(`❌ Something went wrong: ${String(e)}`);
    } finally {
      clearInterval(typing);
    }
  });

  // 409 = two pollers at once (the classic footgun).
  bot.catch((err) => {
    const e = err.error;
    if (e instanceof GrammyError && e.error_code === 409) {
      log.error("Telegram 409 conflict — another instance is polling. Run only ONE (don't run `npm run dev` and `npm start` together).");
    } else {
      log.error(`bot error: ${String(e)}`);
    }
  });

  // Long polling in the background — don't await, the gateway keeps running.
  bot.start({ drop_pending_updates: true, onStart: () => log.info("Telegram bot polling ✅") })
    .catch((e) => log.error(`failed to start polling: ${String(e)}`));

  return bot;
}