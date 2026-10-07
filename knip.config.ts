import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["src/profile/**/*.test.ts"],
  ignoreDependencies: ["wrangler"],
};

export default config;
