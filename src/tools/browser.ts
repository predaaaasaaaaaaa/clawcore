import { createLogger } from "../logger.js";

const log = createLogger("tool:browser");

const MAX_CONTENT = 15_000; // chars returned to the model
const TIMEOUT_MS = 15_000;

export type FetchResult = { url: string; content: string; statusCode: number; error?: string };

/** Fetch a URL and return readable text. HTML is stripped to plain text;
 *  JSON/text is returned as-is. Never throws — errors come back in `error`. */
export async function fetchUrl(url: string): Promise<FetchResult> {
  log.info(`fetch: ${url}`);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "ClawCore/1.0 (personal assistant)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const type = res.headers.get("content-type") ?? "";
    let content = await res.text();

    if (type.includes("text/html")) {
      content = content
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<h[1-6][^>]*>/gi, "\n\n")
        .replace(/<p[^>]*>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<li[^>]*>/gi, "\n- ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }

    if (content.length > MAX_CONTENT) content = content.slice(0, MAX_CONTENT) + "\n[...truncated]";

    return { url, content, statusCode: res.status };
  } catch (e) {
    return { url, content: "", statusCode: 0, error: String(e) };
  }
}