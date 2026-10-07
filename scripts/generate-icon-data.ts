import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

interface IconData {
  body: string;
  height: number;
  width: number;
}

interface IconifySet {
  aliases?: Record<string, { parent?: string }>;
  height?: number;
  icons: Record<string, Partial<IconData> & { body: string }>;
  width?: number;
}

const root = process.cwd();
const iconPattern = /(?:circle-flags|lucide|simple-icons):[a-z0-9-]+/g;

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));

const usedIcons = (): string[] => {
  const names = sourceFiles(path.join(root, "src")).flatMap((file) =>
    readFileSync(file, "utf8")
      .matchAll(iconPattern)
      .map(([name]) => name)
      .toArray()
  );
  return [...new Set(names)].toSorted((a, b) => a.localeCompare(b));
};

const loadSet = (prefix: string): IconifySet =>
  JSON.parse(
    readFileSync(
      path.join(root, "node_modules", "@iconify-json", prefix, "icons.json"),
      "utf8"
    )
  ) as IconifySet;

const resolveIcon = (data: IconifySet, name: string): IconData => {
  const icon =
    data.icons[name] ?? data.icons[data.aliases?.[name]?.parent ?? ""];
  if (!icon) throw new Error(`Icon "${name}" not found`);
  return {
    body: icon.body,
    height: icon.height ?? data.height ?? 24,
    width: icon.width ?? data.width ?? 24,
  };
};

const sets = new Map<string, IconifySet>();
const entries = usedIcons().map((full) => {
  const [prefix = "", name = ""] = full.split(":", 2);
  const data = sets.get(prefix) ?? loadSet(prefix);
  sets.set(prefix, data);
  return `  ${JSON.stringify(full)}: ${JSON.stringify(resolveIcon(data, name))},`;
});

writeFileSync(
  path.join(root, "src/lib/icon-data.ts"),
  `interface IconData {\n  body: string;\n  height: number;\n  width: number;\n}\n\nexport const iconData: Record<string, IconData> = {\n${entries.join("\n")}\n};\n`
);
console.warn(`Wrote ${String(entries.length)} icons to src/lib/icon-data.ts`);
