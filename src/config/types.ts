import { z } from "zod";

// ClawCore config schema. Lives at ~/.clawcore/clawcore.json (JSON5).
// No API key here — the LLM uses your ChatGPT login (token cached in the state dir).
export const ConfigSchema = z.object({
  // "provider/model". Stripped to the bare model id before the API call.
  // Real OpenClaw default alias "gpt" → openai/gpt-5.4.
  model: z.string().default("openai/gpt-5.4"),

  // Telegram channel. (Real nests this under channels.telegram; flattened for core.)
  telegram: z
    .object({
      token: z.string(),
      allowFrom: z.array(z.string()), // Telegram user IDs allowed to talk to the bot
    })
    .optional(),

  // (Real nests under agents.defaults.heartbeat; flattened for core.)
  heartbeat: z
    .object({
      every: z.string().default("30m"), // "30m" | "2h" | "0m" to disable
    })
    .default({ every: "30m" }),

  memory: z
    .object({
      enabled: z.boolean().default(true),
    })
    .default({ enabled: true }),

  identity: z
    .object({
      name: z.string().default("Claw"),
      handle: z.string().default("claw"),
    })
    .default({ name: "Claw", handle: "claw" }),

  port: z.number().default(18789), // local /health endpoint
});

export type ClawConfig = z.infer<typeof ConfigSchema>;