import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  build: { format: "file" },
  devToolbar: { enabled: false },
  integrations: [react()],
  output: "static",
  site: "https://stevanpavlovic.com",
  trailingSlash: "never",
  vite: {
    plugins: [tailwindcss()],
    ssr: { external: ["@react-pdf/renderer"] },
  },
});
