import fs from "node:fs";
import { createLogger } from "../logger.js";

const log = createLogger("tool:file");

const MAX_READ = 20_000; // chars returned to the model

/** Read a UTF-8 file. Returns an error string instead of throwing. */
export function readFile(p: string): string {
  log.info(`read: ${p}`);
  try {
    const c = fs.readFileSync(p, "utf-8");
    return c.length > MAX_READ ? c.slice(0, MAX_READ) + "\n[...truncated]" : c;
  } catch (e) {
    return `Error reading file: ${String(e)}`;
  }
}

/** Write (or overwrite) a UTF-8 file, creating it if needed. */
export function writeFile(p: string, content: string): string {
  log.info(`write: ${p} (${content.length} chars)`);
  try {
    fs.writeFileSync(p, content, "utf-8");
    return `Successfully wrote ${p}`;
  } catch (e) {
    return `Error writing file: ${String(e)}`;
  }
}

/** List a directory's entries, tagged file/dir. */
export function listDirectory(p: string): string {
  log.info(`ls: ${p}`);
  try {
    const entries = fs.readdirSync(p, { withFileTypes: true });
    if (entries.length === 0) return "(empty directory)";
    return entries
      .map((e) => `${e.isDirectory() ? "dir " : "file"} ${e.name}`)
      .join("\n");
  } catch (e) {
    return `Error listing directory: ${String(e)}`;
  }
}

/** Delete a single file. Refuses directories. Used by onboarding to remove BOOTSTRAP.md. */
export function deleteFile(p: string): string {
  log.info(`delete: ${p}`);
  try {
    if (!fs.existsSync(p)) return `File does not exist: ${p}`;
    if (fs.statSync(p).isDirectory()) return `Refusing to delete a directory: ${p}`;
    fs.unlinkSync(p);
    return `Deleted ${p}`;
  } catch (e) {
    return `Error deleting file: ${String(e)}`;
  }
}