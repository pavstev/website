import type { RepoLanguage } from "./github.ts";

export interface Tech {
  color?: string | undefined;
  logo?: string | undefined;
  name: string;
}

interface TopicTech {
  label: string;
  language?: string;
  logo?: string;
}

const languageLogos: Readonly<Record<string, string>> = {
  Astro: "simple-icons:astro",
  CSS: "simple-icons:css",
  Go: "simple-icons:go",
  "Go Template": "simple-icons:go",
  HTML: "simple-icons:html5",
  JavaScript: "simple-icons:javascript",
  MDX: "simple-icons:mdx",
  Python: "simple-icons:python",
  Ruby: "simple-icons:ruby",
  Rust: "simple-icons:rust",
  Shell: "simple-icons:gnubash",
  Swift: "simple-icons:swift",
  TypeScript: "simple-icons:typescript",
};

const topicTech: Readonly<Record<string, TopicTech>> = {
  "claude-code": { label: "Claude Code", logo: "simple-icons:claude" },
  "cloudflare-workers": {
    label: "Cloudflare Workers",
    logo: "simple-icons:cloudflareworkers",
  },
  cursor: { label: "Cursor", logo: "simple-icons:cursor" },
  linux: { label: "Linux", logo: "simple-icons:linux" },
  macos: { label: "macOS", logo: "simple-icons:apple" },
  mise: { label: "mise" },
  mlx: { label: "MLX" },
  nextjs: { label: "Next.js", logo: "simple-icons:nextdotjs" },
  opencode: { label: "OpenCode", logo: "simple-icons:opencode" },
  pnpm: { label: "pnpm", logo: "simple-icons:pnpm" },
  pwa: { label: "PWA", logo: "simple-icons:pwa" },
  react: { label: "React", logo: "simple-icons:react" },
  rust: { label: "Rust", language: "Rust", logo: "simple-icons:rust" },
  starship: { label: "Starship", logo: "simple-icons:starship" },
  swift: { label: "Swift", language: "Swift", logo: "simple-icons:swift" },
  swiftui: { label: "SwiftUI", language: "Swift", logo: "simple-icons:swift" },
  tailwindcss: { label: "Tailwind CSS", logo: "simple-icons:tailwindcss" },
  "tailwindcss-v4": {
    label: "Tailwind CSS",
    logo: "simple-icons:tailwindcss",
  },
  threejs: { label: "Three.js", logo: "simple-icons:threedotjs" },
  typescript: {
    label: "TypeScript",
    language: "TypeScript",
    logo: "simple-icons:typescript",
  },
  webgl: { label: "WebGL", logo: "simple-icons:webgl" },
  whisperkit: { label: "WhisperKit" },
  windows: { label: "Windows", logo: "simple-icons:windows" },
  zsh: { label: "zsh", language: "Shell", logo: "simple-icons:zsh" },
};

export const techLogoNames: readonly string[] = [
  ...new Set([
    ...Object.values(languageLogos),
    ...Object.values(topicTech).flatMap(({ logo }) => logo ?? []),
  ]),
];

export const languageTech = ({ color, name }: RepoLanguage): Tech => ({
  color,
  logo: languageLogos[name],
  name,
});

export const techTags = (
  languages: readonly RepoLanguage[],
  topics: readonly string[]
): Tech[] => {
  const tags = languages.map((language) => languageTech(language));
  const seen = new Set(tags.map(({ name }) => name.toLowerCase()));
  for (const topic of topics) {
    const tech = topicTech[topic];
    if (!tech || seen.has(tech.label.toLowerCase())) continue;
    seen.add(tech.label.toLowerCase());
    const color = languages.find(({ name }) => name === tech.language)?.color;
    tags.push({ color, logo: tech.logo, name: tech.label });
  }
  return tags;
};
