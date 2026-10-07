import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["scripts/generate-globe-data.ts", "src/profile/**/*.test.ts"],
  ignoreDependencies: ["wrangler"],
  ignoreExportsUsedInFile: false,
  includeEntryExports: true,
  project: ["*.ts", "scripts/**/*.ts", "src/**/*.{css,ts,tsx}"],
  rules: {
    binaries: "error",
    catalog: "error",
    catalogReferences: "error",
    cycles: "error",
    dependencies: "error",
    devDependencies: "error",
    duplicates: "error",
    enumMembers: "error",
    exports: "error",
    files: "error",
    namespaceMembers: "error",
    nsExports: "error",
    nsTypes: "error",
    optionalPeerDependencies: "error",
    types: "error",
    unlisted: "error",
    unresolved: "error",
  },
  treatConfigHintsAsErrors: true,
};

export default config;
