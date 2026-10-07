import type { ProfileFile, ProfileInput } from "./types.ts";

import { renderHeader } from "./header.ts";
import { badgeFile, buildBadges, flagFile } from "./icons.ts";
import { renderContributing, renderReadme } from "./readme.ts";
import { compareText } from "./text.ts";

export const renderProfile = (input: ProfileInput): ProfileFile[] =>
  [
    { contents: renderReadme(input), path: "README.md" },
    { contents: renderContributing(input), path: "CONTRIBUTING.md" },
    { contents: renderHeader(input), path: "assets/header.svg" },
    flagFile(input),
    ...buildBadges(input).map((badge) => badgeFile(input, badge)),
  ].toSorted((a, b) => compareText(a.path, b.path));
