import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../logger.js";

const log = createLogger("skills");

export type Skill = { name: string; description: string; content: string };

/** Load every skills/<name>/SKILL.md, parsing its frontmatter (name, description). */
export function loadSkills(dir: string): Skill[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((e) => {
      const skillPath = path.join(dir, e.name, "SKILL.md");
      if (!fs.existsSync(skillPath)) return [];
      const raw = fs.readFileSync(skillPath, "utf-8");
      const skill = parseSkill(e.name, raw);
      log.info(`Loaded skill: ${skill.name}`);
      return [skill];
    });
}

function parseSkill(dirName: string, raw: string): Skill {
  let name = dirName;
  let description = "";
  let body = raw.trim();

  const fm = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    const block = fm[1];
    const n = block.match(/^name:\s*(.+)$/m);
    const d = block.match(/^description:\s*(.+)$/m);
    if (n) name = n[1].trim();
    if (d) description = d[1].trim();
    body = raw.slice(fm[0].length).trim();
  }
  return { name, description, content: body };
}

/** Render loaded skills into a system-prompt section. */
export function buildSkillsSystemPrompt(skills: Skill[]): string {
  if (!skills.length) return "";
  return (
    "# Skills\n\nYou have these skills. Use them when the situation matches the description:\n\n" +
    skills
      .map((s) => `## ${s.name}\n${s.description ? s.description + "\n\n" : ""}${s.content}`)
      .join("\n\n")
  );
}