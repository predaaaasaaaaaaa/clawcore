import {
  complete,
  getModel,
  type Api,
  type AssistantMessage,
  type Context,
  type Model,
} from "@mariozechner/pi-ai";
import { getValidAccessToken } from "./codex-auth.js";
import type { ClawConfig } from "../config/types.js";
import { createLogger } from "../logger.js";

const log = createLogger("llm");

/** Turn a "provider/id" config string into a pi-ai Model.
 *  e.g. "openai-codex/gpt-5.4" → getModel("openai-codex", "gpt-5.4") */
export function resolveModel(modelSpec: string): Model<Api> {
  const slash = modelSpec.indexOf("/");
  if (slash === -1) {
    throw new Error(`model must be "provider/id" (e.g. openai-codex/gpt-5.4), got "${modelSpec}"`);
  }
  const provider = modelSpec.slice(0, slash);
  const id = modelSpec.slice(slash + 1);
  // getModel is typed to known literals; config is dynamic, so we cast.
  return getModel(provider as never, id as never) as Model<Api>;
}

/** One model turn: send the context, get back the assistant message
 *  (which may contain text and/or tool calls). The loop lives in the runner. */
export async function llmComplete(params: {
  config: ClawConfig;
  context: Context;
  signal?: AbortSignal;
}): Promise<AssistantMessage> {
  const { config, context, signal } = params;

  // ChatGPT access token (auto-refreshed). Passed as apiKey — pi-ai's
  // openai-codex provider uses it as the bearer token.
  const accessToken = await getValidAccessToken();
  const model = resolveModel(config.model);

  log.debug(`complete() → ${config.model}`, { messages: context.messages.length, tools: context.tools?.length ?? 0 });
  return complete(model, context, { apiKey: accessToken, signal });
}