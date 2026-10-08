import {
  Document,
  Font,
  Image,
  Link,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import path from "node:path";
import {
  createElement,
  Fragment,
  type ReactElement,
  type ReactNode,
} from "react";

import { type Cv } from "./cv.ts";
import { en } from "./i18n.ts";
import { resumePdfPalette } from "./theme.ts";

interface Body {
  contributions: Array<{ description: string; title: string }>;
  overview: string;
  skills: string[];
}

type EducationItem = Cv["education"]["items"][number];

interface EntryHeading {
  from: string;
  location: string;
  primary: string;
  secondary: string;
  to: string;
  url: string;
}

type ExperienceItem = Cv["experience"]["items"][number];

interface Period {
  duration: string;
  range: string;
}
type ProjectItem = Cv["projects"]["items"][number];
interface ResumeSection {
  body: ReactElement;
  heading: string;
}

const labels = en.resumePdf;
const { accent, rule, subtle, text: ink } = resumePdfPalette;

const unit = 1.5;
const fontSize = { body: 9, display: 18, small: 7.5, title: 10.5 } as const;
const dash = "–";
const bullet = "•";

const fontDirectory = path.join(
  process.cwd(),
  "node_modules",
  "@fontsource",
  "inter",
  "files"
);

const faces = [
  { fontStyle: "normal", fontWeight: 400, name: "400-normal" },
  { fontStyle: "normal", fontWeight: 500, name: "500-normal" },
  { fontStyle: "normal", fontWeight: 600, name: "600-normal" },
  { fontStyle: "italic", fontWeight: 400, name: "400-italic" },
] as const;

const registerInter = (family: string, subset: string): void => {
  if (Font.getRegisteredFontFamilies().includes(family)) return;
  Font.register({
    family,
    fonts: faces.map((face) => ({
      fontStyle: face.fontStyle,
      fontWeight: face.fontWeight,
      src: path.join(fontDirectory, `inter-${subset}-${face.name}.woff`),
    })),
  });
};

const registerFonts = (): void => {
  registerInter("Inter", "latin");
  registerInter("Inter Extended", "latin-ext");
  Font.registerHyphenationCallback((word) => [word]);
};

const styles = StyleSheet.create({
  bold: { fontWeight: 600 },
  bullet: { width: 10 },
  bulletRow: { flexDirection: "row" },
  divided: {
    borderTopColor: rule,
    borderTopStyle: "dashed",
    borderTopWidth: 0.75,
    marginTop: 4.5 * unit,
    paddingTop: 4.5 * unit,
  },
  duration: {
    color: subtle,
    fontSize: fontSize.small,
    fontStyle: "italic",
  },
  fluency: { color: subtle, fontStyle: "italic" },
  footerPage: {
    color: subtle,
    fontSize: fontSize.small,
    position: "absolute",
    right: 28,
    top: 818,
  },
  footerRule: {
    borderTopColor: rule,
    borderTopStyle: "solid",
    borderTopWidth: 0.75,
    bottom: 0,
    height: 28,
    left: 0,
    position: "absolute",
    right: 0,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 9 * unit,
    marginBottom: 4 * unit,
  },
  headline: { color: subtle, marginTop: 0.75 },
  link: {
    color: accent,
    textDecoration: "underline",
    textDecorationColor: accent,
    textDecorationStyle: "dotted",
  },
  linkLine: {
    color: accent,
    marginTop: 1,
    textDecoration: "underline",
    textDecorationColor: accent,
    textDecorationStyle: "dotted",
  },
  medium: { fontWeight: 500 },
  name: {
    color: accent,
    fontSize: fontSize.display,
    fontWeight: 600,
    letterSpacing: -0.18,
    lineHeight: 1.1,
  },
  page: {
    color: ink,
    fontFamily: ["Inter", "Inter Extended"],
    fontSize: fontSize.body,
    lineHeight: 1.35,
    paddingBottom: 36,
    paddingHorizontal: 28,
    paddingTop: 18,
  },
  photo: {
    borderRadius: 32,
    height: 64,
    marginTop: 2 * unit,
    objectFit: "cover",
    width: 64,
  },
  sectionHeading: {
    borderBottomColor: accent,
    borderBottomStyle: "solid",
    borderBottomWidth: 0.75,
    color: accent,
    fontSize: fontSize.small,
    fontWeight: 600,
    letterSpacing: 0.6,
    lineHeight: 1.2,
    marginBottom: 5.5,
    paddingBottom: 0.75,
    textTransform: "uppercase",
  },
  skillName: { fontWeight: 500, letterSpacing: -0.045 },
  subtle: { color: subtle },
  title: {
    fontSize: fontSize.title,
    fontWeight: 600,
    letterSpacing: -0.05,
    lineHeight: 1.2,
  },
});

const monthNames = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

const separatorPattern = /\s+[\p{Pd}−]\s+|\s+to\s+/iu;
const presentPattern = /^(?:present|current|now|today|ongoing)$/i;
const monthYearPattern = /^([a-z]{3,9})\.?\s+(\d{4})$/i;
const isoPattern = /^(\d{4})[-/](\d{1,2})$/;
const yearPattern = /^(\d{4})$/;

const dateOfMonthYear = (value: string): Date | null => {
  const match = monthYearPattern.exec(value);
  const month = match?.[1]?.toLowerCase() ?? "";
  const year = match?.[2];
  const index = monthNames.findIndex((name) => month.startsWith(name));
  return year === undefined || index === -1
    ? null
    : new Date(Number(year), index, 1);
};

const dateOfIso = (value: string): Date | null => {
  const match = isoPattern.exec(value);
  const year = match?.[1];
  const month = Number(match?.[2]);
  return year === undefined || month < 1 || month > 12
    ? null
    : new Date(Number(year), month - 1, 1);
};

const dateOfYear = (value: string, side: "end" | "start"): Date | null => {
  const year = yearPattern.exec(value)?.[1];
  return year === undefined
    ? null
    : new Date(Number(year), side === "start" ? 0 : 11, 1);
};

const dateOf = (raw: string, side: "end" | "start"): Date | null => {
  const value = raw.trim();
  if (value === "") return null;
  return presentPattern.test(value)
    ? new Date()
    : (dateOfMonthYear(value) ?? dateOfIso(value) ?? dateOfYear(value, side));
};

const counted = (count: number, one: string, many: string): string =>
  `${String(count)} ${count === 1 ? one : many}`;

const durationOf = (months: number): string => {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [
    years > 0 ? counted(years, labels.year, labels.years) : "",
    rest > 0 ? counted(rest, labels.month, labels.months) : "",
  ]
    .filter(Boolean)
    .join(" ");
};

const periodOf = (from: string, to: string): Period => {
  const range = [from, to].filter(Boolean).join(" - ");
  const [first = "", second = "", ...extra] = range.split(separatorPattern);
  const start = dateOf(first, "start");
  const end = dateOf(second, "end");
  if (!start || !end || extra.length > 0 || end < start) {
    return { duration: "", range };
  }
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1;
  return { duration: durationOf(months), range };
};

const httpHref = (value: string): null | string => {
  const trimmed = value.trim();
  if (!/^https?:\/\/[^/\s]/i.test(trimmed) || !URL.canParse(trimmed)) {
    return null;
  }
  const url = new URL(trimmed);
  return url.hostname === "" ? null : url.href;
};

const mailHref = (value: string): null | string => {
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+$/.test(trimmed) ? `mailto:${trimmed}` : null;
};

const anchor = (href: null | string, children: ReactNode): ReactNode =>
  href === null
    ? children
    : createElement(Link, { src: href, style: styles.link }, children);

const contactLine = (label: string, href: null | string): ReactElement =>
  href === null
    ? createElement(Text, { style: styles.subtle }, label)
    : createElement(Link, { src: href, style: styles.linkLine }, label);

const imageFormat = (photo: Uint8Array): "jpg" | "png" | null => {
  if (photo[0] === 0xff && photo[1] === 0xd8) return "jpg";
  const isPng =
    photo[0] === 0x89 &&
    photo[1] === 0x50 &&
    photo[2] === 0x4e &&
    photo[3] === 0x47;
  return isPng ? "png" : null;
};

const portrait = (photo: null | Uint8Array): null | ReactElement => {
  const format = photo === null ? null : imageFormat(photo);
  if (photo === null || format === null) return null;
  const src = { data: Buffer.from(photo), format };
  return createElement(Image, { src, style: styles.photo });
};

const profileLink = (
  label: string,
  base: string,
  handle: string,
  trailer: string
): null | ReactElement => {
  const trimmed = handle.trim();
  const href = `${base}${encodeURIComponent(trimmed)}${trailer}`;
  return trimmed === "" ? null : contactLine(`${label}${trimmed}`, href);
};

const contactRows = (basics: Cv["basics"]): Array<null | ReactElement> => {
  const website = httpHref(basics.websiteUrl);
  const site = basics.websiteUrl.trim().replace(/^https?:\/\/(?:www\.)?/i, "");
  return [
    basics.email ? contactLine(basics.email, mailHref(basics.email)) : null,
    basics.location
      ? createElement(Text, { style: styles.subtle }, basics.location)
      : null,
    website === null ? null : contactLine(site, website),
    profileLink(
      labels.linkedinPrefix,
      "https://www.linkedin.com/in/",
      basics.linkedinHandle,
      "/"
    ),
    profileLink(
      labels.githubPrefix,
      "https://github.com/",
      basics.githubHandle,
      ""
    ),
  ];
};

const identity = (basics: Cv["basics"]): ReactElement => {
  const name = createElement(Text, { style: styles.name }, basics.name);
  const headline = basics.headline
    ? createElement(Text, { style: styles.headline }, basics.headline)
    : null;
  const contacts = createElement(
    View,
    { style: { marginTop: 3 } },
    ...contactRows(basics)
  );
  return createElement(View, { style: { flex: 1 } }, name, headline, contacts);
};

const header = (cv: Cv, photo: null | Uint8Array): ReactElement =>
  createElement(
    View,
    { style: styles.header },
    portrait(photo),
    identity(cv.basics)
  );

const organisation = (
  name: string,
  href: null | string,
  location: string
): ReactElement => {
  const place = location
    ? createElement(Text, { style: styles.subtle }, ` ${dash} ${location}`)
    : null;
  return createElement(Text, null, anchor(href, name), place);
};

const placeLine = (location: string): null | ReactElement =>
  location ? createElement(Text, { style: styles.subtle }, location) : null;

const periodLines = (from: string, to: string): ReactElement => {
  const period = periodOf(from, to);
  const range = period.range
    ? createElement(Text, { style: styles.subtle }, period.range)
    : null;
  const duration = period.duration
    ? createElement(Text, { style: styles.duration }, `(${period.duration})`)
    : null;
  return createElement(Fragment, null, range, duration);
};

const entryHeader = (heading: EntryHeading): ReactElement => {
  const { from, location, primary, secondary, to, url } = heading;
  const href = httpHref(url);
  let title: ReactNode = null;
  let place: null | ReactElement = null;
  if (primary && secondary) {
    title = primary;
    place = organisation(secondary, href, location);
  } else if (primary || secondary) {
    title = primary || anchor(href, secondary);
    place = placeLine(location);
  }
  const titleLine =
    title === null ? null : createElement(Text, { style: styles.title }, title);
  return createElement(
    View,
    { minPresenceAhead: 30 },
    titleLine,
    place,
    periodLines(from, to)
  );
};

const bulletRow = (
  contribution: Body["contributions"][number],
  index: number
): ReactElement => {
  const label = contribution.title
    ? createElement(
        Fragment,
        null,
        createElement(Text, { style: styles.bold }, contribution.title),
        ` ${dash} `
      )
    : null;
  const sentence = createElement(
    Text,
    { style: { flex: 1 } },
    label,
    contribution.description
  );
  const marker = createElement(Text, { style: styles.bullet }, bullet);
  const spacing = { marginTop: index === 0 ? 0 : unit };
  return createElement(
    View,
    { key: index, style: [styles.bulletRow, spacing], wrap: false },
    marker,
    sentence
  );
};

const technologyLine = (skills: string[]): ReactElement => {
  const label = createElement(
    Text,
    { style: styles.subtle },
    `${labels.technology}: `
  );
  const names = skills.map((skill, index) => {
    const separator =
      index > 0 ? createElement(Text, { style: styles.subtle }, ", ") : null;
    const name = createElement(Text, { style: styles.bold }, skill);
    return createElement(Fragment, { key: index }, separator, name);
  });
  return createElement(
    Text,
    { style: { marginTop: 2 * unit } },
    label,
    ...names
  );
};

const entryBody = (body: Body): null | ReactElement => {
  const { contributions, overview, skills } = body;
  if (!overview && contributions.length === 0 && skills.length === 0) {
    return null;
  }
  const intro = overview ? createElement(Text, null, overview) : null;
  const bullets =
    contributions.length > 0
      ? createElement(
          View,
          { style: { marginTop: overview ? unit : 0 } },
          ...contributions.map((item, index) => bulletRow(item, index))
        )
      : null;
  const technology = skills.length > 0 ? technologyLine(skills) : null;
  return createElement(
    View,
    { style: { marginTop: unit } },
    intro,
    bullets,
    technology
  );
};

const experienceEntry = (item: ExperienceItem): ReactElement =>
  createElement(
    Fragment,
    null,
    entryHeader({
      from: item.from,
      location: item.location,
      primary: item.position,
      secondary: item.company,
      to: item.to,
      url: item.websiteUrl,
    }),
    entryBody(item)
  );

const educationEntry = (item: EducationItem): ReactElement => {
  const degree = [item.degree, item.area].filter(Boolean).join(", ");
  return createElement(
    Fragment,
    null,
    entryHeader({
      from: item.from,
      location: item.location,
      primary: degree,
      secondary: item.school,
      to: item.to,
      url: item.websiteUrl,
    }),
    entryBody(item)
  );
};

const projectEntry = (item: ProjectItem): ReactElement => {
  const name = anchor(httpHref(item.websiteUrl), item.name);
  const title = item.name
    ? createElement(Text, { style: styles.title }, name)
    : null;
  const heading = createElement(
    View,
    { minPresenceAhead: 30 },
    title,
    periodLines(item.from, item.to)
  );
  return createElement(Fragment, null, heading, entryBody(item));
};

const entries = (children: ReactElement[], divided: boolean): ReactElement => {
  const rows = children.map((child, index) => {
    const spacing = divided ? styles.divided : { marginTop: 3 * unit };
    const style = index === 0 ? {} : spacing;
    return createElement(View, { key: index, style, wrap: false }, child);
  });
  return createElement(View, null, ...rows);
};

const skillLine = (
  item: Cv["skills"]["items"][number],
  index: number
): ReactElement => {
  const name = createElement(Text, { style: styles.skillName }, item.name);
  const keywords =
    item.keywords.length > 0
      ? createElement(
          Text,
          { style: styles.subtle },
          `: ${item.keywords.join(", ")}`
        )
      : null;
  return createElement(
    Text,
    { key: index, style: { marginTop: 0.75 } },
    name,
    keywords
  );
};

const languageLine = (item: Cv["languages"]["items"][number]): ReactElement => {
  const name = createElement(Text, { style: styles.medium }, item.language);
  const fluency = item.fluency
    ? createElement(Text, { style: styles.fluency }, item.fluency)
    : null;
  return createElement(Fragment, null, name, fluency);
};

const sectionsOf = (cv: Cv): ResumeSection[] => {
  const { education, experience, languages, projects, skills } = cv;
  const skillLines = skills.items.map((item, index) => skillLine(item, index));
  const sections = [
    {
      body: createElement(Text, null, cv.summary),
      heading: labels.summary,
      present: cv.summary.trim() !== "",
    },
    {
      body: createElement(View, null, ...skillLines),
      heading: labels.skills,
      present: skills.items.length > 0,
    },
    {
      body: entries(
        experience.items.map((item) => experienceEntry(item)),
        true
      ),
      heading: labels.experience,
      present: experience.items.length > 0,
    },
    {
      body: entries(
        projects.items.map((item) => projectEntry(item)),
        true
      ),
      heading: labels.projects,
      present: projects.items.length > 0,
    },
    {
      body: entries(
        education.items.map((item) => educationEntry(item)),
        true
      ),
      heading: labels.education,
      present: education.items.length > 0,
    },
    {
      body: entries(
        languages.items.map((item) => languageLine(item)),
        false
      ),
      heading: labels.languages,
      present: languages.items.length > 0,
    },
  ];
  return sections.filter((section) => section.present);
};

const sectionView = (section: ResumeSection, index: number): ReactElement => {
  const heading = createElement(
    Text,
    { minPresenceAhead: 48, style: styles.sectionHeading },
    section.heading
  );
  const style = { marginTop: index === 0 ? 0 : 8 * unit };
  return createElement(
    View,
    { key: section.heading, style },
    heading,
    section.body
  );
};

const pageLabel = (pageNumber: number, totalPages: number): string =>
  labels.page
    .replace("{page}", () => String(pageNumber))
    .replace("{pages}", () => String(totalPages));

const footer = (): ReactElement[] => [
  createElement(View, { fixed: true, style: styles.footerRule }),
  createElement(Text, {
    fixed: true,
    render: ({ pageNumber, totalPages }) => pageLabel(pageNumber, totalPages),
    style: styles.footerPage,
  }),
];

export const renderResumePdf = async (
  cv: Cv,
  photo: null | Uint8Array
): Promise<Uint8Array> => {
  registerFonts();
  const sections = sectionsOf(cv).map((section, index) =>
    sectionView(section, index)
  );
  const page = createElement(
    Page,
    { size: "A4", style: styles.page },
    header(cv, photo),
    ...sections,
    ...footer()
  );
  const modified = new Date(cv.updatedAt);
  return renderToBuffer(
    createElement(
      Document,
      {
        author: cv.basics.name,
        creationDate: modified,
        modificationDate: modified,
        title: cv.basics.name,
      },
      page
    )
  );
};
