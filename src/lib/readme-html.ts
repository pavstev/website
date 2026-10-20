import sanitizeHtml, { type Attributes, type IFrame } from "sanitize-html";

export interface ReadmeBase {
  branch: string;
  owner: string;
  repo: string;
}

const badgeHosts = new Set(["badge.fury.io", "img.shields.io", "shields.io"]);

const imageHosts = new Set([
  "camo.githubusercontent.com",
  "private-user-images.githubusercontent.com",
  "raw.githubusercontent.com",
  "user-images.githubusercontent.com",
]);

const landmarks = new Set([
  "aside",
  "footer",
  "header",
  "main",
  "nav",
  "section",
]);

const headings = ["h1", "h2", "h3", "h4", "h5", "h6"];

const schemePattern = /^[a-z][\d+.a-z-]*:/i;

const webPattern = /^https?:/i;

const sizePattern = /^\d{1,4}%?$/;

const segments = (value: string): string =>
  value
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

const normalize = (value: string): string =>
  value
    .replaceAll(/[\t\n\r]/g, "")
    .replace(/^[\p{Cc} ]+/u, "")
    .replace(/[\p{Cc} ]+$/u, "");

const resolve = (
  value: string,
  root: string,
  keepHash: boolean
): string | undefined => {
  const normalized = normalize(value);
  const slashed = normalized.replaceAll("\\", "/");
  if (slashed === "") {
    return undefined;
  }
  if (slashed.startsWith("#")) {
    return keepHash ? normalized : undefined;
  }
  if (slashed.startsWith("//")) {
    return `https:${slashed}`;
  }
  if (schemePattern.test(normalized)) {
    return normalized;
  }
  if (schemePattern.test(slashed.replaceAll(/[\p{Cc}\s]/gu, ""))) {
    return undefined;
  }
  const url = URL.parse(slashed.replace(/^\//, ""), root);
  if (!url?.href.startsWith(root)) {
    return undefined;
  }
  const decoded = (() => {
    try {
      return decodeURIComponent(url.pathname);
    } catch {
      return "";
    }
  })();
  return decoded === "" || decoded.split("/").includes("..")
    ? undefined
    : url.href;
};

const allowedImage = (src: string): boolean => {
  const url = URL.parse(src);
  if (url?.protocol !== "https:") {
    return false;
  }
  return url.hostname === "github.com"
    ? url.pathname.startsWith("/user-attachments/")
    : imageHosts.has(url.hostname);
};

const isBadge = (canonical: string | undefined): boolean => {
  if (canonical === undefined) {
    return false;
  }
  const url = URL.parse(canonical, "https://x/");
  return url !== null && badgeHosts.has(url.hostname);
};

export const sanitizeReadme = (html: string, base: ReadmeBase): string => {
  const repoPath = `${encodeURIComponent(base.owner)}/${encodeURIComponent(base.repo)}`;
  const branch = segments(base.branch);
  const linkRoot = `https://github.com/${repoPath}/blob/${branch}/`;
  const imageRoot = `https://raw.githubusercontent.com/${repoPath}/${branch}/`;
  let seenH1 = false;
  let keptImages = 0;
  const imagesAtOpen: number[] = [];

  const anchor = (tagName: string, attribs: Attributes): sanitizeHtml.Tag => {
    imagesAtOpen.push(keptImages);
    const next: Attributes = {};
    const { title } = attribs;
    if (title !== undefined) {
      next["title"] = title;
    }
    const href = resolve(attribs["href"] ?? "", linkRoot, true);
    if (href !== undefined) {
      next["href"] = href;
      if (webPattern.test(href)) {
        next["rel"] = "noopener noreferrer";
        next["target"] = "_blank";
      }
    }
    return { attribs: next, tagName };
  };

  const image = (tagName: string, attribs: Attributes): sanitizeHtml.Tag => {
    const next: Attributes = {};
    const src = resolve(attribs["src"] ?? "", imageRoot, false);
    if (
      src !== undefined &&
      allowedImage(src) &&
      !isBadge(attribs["data-canonical-src"])
    ) {
      next["src"] = src;
    }
    const { alt } = attribs;
    if (alt !== undefined) {
      next["alt"] = alt;
    }
    const { title } = attribs;
    if (title !== undefined) {
      next["title"] = title;
    }
    const { width } = attribs;
    if (width !== undefined && sizePattern.test(width)) {
      next["width"] = width;
    }
    const { height } = attribs;
    if (height !== undefined && sizePattern.test(height)) {
      next["height"] = height;
    }
    return { attribs: next, tagName };
  };

  const input = (tagName: string, attribs: Attributes): sanitizeHtml.Tag => ({
    attribs:
      attribs["type"]?.trim().toLowerCase() === "checkbox"
        ? {
            ...(attribs["checked"] !== undefined && { checked: "" }),
            disabled: "",
            type: "checkbox",
          }
        : {},
    tagName,
  });

  const drop = (frame: IFrame): boolean => {
    switch (frame.tag) {
      case "a": {
        const before = imagesAtOpen.pop() ?? keptImages;
        return frame.text.trim() === "" && keptImages === before;
      }
      case "h1": {
        const first = !seenH1;
        seenH1 = true;
        return first;
      }
      case "img": {
        const removed = frame.attribs["src"] === undefined;
        if (!removed) {
          keptImages += 1;
        }
        return removed;
      }
      case "input": {
        return frame.attribs["type"] !== "checkbox";
      }
      default: {
        return false;
      }
    }
  };

  return sanitizeHtml(html, {
    allowedAttributes: {
      a: ["href", "rel", "target", "title"],
      details: ["open"],
      img: ["alt", "height", "src", "title", "width"],
      input: ["checked", "disabled", "type"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags.filter((tag) => !landmarks.has(tag)),
      ...headings,
      "details",
      "img",
      "input",
      "summary",
    ],
    allowProtocolRelative: false,
    exclusiveFilter: drop,
    transformTags: { a: anchor, img: image, input },
  });
};
