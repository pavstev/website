import type { ProfileFile, ProfileInput } from "./types.ts";

import { renderContributing, renderReadme } from "./readme.ts";
import { compareText } from "./text.ts";

export const renderProfile = (input: ProfileInput): ProfileFile[] =>
  [
    { contents: renderReadme(input), path: "README.md" },
    { contents: renderContributing(input), path: "CONTRIBUTING.md" },
  ].toSorted((a, b) => compareText(a.path, b.path));
