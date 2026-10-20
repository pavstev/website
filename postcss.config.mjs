import { fileURLToPath } from "node:url";

const config = {
  plugins: {
    [fileURLToPath(
      new URL("./scripts/postcss-color-mix.mjs", import.meta.url)
    )]: {},
  },
};

export default config;
