import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

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
  integrations: [react(), islandStyleToCss()],
  output: "static",
  site: "https://stevanpavlovic.com",
  trailingSlash: "never",
  vite: {
    plugins: [tailwindcss()],
    ssr: { external: ["@react-pdf/renderer"] },
  },
});
