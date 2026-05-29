import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../config/loader.js";
import { createLogger } from "../logger.js";

const require = createRequire(import.meta.url);
const log = createLogger("memory");

// Minimal structural type for node:sqlite (avoids depending on @types/node version).
type RunResult = { changes: number | bigint; lastInsertRowid: number | bigint };
type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): RunResult;
    all(...params: unknown[]): unknown[];
  };
};

let db: SqliteDb | null = null;

function getDb(): SqliteDb {
  if (db) return db;
  // node:sqlite is an experimental builtin — require() (not static import) is the safe way.
  const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (p: string) => SqliteDb };
  const dbPath = path.join(resolveStateDir(), "memory.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  // Full-text index. rowid mirrors memories.id so search returns content directly.
  db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(content);`);

  log.info(`Memory DB ready at ${dbPath}`);
  return db;
}

/** FTS5-safe query builder. Keeps only word tokens, quotes each, ANDs them.
 *  Mirrors OpenClaw's buildFtsQuery — raw user text like "what's my server (prod)?"
 *  would otherwise be invalid FTS5 syntax and throw. */
function buildFtsQuery(raw: string): string | null {
  const tokens = raw.match(/[\p{L}\p{N}_]+/gu)?.map((t) => t.trim()).filter(Boolean) ?? [];
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t.replaceAll('"', "")}"`).join(" AND ");
}

/** Save a long-term fact to the searchable memory DB. */
export function storeMemory(source: string, content: string): void {
  const d = getDb();
  const info = d.prepare(
    "INSERT INTO memories (source, content, created_at) VALUES (?, ?, ?)",
  ).run(source, content, Date.now());
  d.prepare("INSERT INTO memories_fts (rowid, content) VALUES (?, ?)").run(
    info.lastInsertRowid,
    content,
  );
  log.debug(`stored memory #${info.lastInsertRowid} (${source})`);
}

/** Keyword search over stored memories. Returns [] safely on no match or bad input. */
export function searchMemory(query: string, limit = 5): string[] {
  const match = buildFtsQuery(query);
  if (!match) return [];
  try {
    const rows = getDb().prepare(
      `SELECT content FROM memories_fts WHERE memories_fts MATCH ? ORDER BY rank LIMIT ?`,
    ).all(match, limit) as Array<{ content: string }>;
    return rows.map((r) => r.content);
  } catch (err) {
    log.warn(`memory search failed: ${String(err)}`);
    return [];
  }
}