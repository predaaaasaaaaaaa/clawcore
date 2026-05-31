import {
  complete,
  getModel,
  getModels,
  type Api,
  type AssistantMessage,
  type Context,
  type Model,
} from "@mariozechner/pi-ai";
import { getValidAccessToken } from "./codex-auth.js";
import type { ClawConfig } from "../config/types.js";
import { createLogger } from "../logger.js";

const log = createLogger("llm");

const REQUEST_TIMEOUT_MS = 120_000;

/** "provider/id" → pi-ai Model. Throws a clear, listing error if unknown. */
export function resolveModel(modelSpec: string): Model<Api> {
  const slash = modelSpec.indexOf("/");
  if (slash === -1) {
    throw new Error(`model must be "provider/id" (e.g. openai-codex/gpt-5.4), got "${modelSpec}"`);
  }
  const provider = modelSpec.slice(0, slash);
  const id = modelSpec.slice(slash + 1);

  const model = getModel(provider as never, id as never) as Model<Api> | undefined;
  if (!model) {
    let hint = ` Unknown provider "${provider}".`;
    try {
      const ids = getModels(provider as never).map((m) => m.id);
      if (ids.length) hint = ` Available ${provider} models: ${ids.join(", ")}`;
    } catch {
      /* unknown provider */
    }
    throw new Error(`Unknown model "${modelSpec}".${hint}`);
  }
  return model;
}

/** One model turn. */
export async function llmComplete(params: {
  config: ClawConfig;
  context: Context;
  signal?: AbortSignal;
}): Promise<AssistantMessage> {
  const { config, context } = params;

  const accessToken = await getValidAccessToken();
  const model = resolveModel(config.model);

  // Timeout guard — a stalled connection can never hang the bot.
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = params.signal ? AbortSignal.any([params.signal, timeout]) : timeout;

  log.debug(`complete() → ${config.model}`, {
    messages: context.messages.length,
    tools: context.tools?.length ?? 0,
  });

  // transport:"sse" forces the HTTP/SSE path. "auto" tries a WebSocket to the
  // ChatGPT backend first, which can hang on some networks. SSE is the reliable core path.
  return complete(model, context, { apiKey: accessToken, transport: "sse", signal });
}