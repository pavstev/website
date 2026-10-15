export const diagramNames = [
  "site-pipeline",
  "sky-layers",
  "work-loop",
  "skill-map",
] as const;

export type DiagramName = (typeof diagramNames)[number];

interface DiagramMeta {
  desc: string;
  title: string;
}

interface DiagramStep {
  detail: string;
  label: string;
}

export const diagramMeta: Record<DiagramName, DiagramMeta> = {
  "site-pipeline": {
    desc: "A git push goes to GitHub. Cloudflare Workers Builds then runs three steps in order: the CV fetch, the blog build and the Astro build. Out come the static assets, every page, feed and image, plus one Worker that answers /mcp.",
    title: "From git push to the live site",
  },
  "skill-map": {
    desc: "My own skills, grouped by the phase they serve. Ask: askme and pick. Research: captain-research. Build: autopilot and iamrich. Coordinate: sessions and handoff. Finish: whatsleft and mic-drop. One more, bag-mode, looks after the machine itself.",
    title: "My skills by phase",
  },
  "sky-layers": {
    desc: "Three layers, back to front. The sky canvas is fixed and draws the stars, the Earth and its clouds. The corona layer scrolls with the page, so the rays stay on the portrait. On top sits the text: a probe reads the sky behind each line and lifts text-sky until it reads.",
    title: "The three layers of the sky",
  },
  "work-loop": {
    desc: "How one change moves. Question rounds lock the design. A design lab shows the options side by side. Parallel helpers build the parts, each in its own worktree. Checks run. A push makes a preview. I read the preview and say OK. Then it lands on main, and the next change starts with question rounds again.",
    title: "How a change reaches main",
  },
};

export const sitePipeline = {
  builds: {
    label: "Workers Builds",
    steps: ["CV fetch", "blog build", "astro build"],
  },
  outputs: [
    { detail: "pages, feeds, images", label: "Static assets" },
    { detail: "/mcp", label: "Worker" },
  ],
  sources: [
    { detail: "main or a preview branch", label: "git push" },
    { detail: "the repository", label: "GitHub" },
  ],
} as const satisfies {
  builds: { label: string; steps: readonly string[] };
  outputs: readonly DiagramStep[];
  sources: readonly DiagramStep[];
};

export const skyLayers = {
  layers: [
    { detail: "lifted by the probe", label: "Text" },
    { detail: "scrolls with the page", label: "Corona layer" },
    { detail: "fixed, stars, Earth, clouds", label: "Sky canvas" },
  ],
  probe: "probe",
  utility: "text-sky",
} as const satisfies {
  layers: readonly DiagramStep[];
  probe: string;
  utility: string;
};

export const workLoop: readonly DiagramStep[] = [
  { detail: "multi-select, design locked first", label: "Question rounds" },
  { detail: "variants and knobs to pick from", label: "Design lab" },
  { detail: "one worktree each", label: "Parallel helpers" },
  { detail: "format, lint, types, tests, build", label: "Checks" },
  { detail: "a URL for every branch", label: "Push and preview" },
  { detail: "I read it there", label: "Owner OK" },
  { detail: "one squashed commit", label: "Main" },
];

export const skillMap: ReadonlyArray<{
  phase: string;
  skills: readonly string[];
}> = [
  { phase: "Ask", skills: ["askme", "pick"] },
  { phase: "Research", skills: ["captain-research"] },
  { phase: "Build", skills: ["autopilot", "iamrich"] },
  { phase: "Coordinate", skills: ["sessions", "handoff"] },
  { phase: "Finish", skills: ["whatsleft", "mic-drop"] },
  { phase: "Machine", skills: ["bag-mode"] },
];

const isDiagramName = (value: string): value is DiagramName =>
  (diagramNames as readonly string[]).includes(value);

export const diagramText = (name: string): string => {
  if (!isDiagramName(name)) throw new Error(`Unknown diagram "${name}"`);
  return diagramMeta[name].desc;
};
