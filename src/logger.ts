export type LogLevel = "debug" | "info" | "warn" | "error";

export type Logger = {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
};

const DEBUG = process.env.DEBUG === "1" || process.env.CLAWCORE_LOG_LEVEL === "debug";

function ts(): string {
  return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
}

function fmt(meta?: Record<string, unknown>): string {
  if (!meta || Object.keys(meta).length === 0) return "";
  try {
    return " " + JSON.stringify(meta);
  } catch {
    return "";
  }
}

export function createLogger(subsystem: string): Logger {
  const tag = `[${subsystem}]`;
  return {
    debug: (m, meta) => {
      if (DEBUG) console.log(`${ts()} 🔍 ${tag} ${m}${fmt(meta)}`);
    },
    info: (m, meta) => console.log(`${ts()} ${tag} ${m}${fmt(meta)}`),
    warn: (m, meta) => console.warn(`${ts()} ⚠️  ${tag} ${m}${fmt(meta)}`),
    error: (m, meta) => console.error(`${ts()} ❌ ${tag} ${m}${fmt(meta)}`),
  };
}