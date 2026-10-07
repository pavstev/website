export const en = {
  card: {
    contactLabel: "Contact",
    downloaded: "Downloaded",
    downloading: "Preparing",
    downloadPdf: "Download résumé",
    email: "Email",
    github: "GitHub",
    linkedin: "LinkedIn",
    portraitAlt: "Portrait of Stevan Pavlović",
    portraitClose: "Close portrait",
    portraitDialog: "Portrait of Stevan Pavlović",
    portraitExpand: "Expand portrait",
  },
  city: {
    armsLabel: "Coat of arms of {city}: a white cross on a red shield",
    close: "Close",
    facts:
      "{city} is the capital of {country}, a city of about two million people on the Danube. It keeps landing near the top of the world’s most liveable city rankings, and about half of it is green: parks, the Vienna Woods and vineyards inside the city limits. Mozart and Beethoven made music here, the coffee houses are listed as cultural heritage, and the UN runs one of its four main offices from here.",
    failed: "The globe could not load.",
    globeLabel:
      "Interactive globe centered on {city}. Arrow keys rotate, plus and minus zoom.",
    hint: "Drag to rotate. Scroll or pinch to zoom.",
    launch: "Show on the globe",
    loading: "Loading the globe",
    percent: "{value}%",
    reload: "Reload the page",
    reset: "Back to {city}",
    retry: "Try again",
    title: "About {city}",
    unsupported:
      "This browser draws 3D graphics without a graphics chip, so the globe stays off.",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
  },
  llms: {
    about:
      "Backend and distributed-systems engineer and tech lead, living in {city}, {country}. Eleven years of building systems people rely on, in fintech, betting, healthtech and fleet logistics.",
    alsoWritten: "Also written as {name}.",
    detail:
      "Leads small teams from the first commit to production, and cares about correctness, clear interfaces and software that stays quiet.",
    email: "Email",
    github: "GitHub: open-source code",
    linkedin: "LinkedIn: professional profile",
    links: "Links",
    projects: "Open-source projects",
    resume: "Résumé (PDF): full work history",
    topics: "Topics",
    website: "Website: contact card and open-source projects",
  },
  meta: {
    description:
      "Stevan Pavlović is a backend and distributed-systems engineer and tech lead in Vienna, Austria, with 11+ years in fintech, betting, healthtech and logistics.",
    imageAlt: "Stevan Pavlović, backend engineer in Vienna",
    resume: "Résumé of Stevan Pavlović",
    shortName: "Stevan",
    title: "Stevan Pavlović · Backend & distributed-systems engineer",
  },
  notFound: {
    home: "Back to home",
    title: "Page not found",
  },
  privacy: {
    acknowledge: "OK",
    chip: "No cookies, anonymous stats",
    contact: "Privacy questions:",
    host: "The host, Cloudflare, sees technical request data such as your IP address to deliver the page and keep it safe.",
    local: "This site sets no cookies and shows no ads.",
    stats:
      "Cloudflare Web Analytics counts visits without cookies and without personal data.",
    stored: "Your OK is saved on this device, so this note stays hidden.",
  },
  profile: {
    contributingContent: "Bio, links and location: `src/lib/personal.ts`",
    contributingIntro:
      "This repository is generated. Do not edit it by hand: a GitHub Action overwrites every file here.",
    contributingLayout: "Layout, header and icons: `src/profile/`",
    contributingPreview:
      "Run `pnpm profile:build` in that repository to preview the result in `.profile-out/`.",
    contributingSource:
      "To change anything, edit the source in [pavstev/website](https://github.com/pavstev/website):",
    contributingStrings: "Text and labels: `src/lib/i18n.ts`",
    contributingTitle: "Contributing",
    generated:
      "Generated from pavstev/website (src/profile). Do not edit here.",
    resume: "Résumé (PDF)",
    website: "Website",
  },
  repos: {
    forksLabel: "forks",
    headingOne: "{count} open source project",
    headingOther: "{count} open source projects",
    languages: "Languages",
    more: "+{count}",
    moreLabel: "{count} more tags for {name}",
    newTab: "Opens in a new tab",
    starsLabel: "stars",
    topics: "Topics",
  },
} as const;
