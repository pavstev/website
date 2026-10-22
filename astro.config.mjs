import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import rehypeSlug from "rehype-slug";
import { createCssVariablesTheme } from "shiki";

import { rehypeHeadingAnchors } from "./src/lib/blog/anchors.ts";
import { en } from "./src/lib/i18n.ts";

const codeTheme = createCssVariablesTheme({
  fontStyle: true,
  name: "site",
  variableDefaults: {},
  variablePrefix: "--shiki-",
});

const codeLanguages = [
  "bash",
  "css",
  "diff",
  "glsl",
  "html",
  "json",
  "jsx",
  "md",
  "mdx",
  "tsx",
  "typescript",
  "yaml",
];

const islandStyle =
  "<style>astro-island,astro-slot,astro-static-slot{display:contents}</style>";

const islandStyleToCss = () => ({
  hooks: {
    "astro:build:done": async ({ dir }) => {
      const root = fileURLToPath(dir);
      const files = await readdir(root, { recursive: true });
      await Promise.all(
        files
          .filter((file) => file.endsWith(".html"))
          .map(async (file) => {
            const path = `${root}/${file}`;
            const html = await readFile(path, "utf8");
            if (html.includes(islandStyle)) {
              await writeFile(path, html.replace(islandStyle, ""));
            }
          })
      );
    },
  },
  name: "island-style-to-css",
});

export default defineConfig({
  build: { format: "file", inlineStylesheets: "always" },
  devToolbar: { enabled: false },
  integrations: [react(), mdx(), islandStyleToCss()],
  markdown: {
    processor: unified({
      rehypePlugins: [
        rehypeSlug,
        [rehypeHeadingAnchors, { label: en.blog.anchor }],
      ],
      remarkRehype: {
        footnoteBackLabel: en.blog.footnoteBack,
        footnoteLabel: en.blog.footnotes,
        footnoteLabelProperties: { className: ["footnotes-heading"] },
      },
      smartypants: false,
    }),
    shikiConfig: {
      langs: codeLanguages,
      theme: codeTheme,
    },
  },
  output: "static",
  prefetch: false,
  site: "https://stevanpavlovic.com",
  trailingSlash: "never",
  vite: {
    build: {
      cssTarget: [
        "chrome111",
        "edge111",
        "firefox128",
        "ios16.4",
        "safari16.4",
      ],
    },
    optimizeDeps: { include: ["three"] },
    plugins: [tailwindcss()],
    ssr: { external: ["@react-pdf/renderer"] },
  },
});
