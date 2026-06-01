# ClawCore 🦞

A personal AI assistant that runs **on your own machine** and talks to you over Telegram. It has real hands (runs shell commands, reads/writes files), real eyes (inspects your system, fetches the web), and a memory that survives restarts. It thinks using **your ChatGPT subscription** — no per-token API bill.

ClawCore is a deliberately **small core**. It mirrors the architecture of larger agent runtimes but strips it to the essentials: one channel, a handful of tools, a clean memory model, and a proactive heartbeat. No sprawling plugin ecosystem, no fifty tools you'll never call — just a fast, legible agent you can read end-to-end and extend when you actually need to.

> Built from scratch in TypeScript. ~20 small files. No build step. No native dependencies.

---

## Why this exists

Most "personal AI" frameworks are huge and do a hundred things you'll never use. ClawCore is the opposite: the **smallest thing that still feels like a real autonomous assistant**. Lightweight, fast to boot, easy to audit, and hard to outgrow.

## What it can do

- **Run shell commands** on your machine
- **Read, write, list, and delete files**
- **Inspect your system** — CPU, RAM, disk, network (cross-platform: Windows / macOS / Linux)
- **Browse the web** — fetch pages and APIs
- **Remember** — short-term and long-term, across restarts
- **Act proactively** on a schedule (heartbeat)
- **Learn new abilities** from drop-in Markdown skills

## How it works

Telegram is the channel you talk through. Your message goes to the Gateway, which hands it to the Agent loop. The agent thinks using your ChatGPT subscription, and between turns it can call tools, consult skills, and read its workspace files. A heartbeat runs proactive checks on a schedule.

- **Gateway** — boots everything, exposes a local `/health` endpoint
- **Agent loop** — send conversation to the model; if it asks for a tool, run it and feed the result back; repeat until it answers
- **Tools** — bash, file read/write/list/delete, fetch_url, system_info, write_memory
- **Skills** — drop-in `SKILL.md` folders that teach new abilities
- **Workspace** — SOUL / AGENTS / USER / MEMORY / etc. define who it is
- **Heartbeat** — recurring proactive checks driven by `HEARTBEAT.md`

## Memory

- **Short-term** — per-chat conversation history (`~/.clawcore/sessions/*.jsonl`)
- **Long-term** — a searchable SQLite (FTS5) store **plus** a human-readable `MEMORY.md`
- **Daily notes** — `~/.clawcore/workspace/memory/YYYY-MM-DD.md`

Everything lives under `~/.clawcore`. Nothing leaves your machine except the model calls.

## The agent's identity

Plain-text files in `~/.clawcore/workspace` define who it is and how it behaves:
`SOUL.md` (personality), `AGENTS.md` (operating rules), `IDENTITY.md`, `USER.md`, `TOOLS.md`, `MEMORY.md`, `HEARTBEAT.md`. On first run it onboards itself (`BOOTSTRAP.md`) and figures out who you both are.

## Skills

A skill is just a folder with a `SKILL.md` (YAML frontmatter + instructions). Discovery follows a clear precedence (highest wins):

1. `~/.clawcore/workspace/skills` — your skills
2. `~/.clawcore/skills` — managed/shared
3. `./skills` — bundled with the repo

Ships with `weather` and `github`. Add your own — no code changes, just drop a folder and restart.

## Tech stack

- **Node.js 22.12+**, **TypeScript** run via `tsx` (no build step)
- **[@mariozechner/pi-ai](https://www.npmjs.com/package/@mariozechner/pi-ai)** — model + tool-calling + ChatGPT (OpenAI Codex) login
- **grammY** — Telegram channel
- **node:sqlite** — memory (built into Node, zero native deps)
- **zod** + **json5** — config · **express** — local health endpoint

## Setup

**Prerequisites:** Node.js ≥ 22.12, a Telegram bot token (from [@BotFather](https://t.me/BotFather)), and a ChatGPT (Plus/Pro) account.

**1. Install**
```bash
npm install
```

**2. Configure** — create `~/.clawcore/clawcore.json`:
```json5
{
  model: "openai-codex/gpt-5.4-mini", // or gpt-5.4 for max quality
  telegram: {
    token: "YOUR_BOTFATHER_TOKEN",
    allowFrom: ["YOUR_TELEGRAM_USER_ID"], // numeric, as a string
  },
  heartbeat: { every: "30m" }, // "0m" to disable
  identity: { name: "Claw", handle: "claw" },
}
```

**3. Log in with ChatGPT** (one time)
```bash
npm run login
```

**4. Run**
```bash
npm start
```

Message your bot on Telegram, send `/start`, and say hi.

**Commands:** `/start` · `/help` · `/clear` (fresh conversation) · `/skills`

## Reliability by design

Built to not fall over in everyday use:

- **Fail-closed config** — a malformed config stops startup with a precise error instead of running half-broken
- **FTS5 query sanitization** — real messages full of punctuation can't crash memory search
- **Auto-refreshing auth** — the ChatGPT token refreshes itself; the bot won't die mid-session
- **Timeout guard** — a stalled model/network call can't hang the agent
- **Bounded context** — long conversations are trimmed so they never overflow
- **Tool errors are captured**, fed back to the model, and never crash the loop

## Roadmap

- [ ] **Cron-style scheduled tasks** — precise schedules ("every day at 9am") beyond the recurring heartbeat
- [ ] **24/7 always-on** — run as a background service (Windows / systemd) or on a VPS
- [ ] **More channels** beyond Telegram

## ⚠️ Disclaimer

ClawCore runs commands on your machine with your user's permissions. Only give it tasks and skills you trust.

---

Built by **[@predaaaasaaaaaaa](https://github.com/predaaaasaaaaaaa)** — a minimal, from-scratch take on the personal AI agent.