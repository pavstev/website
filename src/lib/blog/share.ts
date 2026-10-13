import { readFileSync } from "node:fs";
import path from "node:path";

import { en } from "../i18n.ts";
import { designTokens, inkPalette } from "../theme.ts";
import { minutesLabel } from "./format.ts";
import { type PostMeta } from "./schema.ts";

export const shareSize = { height: 630, width: 1200 };

export interface ShareFonts {
  list: ShareFont[];
}

interface ShareFont {
  data: Buffer;
  name: string;
  style: "normal";
  weight: 400 | 600;
}

interface ShareNode {
  key: null;
  props: Record<string, unknown>;
  type: string;
}

const node = (
  type: string,
  props: Record<string, unknown>,
  children?: ShareNode | ShareNode[] | string
): ShareNode => ({
  key: null,
  props: children === undefined ? props : { ...props, children },
  type,
});

const fontFamily = "Inter, Inter Ext";

const interFile = (subset: string, weight: number): string =>
  path.join(
    process.cwd(),
    "node_modules/@fontsource/inter/files",
    `inter-${subset}-${String(weight)}-normal.woff`
  );

export const shareFonts = (): ShareFonts => ({
  list: (
    [
      ["latin", "Inter"],
      ["latin-ext", "Inter Ext"],
    ] as const
  ).flatMap(([subset, name]) =>
    ([400, 600] as const).map((weight): ShareFont => ({
      data: readFileSync(interFile(subset, weight)),
      name,
      style: "normal",
      weight,
    }))
  ),
});

const titleSize = (title: string): number => (title.length > 48 ? 56 : 68);

export const shareTree = (post: PostMeta, background: string): ShareNode => {
  const cover =
    background === ""
      ? []
      : [
          node("img", {
            height: shareSize.height,
            src: background,
            style: { left: 0, position: "absolute", top: 0 },
            width: shareSize.width,
          }),
        ];
  return node(
    "div",
    {
      style: {
        backgroundColor: designTokens.background,
        display: "flex",
        flexDirection: "column",
        fontFamily,
        height: "100%",
        justifyContent: "flex-end",
        padding: "72px",
        position: "relative",
        width: "100%",
      },
    },
    [
      ...cover,
      node(
        "div",
        {
          style: {
            color: inkPalette.foreground,
            display: "flex",
            fontSize: titleSize(post.title),
            fontWeight: 600,
            lineHeight: 1.1,
            maxWidth: "820px",
          },
        },
        post.title
      ),
      node(
        "div",
        {
          style: {
            color: inkPalette.soft,
            display: "flex",
            fontSize: 28,
            fontWeight: 400,
            marginTop: "24px",
          },
        },
        en.blog.shareLine
          .replace("{blog}", () => en.blog.blogName)
          .replace("{minutes}", () => minutesLabel(post.readingMinutes))
      ),
    ]
  );
};
