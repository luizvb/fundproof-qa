import { readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { readdir } from "node:fs/promises";

const roots = ["index.html", "README.md", "src", "docs", "public"];
const textExtensions = new Set([".html", ".md", ".ts", ".tsx", ".css", ".json", ".svg", ".webmanifest"]);
const forbidden = [
  { label: "em or en dash", pattern: /[—–]/u },
  { label: "regulatory claim", pattern: /\b(?:compliant|approved|certified)\b/iu },
  { label: "publication claim", pattern: /safe to publish/iu },
  { label: "hallucination claim", pattern: /eliminates hallucinations/iu },
];

async function filesAt(path) {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => null);
  if (!entries) return [path];
  const nested = await Promise.all(entries.map((entry) => filesAt(join(path, entry.name))));
  return nested.flat();
}

const files = (await Promise.all(roots.map(filesAt)))
  .flat()
  .filter((file) => textExtensions.has(extname(file)) || file.endsWith("manifest.webmanifest"));
const failures = [];

for (const file of files) {
  const content = await readFile(file, "utf8");
  for (const rule of forbidden) {
    if (rule.pattern.test(content)) failures.push(`${relative(process.cwd(), file)}: ${rule.label}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`copy scan passed for ${files.length} files`);
