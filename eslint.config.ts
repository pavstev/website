import type { Linter } from "eslint";

import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import markdown from "@eslint/markdown";
import nextPlugin from "@next/eslint-plugin-next";
import prettierConfig from "eslint-config-prettier/flat";
import betterTailwindcssPlugin from "eslint-plugin-better-tailwindcss";
import importX from "eslint-plugin-import-x";
import perfectionistPlugin from "eslint-plugin-perfectionist";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import regexpPlugin from "eslint-plugin-regexp";
import securityPlugin from "eslint-plugin-security";
import unicornPlugin from "eslint-plugin-unicorn";
import unusedImportsPlugin from "eslint-plugin-unused-imports";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  {
    files: ["**/*.{js,jsx,ts,tsx,mts,cts,mjs,cjs}"],
    plugins: {
      "@eslint-community/eslint-comments": eslintComments,
    },
    rules: eslintComments.configs.recommended.rules as Linter.RulesRecord,
  },
  {
    ...(importX.flatConfigs.recommended as Linter.Config),
    files: ["**/*.{js,jsx,ts,tsx,mts,cts,mjs,cjs}"],
  },
  {
    ...(importX.flatConfigs.typescript as Linter.Config),
    files: ["**/*.{js,jsx,ts,tsx,mts,cts,mjs,cjs}"],
  },
  {
    ...(regexpPlugin.configs["flat/recommended"] as Linter.Config),
    files: ["**/*.{js,jsx,ts,tsx,mts,cts,mjs,cjs}"],
  },
  {
    ...(securityPlugin.configs?.["recommended"] as Linter.Config),
    files: ["**/*.{js,jsx,ts,tsx,mts,cts,mjs,cjs}"],
  },
  {
    ...perfectionistPlugin.configs["recommended-natural"],
    files: ["**/*.{js,jsx,ts,tsx,mts,cts,mjs,cjs}"],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx,mts,cts,mjs,cjs}"],
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "@next/next/no-img-element": "off",
    },
  },
  {
    ...reactHooksPlugin.configs.flat.recommended,
    files: ["**/*.{js,jsx,ts,tsx,mts,cts,mjs,cjs}"],
    rules: {
      ...reactHooksPlugin.configs.flat.recommended.rules,
      "react-hooks/exhaustive-deps": "error",
    },
  },
  globalIgnores([
    ".claude/skills/**",
    ".next/**",
    ".profile-out/**",
    ".superpowers/**",
    "dist/**",
  ]),
  ...[
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
  ].map((config) => ({ ...config, files: ["**/*.{ts,tsx,mts,cts}"] })),
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    files: ["**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "better-tailwindcss": betterTailwindcssPlugin,
      unicorn: unicornPlugin,
      "unused-imports": unusedImportsPlugin,
    },
    rules: {
      ...unicornPlugin.configs.recommended.rules,
      "@eslint-community/eslint-comments/no-use": "error",
      "@typescript-eslint/array-type": ["error", { default: "array-simple" }],
      "@typescript-eslint/consistent-generic-constructors": [
        "error",
        "constructor",
      ],
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      "@typescript-eslint/consistent-type-exports": [
        "error",
        { fixMixedExportsWithInlineTypeSpecifier: true },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports", prefer: "type-imports" },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/naming-convention": [
        "error",
        {
          format: ["camelCase", "PascalCase"],
          leadingUnderscore: "allow",
          modifiers: ["const"],
          selector: "variable",
        },
      ],
      "@typescript-eslint/no-confusing-non-null-assertion": "error",
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        { ignoreArrowShorthand: true },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-inferrable-types": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-redundant-type-constituents": "error",
      "@typescript-eslint/no-restricted-types": [
        "error",
        {
          types: {
            Boolean: { fixWith: "boolean", message: "Use `boolean` instead" },
            Number: { fixWith: "number", message: "Use `number` instead" },
            Object: {
              fixWith: "object",
              message: "Use `object` or a specific type instead",
            },
            String: { fixWith: "string", message: "Use `string` instead" },
            Symbol: { fixWith: "symbol", message: "Use `symbol` instead" },
            "{}": {
              message:
                "Use `Record<string, unknown>` or a specific type instead",
            },
          },
        },
      ],
      "@typescript-eslint/no-shadow": "error",
      "@typescript-eslint/no-unnecessary-boolean-literal-compare": "error",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-unnecessary-template-expression": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-unnecessary-type-parameters": "error",
      "@typescript-eslint/no-unused-expressions": "error",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-useless-constructor": "error",
      "@typescript-eslint/no-useless-empty-export": "error",
      "@typescript-eslint/prefer-find": "error",
      "@typescript-eslint/prefer-includes": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/prefer-promise-reject-errors": "error",
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/prefer-string-starts-ends-with": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/strict-boolean-expressions": "off",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "arrow-body-style": ["error", "as-needed"],
      "better-tailwindcss/enforce-canonical-classes": "error",
      "better-tailwindcss/enforce-consistent-class-order": "off",
      "better-tailwindcss/enforce-consistent-line-wrapping": "off",
      "better-tailwindcss/no-conflicting-classes": "error",
      "better-tailwindcss/no-deprecated-classes": "error",
      "better-tailwindcss/no-duplicate-classes": "error",
      "better-tailwindcss/no-unknown-classes": "off",
      "better-tailwindcss/no-unnecessary-whitespace": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "func-style": ["error", "expression", { allowArrowFunctions: true }],
      "import-x/no-cycle": "error",
      "import-x/no-duplicates": ["error", { "prefer-inline": true }],
      "import-x/no-extraneous-dependencies": [
        "error",
        {
          devDependencies: [
            "*.config.ts",
            "scripts/**",
            "src/profile/**",
            "**/*.test.ts",
          ],
        },
      ],
      "import-x/no-mutable-exports": "error",
      "import-x/no-named-as-default": "off",
      "import-x/no-named-as-default-member": "off",
      "import-x/no-self-import": "error",
      "import-x/no-unresolved": "error",
      "import-x/no-useless-path-segments": ["error", { noUselessIndex: true }],
      "import-x/order": "off",
      "logical-assignment-operators": ["error", "always"],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-else-return": ["error", { allowElseIf: false }],
      "no-implicit-coercion": "error",
      "no-lonely-if": "error",
      "no-param-reassign": "error",
      "no-shadow": "off",
      "no-throw-literal": "error",
      "no-useless-constructor": "off",
      "no-useless-rename": "error",
      "no-useless-return": "error",
      "no-var": "error",
      "no-warning-comments": [
        "error",
        { location: "anywhere", terms: ["todo", "fixme", "xxx", "hack"] },
      ],
      "object-shorthand": ["error", "always"],
      "prefer-arrow-callback": "error",
      "prefer-const": "error",
      "prefer-destructuring": [
        "error",
        { array: false, object: true },
        { enforceForRenamedProperties: false },
      ],
      "prefer-template": "error",
      "security/detect-object-injection": "off",
      "unicorn/consistent-boolean-name": "off",
      "unicorn/filename-case": [
        "error",
        {
          case: "kebabCase",
          ignore: [String.raw`\[.+\]\.tsx?$`],
        },
      ],
      "unicorn/name-replacements": "off",
      "unicorn/no-array-for-each": "off",
      "unicorn/no-nested-ternary": "off",
      "unicorn/no-null": "off",
      "unicorn/no-top-level-assignment-in-function": "off",
      "unicorn/no-useless-undefined": [
        "error",
        { checkArrowFunctionBody: false },
      ],
      "unicorn/prefer-at": "off",
      "unicorn/prefer-module": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          vars: "all",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["scripts/**", "src/profile/cli.ts"],
    rules: { "security/detect-non-literal-fs-filename": "off" },
  },
  {
    files: ["**/*.test.ts"],
    rules: { "@typescript-eslint/no-floating-promises": "off" },
  },
  ...markdown.configs.recommended,
  {
    files: ["**/*.md"],
    language: "markdown/gfm",
    rules: {
      "markdown/no-bare-urls": "error",
      "markdown/no-duplicate-headings": "error",
      "markdown/no-html": "error",
    },
  },
  {
    files: ["CLAUDE.md"],
    rules: {
      "markdown/no-multiple-h1": "off",
    },
  },
  prettierConfig,
]);

export default eslintConfig;
