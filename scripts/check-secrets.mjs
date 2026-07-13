import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const excluded = new Set([".git", "dist", "node_modules"]);
const binaryExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".ico", ".bin"]);
const patterns = [
  { label: "private key", pattern: /BEGIN [A-Z ]*PRIVATE KEY/u },
  { label: "AWS access key", pattern: /AKIA[0-9A-Z]{16}/u },
  { label: "GitHub token", pattern: /gh[pousr]_[A-Za-z0-9]{30,}/u },
  { label: "OpenAI key", pattern: /sk-[A-Za-z0-9]{32,}/u },
  { label: "Slack token", pattern: /xox[baprs]-[A-Za-z0-9-]{20,}/u },
];

async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (excluded.has(entry.name)) continue;
    const target = join(path, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(target)));
    else if (
      !binaryExtensions.has(extname(entry.name)) &&
      target !== "scripts/check-secrets.mjs" &&
      target !== "fundproof-lint"
    ) files.push(target);
  }
  return files;
}

const failures = [];
const files = await walk(".");
for (const file of files) {
  const content = await readFile(file, "utf8").catch(() => "");
  for (const rule of patterns) {
    if (rule.pattern.test(content)) failures.push(`${relative(process.cwd(), file)}: ${rule.label}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`secret scan passed for ${files.length} files`);
