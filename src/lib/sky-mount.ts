import moonMapUrl from "@/assets/moon-map.webp?url";
import { isCrawler } from "@/lib/crawler";
import { createFrameClock } from "@/lib/frame-clock";
import { createFramePacer } from "@/lib/frame-pacer";
import { isCoarseDevice, scheduleIdle } from "@/lib/idle";
import { reducedMotionQuery } from "@/lib/media";
import {
  createMoonLayer,
  maxPatch,
  moonBump,
  type MoonLayer,
  type MoonLayerState,
  patchRect,
} from "@/lib/moon-layer";
import { prefersLightLoad } from "@/lib/save-data";
import {
  isSceneHeld,
  motionPausedAttribute,
  sceneHoldEvent,
} from "@/lib/scene-hold";
import { publishSpot, skySpot } from "@/lib/sky-ask";
import { clearBox, clearUniform } from "@/lib/sky-clear";
import { placeZone, setPlaceZone } from "@/lib/sky-clock";
import {
  freshInk,
  glowFor,
  type InkMode,
  type InkPart,
  inkScores,
  type InkState,
  type InkTarget,
  inkTargets,
  liftFor,
  litSky,
  nextInk,
  nextLift,
  postInkTargets,
  sharedScores,
  skyRange,
  storyInkTargets,
} from "@/lib/sky-ink";
import {
  lutCols,
  lutRows,
  safeSkyTable,
  type SkyTable,
  warmSkyTable,
} from "@/lib/sky-light";
import {
  nightScene,
  paintScene,
  type PaintScene,
  shotScene,
  spaceBand,
  tableInput,
} from "@/lib/sky-paint";
import { paintCloudShader, paintSkyShader } from "@/lib/sky-paint-shader";
import {
  isPlace,
  placeEvent,
  type SkyPlace,
  startPlace,
  viennaPlace,
} from "@/lib/sky-place";
import { type SkyMode } from "@/lib/sky-preset";
import {
  forcedWeather,
  previewEvent,
  previewMotion,
  previewState,
  resolveInstant,
  setLiveWeather,
} from "@/lib/sky-preview";
import { createSkyProbe, type ProbeBox, type SkyProbe } from "@/lib/sky-probe";
import { meteorStart, rayView } from "@/lib/sky-rays";
import { skyVertexShader } from "@/lib/sky-shader";
import { storyInstant, storyView, storyWeather } from "@/lib/sky-story";
import {
  createTableGrid,
  gridChapter,
  gridKeeps,
  type GridView,
} from "@/lib/sky-story-grid";
import {
  setStoryChapter,
  storyChapter,
  storyEvent,
} from "@/lib/sky-story-store";
import {
  crawlerInstant,
  instantOverride,
  type Spot,
  sunSpot,
} from "@/lib/sky-sun";
import {
  arriveDelay,
  arriveMs,
  easeInOut,
  heldProgress,
  holdAt,
  leaveMs,
  linkMode,
  paintsSky,
  type Point,
  routeMode,
  tweenMs,
  tweenPose,
  tweenProgress,
} from "@/lib/sky-tween";
import { type CardRect, type ViewSize } from "@/lib/sky-view";
import { storyMorph } from "@/lib/story-morph";
import { createUniformSink, type UniformSink } from "@/lib/uniform-sink";
import {
  nightWeather,
  skyWeather,
  type SkyWeather,
  weatherGoal,
  weatherKeys,
  weatherNameOf,
  weatherNameOverride,
} from "@/lib/weather";
import {
  browserWeatherDeps,
  loadWeather,
  samePlace,
  weatherAllowed,
  weatherStaleMs,
} from "@/lib/weather-client";
import {
  bindTriangle,
  clampedTexture,
  compileShader,
  isSoftwareRenderer,
  linkProgram,
} from "@/lib/webgl";

interface CloudTarget {
  buffer: null | WebGLFramebuffer;
  height: number;
  texture: null | WebGLTexture;
  usable: boolean;
  width: number;
}

interface InkNodes {
  paint: HTMLElement | null;
  probe: Element | null;
}

type MoonMapState = "failed" | "idle" | "loading" | "ready";

type ProgramName = keyof Programs;

interface Programs {
  cloud: WebGLProgram;
  paint: WebGLProgram;
}

interface QualityLevel {
  clouds: boolean;
  scale: number;
}

type Ready = Record<ProgramName, boolean>;

type SpaceState = "fallback" | "paused" | "running" | "static";

type TableKind = "home" | "story";

interface Tween {
  clickAt: number;
  fade: number;
  forward: boolean;
  morph: boolean;
  shift: number;
  startAt: number | undefined;
  sun: Spot | undefined;
  swapped: boolean;
  to: SkyMode;
}

const softwareLevel: QualityLevel = { clouds: false, scale: 0.2 };

const LEVELS: QualityLevel[] = [
  { clouds: true, scale: 0.75 },
  { clouds: true, scale: 0.5 },
  { clouds: false, scale: 0.35 },
];

const frameDt = 1000 / 60;
const activeFrameMs = 10.8;
const maxCanvasPixels = 1_400_000;
const resizeDelayMs = 150;
const meteorMs = 1600;
const meteorGapMs = 4400;
const driftShare = 0.4;
const fadeHeadShare = 0.3;
const fadeHeadPx: [number, number] = [224, 352];
const timeWrapHighSeconds = 86_400;
const timeWrapLowSeconds = 1024;
const probeEveryMs = 1000;
const storyProbeMs = 250;
const scrollQuietMs = 180;
const probeReadMs = 34;
const probeSlackMs = 5;
const cloudZone = 0.6;
const gustMax = 3.5;
const gustEaseSeconds = 2.3;
const gustGain = 1.8;
const gustActive = 0.01;
const touchScrollShare = 0.25;
const sunEveryMs = 30_000;
const lutUnit = 2;
const moonUnit = 3;
const patchTolerance = 3;
const cloudEveryMs = 33;
const cloudCoverMin = 0.05;
const cloudCell = 2;
const narrowPaintPx = 640;
const weatherEaseSeconds = 3;
const timeLagEndMs = 30_000;

const positionSlot = 0;
const modeTargets: Readonly<Record<SkyMode, readonly InkTarget[]>> = {
  blog: postInkTargets,
  home: inkTargets,
  story: [...postInkTargets, ...storyInkTargets],
};

const viewCss = (): number => rayView(window.innerHeight);

const sceneSpot = (spot: Spot): { x: number; y: number } => ({
  x: spot.x,
  y: window.innerHeight - spot.y,
});

const cornerSpot = (spot: readonly [number, number]): Point => ({
  x: spot[0],
  y: window.innerHeight - spot[1],
});

const whenLinked = (
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  onDone: (linked: boolean) => void
): (() => void) => {
  const parallel = gl.getExtension("KHR_parallel_shader_compile");
  let handle = 0;
  const poll = (): void => {
    const pending =
      parallel !== null &&
      gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR) !== true;
    if (pending) {
      handle = globalThis.requestAnimationFrame(poll);
      return;
    }
    onDone(gl.getProgramParameter(program, gl.LINK_STATUS) === true);
  };
  poll();
  return () => globalThis.cancelAnimationFrame(handle);
};

const releaseProgram = (
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  shaders: WebGLShader[]
): void => {
  gl.deleteProgram(program);
  for (const shader of shaders) gl.deleteShader(shader);
};

const releaseWhenDetached = (
  gl: WebGLRenderingContext,
  canvas: HTMLCanvasElement
): void => {
  globalThis.setTimeout(() => {
    if (canvas.isConnected || gl.isContextLost()) return;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }, 0);
};

const sources: Readonly<Record<ProgramName, string>> = {
  cloud: paintCloudShader,
  paint: paintSkyShader,
};

const contextOptions: WebGLContextAttributes = {
  alpha: false,
  antialias: false,
  depth: false,
  powerPreference: "low-power",
  stencil: false,
};

const startSky = (
  gl: WebGLRenderingContext,
  programs: Programs,
  ready: Ready,
  canvas: HTMLCanvasElement,
  reduceMotion: MediaQueryList,
  still: boolean,
  setState: (state: SpaceState) => void
): (() => void) => {
  const pageMode = (): SkyMode =>
    routeMode(
      globalThis.location.pathname,
      document.querySelector("[data-blog]") !== null
    );
  let mode = pageMode();
  const root = document.documentElement;
  const drift = canvas.parentElement;
  const { search } = globalThis.location;
  const held = heldProgress(search);
  const triangle = bindTriangle(gl, positionSlot);
  const cloudUniforms = createUniformSink(gl, programs.cloud);
  const paintUniforms = createUniformSink(gl, programs.paint);
  const highPrecision =
    (gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)
      ?.precision ?? 0) > 0;
  const timeWrap = highPrecision ? timeWrapHighSeconds : timeWrapLowSeconds;

  let level = 0;
  const currentLevel = (): QualityLevel | undefined =>
    still ? softwareLevel : (LEVELS[level] ?? LEVELS[0]);
  let scale = 1;
  let rafId = 0;
  let frozen = false;
  let targets = modeTargets[mode];
  let probe: SkyProbe | undefined;
  let inkNodes: InkNodes[] = [];
  let lifts: number[] = [];
  let glows: number[] = [];
  let inkSeen: boolean[] = [];
  let inkStates: InkState[] = [];
  const textRange = document.createRange();
  let probedAt = performance.now();
  let scrolledAt = -Infinity;
  let probeTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let readTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let arriveTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let probing = false;
  let probeFirm = false;
  let cloudTime = 0;
  const meteor = { angle: 0, at: 0, x: 0, y: 0 };
  const gust = { dir: -1, energy: 0, inside: false, x: 0, y: 0 };
  const pinned = instantOverride(search);
  const crawler = pinned === undefined && isCrawler(navigator.userAgent);
  const calm = crawler || prefersLightLoad();
  if (calm && drift) drift.dataset["skyStill"] = "";
  const weatherFromUrl = weatherNameOverride(search);
  const weatherFixed = (): SkyWeather | undefined =>
    forcedWeather(previewState().weather, weatherFromUrl);
  const weatherLive = (): boolean =>
    weatherAllowed({
      crawler,
      home: mode === "home",
      lightLoad: prefersLightLoad(),
      pinned: weatherFixed() !== undefined,
    });
  let place: SkyPlace = startPlace(search, crawler);
  let weatherReported: SkyWeather | undefined;
  let tween: Tween | undefined;
  const skyKind = (): TableKind => {
    if (tween && !tween.swapped && tween.to !== "blog")
      return tween.to === "story" ? "story" : "home";
    return mode === "story" ? "story" : "home";
  };
  const skyPlace = (): SkyPlace =>
    skyKind() === "story" ? viennaPlace : place;
  const goalWeather = (): SkyWeather =>
    skyKind() === "story"
      ? storyWeather(storyChapter())
      : weatherGoal(mode === "home", weatherFixed(), weatherReported);
  let weatherTarget: SkyWeather = goalWeather();
  const weatherShown: SkyWeather = { ...weatherTarget };
  let weatherEasing = false;
  let weatherEaseMs = weatherEaseSeconds * 1000;
  let timeLag = 0;
  let shownAt: number | undefined;
  let holdUntil = -Infinity;
  let quietUntil = -Infinity;
  let previewAt = -Infinity;
  let goalAt = -Infinity;
  let goalWait = false;
  let weatherAt = -Infinity;
  let scene: PaintScene | undefined;
  let night: PaintScene | undefined;
  let table: SkyTable | undefined;
  let cancelTable: (() => void) | undefined;
  let tableWait = false;
  let tableUrgent = false;
  let tableTried = false;
  let tableWarm = false;
  let afterTable: (() => void) | undefined;
  let tableKind: TableKind | undefined =
    mode === "blog" ? undefined : skyKind();
  let homeTable: SkyTable | undefined;
  const grid = createTableGrid();
  let gridView: GridView | undefined;
  let cancelGrid: (() => void) | undefined;
  let storyStale = false;
  let stillStep = -1;
  let firmInk = false;
  let restTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  const lutTexture = gl.createTexture();
  let moonMapState: MoonMapState = "idle";
  let moonTexture: null | WebGLTexture = null;
  let moonImage: HTMLImageElement | undefined;
  let moonLayer: MoonLayer | undefined;
  let moonLayerFailed = false;
  let moonLayerHidden = true;
  let moonLayerSeen = -1;
  let moonLayerState: MoonLayerState | undefined;
  let moonPatch: MoonLayerState["cloud"];
  const patchPixels = new Uint8Array(maxPatch * maxPatch * 4);
  const patchSeen = new Uint8Array(maxPatch * maxPatch);
  let patchSeenSize = 0;
  let cancelMoonMap: (() => void) | undefined;
  let firstFramed = false;
  let disposed = false;
  let sceneAt = -Infinity;
  let sceneVersion = 0;
  const uploaded = { cloud: -1, paint: -1 };
  let windPos = 0;
  let drawn: PaintScene | undefined;
  let cloudsAt = -Infinity;
  let cloudsDirty = true;
  const cloudTarget: CloudTarget = {
    buffer: gl.createFramebuffer(),
    height: 0,
    texture: gl.createTexture(),
    usable: false,
    width: 0,
  };
  const goalInstant = (): number => {
    if (skyKind() === "story") return storyInstant(storyChapter());
    return crawler
      ? crawlerInstant
      : resolveInstant(
          previewState().time,
          pinned,
          Date.now(),
          placeZone(place)
        );
  };
  const instant = (): number => goalInstant() + timeLag;
  let holding = false;
  let driftFrame = 0;
  let previewFrame = 0;
  const scriptDrift =
    drift !== null && !CSS.supports("animation-timeline", "scroll()");
  const clock = createFrameClock();
  let resizeTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  const cardRange = document.createRange();

  const meteorView = (): number => Math.max(1, viewCss() * scale);

  const launch = (now: number): void => {
    const view = meteorView();
    Object.assign(
      meteor,
      meteorStart(canvas.width, window.innerHeight * scale, view),
      {
        at: now + meteorGapMs,
      }
    );
  };

  const pacer = createFramePacer({
    activeFrameMs,
    canDowngrade: () => level < LEVELS.length - 1,
    downgrade: () => {
      level += 1;
      resize();
    },
  });
  const { markActive } = pacer;

  const resize = (): void => {
    const entry = currentLevel();
    if (!entry) return;
    const cssWidth = Math.max(1, canvas.clientWidth);
    const cssHeight = Math.max(1, canvas.clientHeight);
    const cap = Math.sqrt(maxCanvasPixels / (cssWidth * cssHeight));
    scale = Math.min(entry.scale, cap) * Math.min(window.devicePixelRatio, 1);
    const width = Math.max(1, Math.floor(cssWidth * scale));
    const height = Math.max(1, Math.floor(cssHeight * scale));
    if (width === canvas.width && height === canvas.height) return;
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
    sceneVersion += 1;
    cloudsDirty = true;
  };

  const screenView = (): ViewSize => {
    const view: ViewSize = {
      height: window.innerHeight,
      width: window.innerWidth,
    };
    const card = document.querySelector("[data-card]")?.getBoundingClientRect();
    if (!card || card.width <= 0) return view;
    let { left, right } = card;
    const bio = document.querySelector("[data-card] .bio");
    if (bio) {
      cardRange.selectNodeContents(bio);
      const text = cardRange.getBoundingClientRect();
      if (text.width > 0) ({ left, right } = text);
    }
    view.card = { bottom: card.bottom, left, right, top: card.top };
    return view;
  };

  const clearRect = (): CardRect | undefined => {
    const card = document.querySelector("[data-card]")?.getBoundingClientRect();
    if (!card || card.width <= 0) return undefined;
    const texts = document.querySelectorAll(
      "[data-card] h1, [data-card] .bio, [data-card] .card-footer"
    );
    return clearBox(
      card,
      Array.from(texts, (text) => text.getBoundingClientRect())
    );
  };

  const paintReady = (): boolean => ready.paint && ready.cloud;
  const paintsNow = (): boolean => paintsSky(mode) && paintReady();
  const storyNow = (): boolean => skyKind() === "story";

  const viewFor = (view: ViewSize): ViewSize =>
    storyNow() ? storyView(view, storyChapter()) : view;

  const sceneView = (): ViewSize =>
    viewFor({
      ...screenView(),
      width: canvas.clientWidth,
    });

  const uploadTable = (data?: SkyTable): void => {
    gl.activeTexture(gl.TEXTURE0 + lutUnit);
    gl.bindTexture(gl.TEXTURE_2D, lutTexture);
    if (data) {
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        lutCols,
        lutRows,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        data.pixels
      );
    } else {
      clampedTexture(gl, gl.LINEAR);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        lutCols,
        lutRows,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null
      );
    }
    gl.activeTexture(gl.TEXTURE0);
  };

  const uploadMoonMap = (image: HTMLImageElement): void => {
    moonTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + moonUnit);
    gl.bindTexture(gl.TEXTURE_2D, moonTexture);
    clampedTexture(gl, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.activeTexture(gl.TEXTURE0);
    moonImage = image;
    moonMapState = "ready";
  };

  const wantsMoonMap = (): boolean =>
    moonMapState === "idle" &&
    scene !== undefined &&
    (scene.moon[3] > 0 || storyNow());

  const loadMoonMap = async (): Promise<void> => {
    cancelMoonMap = undefined;
    if (!paintsSky(mode) || !wantsMoonMap()) return;
    moonMapState = "loading";
    const image = new Image();
    image.src = moonMapUrl;
    try {
      await image.decode();
    } catch {
      moonMapState = "failed";
      return;
    }
    if (disposed) return;
    uploadMoonMap(image);
    if (!rafId && paintsSky(mode)) drawStill();
  };

  const queueMoonMap = (): void => {
    if (!firstFramed || cancelMoonMap || !wantsMoonMap()) return;
    cancelMoonMap = scheduleIdle(() => loadMoonMap(), {
      fallbackMs: 200,
      timeout: 2000,
    });
  };

  const refreshHome = (): void => {
    shownAt = instant();
    scene = paintScene(shownAt, sceneView(), weatherShown, skyPlace(), table);
    if (!crawler && !storyNow()) {
      publishSpot(
        skySpot(scene.moon, scene.sun, window.innerHeight, window.innerWidth)
      );
    }
  };

  const refreshScene = (): void => {
    night = nightScene(sceneView(), nightWeather);
    if (paintsSky(mode)) refreshHome();
    sceneAt = performance.now();
    sceneVersion += 1;
    cloudsDirty = true;
    queueMoonMap();
  };

  const gridSize = (): GridView => {
    const view = sceneView();
    return { height: view.height, width: view.width };
  };

  const buildGrid = (): void => {
    cancelGrid = undefined;
    if (mode !== "story" || !table || !paintReady()) return;
    gridView ??= gridSize();
    const index = grid.next(storyChapter());
    if (index === undefined) return;
    const at = gridChapter(index);
    const weather = storyWeather(at);
    const instantAt = storyInstant(at);
    const built = safeSkyTable(
      tableInput(instantAt, storyView(gridView, at), weather, viennaPlace)
    );
    if (built) grid.put(index, built);
    else grid.skip(index);
    cancelGrid = scheduleIdle(buildGrid, { fallbackMs: 30, timeout: 400 });
  };

  const queueGrid = (): void => {
    if (
      still ||
      calm ||
      cancelGrid ||
      mode !== "story" ||
      !table ||
      !paintReady()
    )
      return;
    cancelGrid = scheduleIdle(buildGrid, { fallbackMs: 30, timeout: 400 });
  };

  const keepGrid = (): void => {
    const now = gridSize();
    if (gridView && !gridKeeps(gridView, now)) grid.reset();
    if (!gridView || grid.filled() === 0) gridView = now;
    queueGrid();
  };

  const buildTable = (): void => {
    cancelTable = undefined;
    tableUrgent = false;
    if (!tableWarm && paintsNow()) {
      tableWarm = true;
      warmSkyTable();
      cancelTable = scheduleIdle(buildTable, { fallbackMs: 0, timeout: 200 });
      return;
    }
    try {
      if (paintsNow()) {
        tableTried = true;
        const built = safeSkyTable(
          tableInput(instant(), sceneView(), weatherShown, skyPlace())
        );
        if (built) {
          table = built;
          uploadTable(built);
        }
        refreshScene();
        if (mode === "story") {
          firmInk = true;
          probedAt = -Infinity;
          keepGrid();
        }
      }
    } finally {
      tableWait = false;
      const first = afterTable;
      afterTable = undefined;
      if (first) first();
      else if (!rafId && paintsSky(mode)) drawStill();
    }
  };

  const queueTable = (urgent = false): void => {
    if (!paintsNow()) return;
    if (cancelTable) {
      if (!urgent || tableUrgent) return;
      cancelTable();
      cancelTable = undefined;
    }
    tableUrgent = urgent;
    if (!table && !tableTried) tableWait = true;
    cancelTable = scheduleIdle(
      buildTable,
      table && !urgent
        ? { fallbackMs: 50, timeout: 1000 }
        : { fallbackMs: 0, timeout: 200 }
    );
  };

  const markHome = (): void => {
    drift?.toggleAttribute(
      "data-sky-home",
      paintReady() && (paintsSky(mode) || tween !== undefined)
    );
  };

  const switchTableTo = (kind: TableKind): void => {
    if (tableKind === kind) return;
    if (tableKind === "home") homeTable = table;
    tableKind = kind;
    cancelGrid?.();
    cancelGrid = undefined;
    grid.reset();
    gridView = undefined;
    table = kind === "home" ? homeTable : undefined;
    tableTried = table !== undefined;
    if (table) uploadTable(table);
  };

  const buildStoryTable = (): void => {
    switchTableTo("story");
    const at = storyInstant(storyChapter());
    const built = safeSkyTable(
      tableInput(at, sceneView(), weatherShown, viennaPlace)
    );
    if (!built) return;
    table = built;
    tableTried = true;
    uploadTable(built);
    firmInk = true;
    probedAt = -Infinity;
  };

  const easeWeather = (dt: number): boolean => {
    const share = rafId ? 1 - Math.exp(-dt / (weatherEaseMs / 3)) : 1;
    let moved = false;
    for (const key of weatherKeys) {
      const gap = weatherTarget[key] - weatherShown[key];
      if (gap === 0) continue;
      moved = true;
      weatherShown[key] =
        Math.abs(gap) < 0.002
          ? weatherTarget[key]
          : weatherShown[key] + gap * share;
    }
    weatherShown.windFrom = weatherTarget.windFrom;
    return moved;
  };

  const snapWeather = (): void => {
    Object.assign(weatherShown, weatherTarget);
    weatherEasing = false;
  };

  const easeTime = (dt: number): boolean => {
    timeLag *= Math.exp(-dt / (previewMotion.skyMs / 3));
    if (Math.abs(timeLag) < timeLagEndMs) timeLag = 0;
    return timeLag !== 0;
  };

  const refreshWeather = async (): Promise<void> => {
    if (!weatherLive() || document.hidden) return;
    const asked = place;
    weatherAt = Date.now();
    const report = await loadWeather(asked, browserWeatherDeps());
    if (!report || !samePlace(asked, place)) return;
    setPlaceZone(asked, report.zone);
    weatherReported = skyWeather(report);
    setLiveWeather(weatherNameOf(report.code));
    if (mode !== "home" || weatherFixed()) return;
    weatherTarget = weatherReported;
    weatherEaseMs = weatherEaseSeconds * 1000;
    weatherEasing = true;
    queueTable();
    if (rafId) return;
    snapWeather();
    refreshScene();
    drawStill();
  };

  const liveDrift = (): [number, number] => {
    if (!drift || paintsNow()) return [0, 0];
    const flagged = Object.hasOwn(drift.dataset, "skyHome");
    delete drift.dataset["skyHome"];
    delete drift.dataset["skyTween"];
    const [, y = "0"] = getComputedStyle(drift).translate.split(" ", 2);
    const fadeNode = drift.querySelector("[data-sky-fade]");
    const fade = fadeNode ? Number(getComputedStyle(fadeNode).opacity) : 0;
    drift.dataset["skyTween"] = "";
    if (flagged) drift.dataset["skyHome"] = "";
    const shift = Number(y.replace("px", ""));
    return [Number.isFinite(shift) ? shift : 0, fade];
  };

  const pinDrift = (active: Tween, share: number): void => {
    if (!drift) return;
    const [shift, fade] = liveDrift();
    drift.style.setProperty(
      "--sky-shift",
      `${(active.shift + (shift - active.shift) * share).toFixed(1)}px`
    );
    drift.style.setProperty(
      "--sky-fade-now",
      (active.fade + (fade - active.fade) * share).toFixed(3)
    );
  };

  const shot = (now: number, active: Tween): PaintScene | undefined => {
    active.startAt ??= now;
    const progress = holdAt(
      tweenProgress(now - active.startAt, active.forward),
      held,
      active.forward
    );
    const mix = easeInOut(progress);
    pinDrift(active, easeInOut(active.forward ? progress : 1 - progress));
    drift?.style.setProperty("--sky-paint", (1 - mix).toFixed(3));
    markActive();
    if (!scene || !night) return night ?? scene;
    const pose = tweenPose(
      progress,
      active.sun,
      cornerSpot([night.corona[0], night.corona[1]]),
      { height: window.innerHeight, width: window.innerWidth }
    );
    return shotScene(scene, night, mix, {
      corona: { x: night.corona[0], y: night.corona[1] },
      disk: pose.disk,
      sun: pose.sun ? sceneSpot(pose.sun) : undefined,
    });
  };

  const frameScene = (now: number): PaintScene | undefined => {
    if (tween) return shot(now, tween);
    return paintsSky(mode) ? scene : night;
  };

  const retarget = (): void => {
    probe?.dispose();
    targets = modeTargets[mode];
    probe = createSkyProbe(gl, paintUniforms, targets.length);
    inkNodes = targets.map(() => ({ paint: null, probe: null }));
    lifts = targets.map(() => 0);
    glows = targets.map(() => 0);
    inkSeen = targets.map(() => false);
    inkStates = targets.map(() => freshInk);
    probing = false;
    probedAt = -Infinity;
    markHome();
  };

  const applyInk = (slot: number): void => {
    const node = inkNodes[slot]?.paint;
    if (!node) return;
    if (inkStates[slot]?.mode === "dark") node.dataset["ink"] = "dark";
    else delete node.dataset["ink"];
    if (litSky(inkStates[slot]?.mode, lifts[slot] ?? 0))
      node.dataset["lit"] = "";
    else delete node.dataset["lit"];
    node.style.setProperty("--lift", (lifts[slot] ?? 0).toFixed(2));
    node.style.setProperty("--glow", (glows[slot] ?? 0).toFixed(2));
  };

  const inkBox = (slot: number, box: DOMRect): ProbeBox | undefined => {
    const target = targets[slot];
    const nodes = inkNodes[slot];
    if (!target || !nodes) return undefined;
    if (!nodes.probe?.isConnected || !nodes.paint?.isConnected) {
      nodes.probe =
        document.querySelectorAll(target.probe)[target.index] ?? null;
      nodes.paint =
        document.querySelectorAll<HTMLElement>(target.paint)[target.index] ??
        null;
      applyInk(slot);
    }
    if (!nodes.probe) return undefined;
    textRange.selectNodeContents(nodes.probe);
    const area = textRange.getBoundingClientRect();
    const left = Math.max(area.left, box.left);
    const right = Math.min(area.right, box.right);
    const top = Math.max(area.top, box.top);
    const bottom = Math.min(area.bottom, box.bottom);
    if (right - left < 1 || bottom - top < 1) return undefined;
    return {
      bottom: (box.bottom - bottom) * scale,
      left: (left - box.left) * scale,
      right: (right - box.left) * scale,
      top: (box.bottom - top) * scale,
    };
  };

  const readPaintedInk = (
    pixels: Uint8Array,
    reader: SkyProbe,
    firm: boolean
  ): void => {
    const ranges = targets.map((_, slot) =>
      inkNodes[slot]?.paint && inkSeen[slot] === true
        ? skyRange(pixels, {
            columns: reader.columns,
            rows: reader.rows,
            slot,
            stride: reader.stride,
          })
        : undefined
    );
    const decided = new Map<string, InkState>();
    const groupInk = (group: string, prior: InkState): InkState => {
      const known = decided.get(group);
      if (known) return known;
      const parts: InkPart[] = [];
      for (const [slot, member] of targets.entries()) {
        const range = ranges[slot];
        if (range && member.group === group)
          parts.push({ need: member.need, scores: inkScores(range) });
      }
      const state = nextInk(prior, sharedScores(parts), 1, firm);
      decided.set(group, state);
      return state;
    };
    for (const [slot, target] of targets.entries()) {
      const range = ranges[slot];
      if (!range) continue;
      const prior = inkStates[slot] ?? freshInk;
      const state =
        target.group === undefined
          ? nextInk(prior, inkScores(range), target.need, firm)
          : groupInk(target.group, prior);
      inkStates[slot] = state;
      const wanted: InkMode = state.mode ?? "light";
      const wantedLift =
        wanted === "dark" ? 0 : liftFor(target.base, range.bright, target.need);
      lifts[slot] =
        wanted === "dark" ? 0 : nextLift(lifts[slot] ?? 0, wantedLift);
      glows[slot] = glowFor(
        wanted,
        target.base,
        wantedLift,
        range,
        target.need
      );
      applyInk(slot);
    }
  };

  const readInk = (): void => {
    if (readTimer !== undefined) globalThis.clearTimeout(readTimer);
    readTimer = undefined;
    if (!probe || !probing) return;
    probing = false;
    const pixels = probe.read();
    if (pixels) readPaintedInk(pixels, probe, probeFirm);
  };

  const wakeProbe = (delay: number): void => {
    if (probeTimer !== undefined) globalThis.clearTimeout(probeTimer);
    probeTimer = globalThis.setTimeout(() => {
      probeTimer = undefined;
      scrolledAt = -Infinity;
      if (!rafId) drawStill();
    }, delay);
  };

  const drawInk = (now: number, goal = false): void => {
    if (!probe || probing || tween) return;
    if (!goal && now < quietUntil) return;
    const story = mode === "story";
    if (
      !goal &&
      ((!story && now - scrolledAt < scrollQuietMs) ||
        (rafId && now - probedAt < (story ? storyProbeMs : probeEveryMs)))
    ) {
      if (!rafId && !story)
        wakeProbe(
          Math.max(
            scrollQuietMs - (now - scrolledAt),
            probeEveryMs - (now - probedAt)
          ) + probeSlackMs
        );
      return;
    }
    probedAt = now;
    const box = canvas.getBoundingClientRect();
    const boxes = targets.map((_, slot) => inkBox(slot, box));
    for (const [slot, area] of boxes.entries())
      inkSeen[slot] = area !== undefined;
    paintUniforms.set("u_moonFace", 1);
    probing = probe.draw(boxes);
    probeFirm = goal && probing;
    paintUniforms.set("u_moonFace", moonLayer ? 0 : 1);
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (probing && !rafId)
      readTimer = globalThis.setTimeout(readInk, probeReadMs);
  };

  const fly = (skyMs: number): void => {
    const flight =
      !crawler && rafId && mode === "blog"
        ? (skyMs - meteor.at) / meteorMs
        : -1;
    if (flight >= 1) launch(skyMs);
    if (flight >= 0 && flight < 1) markActive();
    paintUniforms.set(
      "u_meteor",
      meteor.x,
      meteor.y,
      meteor.angle,
      flight >= 0 && flight < 1 ? flight : 2
    );
    paintUniforms.set("u_meteorScale", meteorView());
  };

  const unpin = (): void => {
    if (!drift) return;
    delete drift.dataset["skyTween"];
    drift.style.removeProperty("--sky-shift");
    drift.style.removeProperty("--sky-fade-now");
    drift.style.removeProperty("--sky-paint");
  };

  const clearArrive = (): void => {
    if (arriveTimer !== undefined) globalThis.clearTimeout(arriveTimer);
    arriveTimer = undefined;
    delete root.dataset["skyArrive"];
    root.style.removeProperty("--sky-arrive-delay");
  };

  const finish = (): void => {
    const done = tween;
    if (!done) return;
    tween = undefined;
    delete root.dataset["skyLeave"];
    unpin();
    if (!done.swapped) clearArrive();
    markHome();
    if (scriptDrift) placeDrift();
    probedAt = -Infinity;
    sync();
  };

  const bindGeometry = (): void => {
    gl.bindBuffer(gl.ARRAY_BUFFER, triangle);
    gl.enableVertexAttribArray(positionSlot);
    gl.vertexAttribPointer(positionSlot, 2, gl.FLOAT, false, 0, 0);
  };

  const uploadScene = (sink: UniformSink, data: PaintScene): void => {
    sink.set("u_cumulus", data.cumulus);
    sink.set("u_alto", data.alto);
    sink.set("u_cirrus", data.cirrus);
    sink.set("u_top", ...data.top);
    sink.set("u_mid", ...data.mid);
    sink.set("u_low", ...data.low);
    sink.set("u_lit", ...data.lit);
    sink.set("u_shade", ...data.shade);
    sink.set("u_sunCol", ...data.sunColor);
    sink.set(
      "u_sun",
      data.sun[0] * scale,
      data.sun[1] * scale,
      data.sun[2] * scale
    );
    sink.set("u_sunUp", data.sunUp);
    sink.set("u_glow", data.glow);
    sink.set("u_ov", data.overcast);
    sink.set(
      "u_moon",
      data.moon[0] * scale,
      data.moon[1] * scale,
      data.moon[2] * scale,
      data.moon[3]
    );
    sink.set("u_moonCol", ...data.moonColor);
    sink.set("u_moonGlow", data.moonGlow);
    sink.set("u_band", spaceBand);
    sink.set("u_space", ...data.spaceColor);
    sink.set("u_lutMix", data.lutMix);
    sink.set("u_grey", data.grey);
  };

  const bindLut = (program: WebGLProgram): void => {
    gl.uniform1i(gl.getUniformLocation(program, "u_lut"), lutUnit);
  };

  const sizeClouds = (width: number, height: number): boolean => {
    if (width === cloudTarget.width && height === cloudTarget.height)
      return cloudTarget.usable;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, cloudTarget.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    clampedTexture(gl, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, cloudTarget.buffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      cloudTarget.texture,
      0
    );
    cloudTarget.usable =
      gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE0);
    cloudTarget.width = width;
    cloudTarget.height = height;
    cloudsDirty = true;
    return cloudTarget.usable;
  };

  const renderClouds = (
    data: PaintScene,
    time: number,
    screenPx: number
  ): void => {
    gl.useProgram(programs.cloud);
    if (uploaded.cloud !== sceneVersion) {
      uploadScene(cloudUniforms, data);
      bindLut(programs.cloud);
      cloudUniforms.set(
        "u_light",
        data.light[0] * scale,
        data.light[1] * scale
      );
      cloudUniforms.set("u_lightCol", ...data.lightColor);
      cloudUniforms.set(
        "u_firstLayer",
        window.innerWidth < narrowPaintPx || isCoarseDevice() ? 1 : 0
      );
      uploaded.cloud = sceneVersion;
    }
    cloudUniforms.set("u_res", canvas.width, screenPx);
    cloudUniforms.set("u_cell", cloudCell);
    cloudUniforms.set("u_time", time);
    cloudUniforms.set("u_wind", windPos);
    gl.bindFramebuffer(gl.FRAMEBUFFER, cloudTarget.buffer);
    gl.viewport(0, 0, cloudTarget.width, cloudTarget.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    cloudTime = time;
  };

  const drawClouds = (
    data: PaintScene,
    time: number,
    screenPx: number
  ): void => {
    const patchFirst = rafId !== 0 && cloudsAt > -Infinity;
    if (patchFirst) moonPatch = readMoonPatch(data);
    renderClouds(data, time, screenPx);
    if (!patchFirst) moonPatch = readMoonPatch(data);
  };

  const cloudsFor = (
    data: PaintScene,
    current: QualityLevel,
    screenPx: number
  ): boolean =>
    current.clouds &&
    (data.cumulus >= cloudCoverMin ||
      data.alto >= cloudCoverMin ||
      data.cirrus >= cloudCoverMin ||
      data.overcast > 0) &&
    sizeClouds(
      Math.ceil(canvas.width / cloudCell),
      Math.ceil(screenPx / cloudCell)
    );

  const readMoonPatch = (data: PaintScene): MoonLayerState["cloud"] => {
    if (!moonLayer || data.moon[3] <= 0) return undefined;
    const perCss = cloudTarget.width / Math.max(1, canvas.clientWidth);
    const rect = patchRect(
      { radius: data.moon[2], x: data.moon[0], y: data.moon[1] },
      cloudTarget,
      perCss
    );
    if (rect.size < 2) return undefined;
    const pixels = patchPixels.subarray(0, rect.size * rect.size * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, cloudTarget.buffer);
    gl.readPixels(
      rect.x,
      rect.y,
      rect.size,
      rect.size,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return {
      at: [data.moon[0] * perCss - rect.x, data.moon[1] * perCss - rect.y],
      data: pixels,
      perCss,
      size: rect.size,
    };
  };

  const loseMoonLayer = (): void => {
    moonLayer?.dispose();
    moonLayer = undefined;
    moonLayerFailed = true;
    sceneVersion += 1;
    if (!rafId) drawStill();
  };

  const startMoonLayer = (): void => {
    if (moonLayer || moonLayerFailed || !moonImage || !drift) return;
    moonLayer = createMoonLayer(drift, moonImage, loseMoonLayer);
    moonLayerFailed = moonLayer === undefined;
    moonLayerSeen = -1;
    moonLayerHidden = true;
  };

  const patchMoved = (patch: MoonLayerState["cloud"]): boolean => {
    const size = patch?.size ?? 0;
    const texels = size * size;
    let moved = size !== patchSeenSize;
    for (let i = 0; patch && !moved && i < texels; i++)
      moved =
        Math.abs((patch.data[i * 4 + 3] ?? 0) - (patchSeen[i] ?? 0)) >
        patchTolerance;
    if (!moved) return false;
    for (let i = 0; patch && i < texels; i++)
      patchSeen[i] = patch.data[i * 4 + 3] ?? 0;
    patchSeenSize = size;
    return true;
  };

  const drawMoonLayer = (
    data: PaintScene,
    cloudFrame: boolean,
    cloudsOn: boolean
  ): void => {
    if (!moonLayer) return;
    const cloud = cloudsOn ? moonPatch : undefined;
    const moved = cloudFrame && patchMoved(cloud);
    if (!moved && !moonLayerHidden && moonLayerSeen === sceneVersion) return;
    moonLayerSeen = sceneVersion;
    moonLayerState = {
      cloud,
      color: data.moonColor,
      earth: data.earth,
      fade: data.moon[3],
      light: data.moonLight,
      north: data.moonNorth,
      radius: data.moon[2],
      tint: data.moonTint,
      x: data.moon[0],
      y: window.innerHeight - data.moon[1],
    };
    moonLayer.draw(moonLayerState);
    moonLayerHidden = false;
  };

  const hideMoonLayer = (): void => {
    if (!moonLayer || moonLayerHidden || !moonLayerState) return;
    moonLayer.draw({ ...moonLayerState, fade: 0 });
    moonLayerHidden = true;
  };

  const uploadPaint = (data: PaintScene): void => {
    uploadScene(paintUniforms, data);
    bindLut(programs.paint);
    paintUniforms.set("u_stars", data.stars);
    paintUniforms.set("u_starGate", 1);
    paintUniforms.set("u_haze", data.haze);
    paintUniforms.set("u_rain", data.rain);
    paintUniforms.set("u_snow", data.snow);
    paintUniforms.set("u_fog", data.fog);
    paintUniforms.set("u_moonL", ...data.moonLight);
    paintUniforms.set("u_moonN", ...data.moonNorth);
    paintUniforms.set("u_earth", data.earth);
    paintUniforms.set("u_moonTint", ...data.moonTint);
    paintUniforms.set("u_aura", data.aura);
    paintUniforms.set("u_bump", moonBump);
    paintUniforms.set("u_px", scale);
    paintUniforms.set(
      "u_corona",
      data.corona[0] * scale,
      data.corona[1] * scale,
      data.corona[2]
    );
    paintUniforms.set("u_coronaCol", ...data.lightColor);
    gl.uniform1i(gl.getUniformLocation(programs.paint, "u_clouds"), 1);
    gl.uniform1i(gl.getUniformLocation(programs.paint, "u_moonMap"), moonUnit);
  };

  const probeGoal = (now: number): boolean => {
    if (!probe || probing || tween || !paintReady()) return false;
    const at = goalInstant();
    const view = sceneView();
    const goalTable = table
      ? (safeSkyTable(tableInput(at, view, weatherTarget, place)) ?? table)
      : undefined;
    if (goalTable && goalTable !== table) uploadTable(goalTable);
    const goal = paintScene(at, view, weatherTarget, place, goalTable);
    const current = currentLevel();
    const screenPx = Math.max(1, window.innerHeight * scale);
    const cloudsOn =
      current !== undefined && cloudsFor(goal, current, screenPx);
    if (cloudsOn) {
      uploaded.cloud = -1;
      renderClouds(goal, cloudTime, screenPx);
      uploaded.cloud = -1;
      cloudsDirty = true;
    }
    gl.useProgram(programs.paint);
    uploadPaint(goal);
    uploaded.paint = -1;
    paintUniforms.set("u_cloudOn", cloudsOn ? 1 : 0);
    drawInk(now, true);
    if (table && goalTable !== table) uploadTable(table);
    return true;
  };

  const askGoal = (now: number): void => {
    goalWait = rafId !== 0 && now - goalAt < previewMotion.inkLeadMs;
    if (goalWait) return;
    goalWait = !probeGoal(now);
    if (!goalWait) goalAt = now;
  };

  const drawPaint = (
    now: number,
    skyMs: number,
    current: QualityLevel,
    data: PaintScene
  ): void => {
    const screenPx = Math.max(1, window.innerHeight * scale);
    const floor = (canvas.clientHeight - window.innerHeight) * scale;
    const time = (skyMs / 1000) % timeWrap;
    const cloudsOn = cloudsFor(data, current, screenPx);
    const cloudFrame =
      cloudsOn && (cloudsDirty || !rafId || now - cloudsAt >= cloudEveryMs);
    if (moonMapState === "ready" && data.moon[3] > 0) startMoonLayer();
    if (cloudFrame) {
      drawClouds(data, time, screenPx);
      cloudsAt = now;
      cloudsDirty = false;
    }
    gl.useProgram(programs.paint);
    if (uploaded.paint !== sceneVersion) {
      uploadPaint(data);
      uploaded.paint = sceneVersion;
    }
    paintUniforms.set("u_res", canvas.width, screenPx);
    paintUniforms.set("u_floor", floor);
    paintUniforms.set("u_cell", cloudCell);
    paintUniforms.set("u_cloudRes", cloudTarget.width, cloudTarget.height);
    paintUniforms.set("u_time", time);
    paintUniforms.set("u_wind", windPos);
    const fallStill = !rafId && data.rain + data.snow > 0;
    paintUniforms.set("u_still", fallStill ? 1 : 0);
    paintUniforms.set(
      "u_clear",
      ...clearUniform(
        fallStill ? clearRect() : undefined,
        window.innerHeight,
        scale
      )
    );
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, cloudTarget.texture);
    gl.activeTexture(gl.TEXTURE0);
    paintUniforms.set("u_cloudOn", cloudsOn ? 1 : 0);
    paintUniforms.set("u_mapOn", moonMapState === "ready" ? 1 : 0);
    paintUniforms.set("u_moonFace", moonLayer ? 0 : 1);
    fly(skyMs);
    drawInk(now, firmInk || (mode === "story" && !rafId));
    firmInk = false;
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (data.moon[3] > 0) drawMoonLayer(data, cloudFrame, cloudsOn);
    else hideMoonLayer();
  };

  const atRest = (): void => {
    restTimer = undefined;
    if (mode === "story") queueTable();
  };

  const applyStory = (chapter = storyChapter()): void => {
    storyStale = false;
    weatherTarget = storyWeather(chapter);
    snapWeather();
    const blended = grid.at(chapter);
    if (blended) {
      table = blended;
      uploadTable(blended);
    } else if (tableKind === "story") queueTable(true);
    refreshHome();
    drawn = scene;
    sceneVersion += 1;
    if (restTimer !== undefined) globalThis.clearTimeout(restTimer);
    restTimer = globalThis.setTimeout(atRest, scrollQuietMs);
  };

  const frame = (now: number, dt = frameDt): void => {
    const current = currentLevel();
    if (!current) return;
    if (probing) readInk();
    if (goalWait) askGoal(now);
    const skyMs = clock.tick(now);
    if (!table && !tableTried) queueTable();
    if (now >= holdUntil && (weatherEasing || timeLag !== 0)) {
      if (weatherEasing) weatherEasing = easeWeather(dt);
      const timeMoving = timeLag !== 0 && easeTime(dt);
      refreshScene();
      if (!weatherEasing && !timeMoving) queueTable();
    }
    if (mode === "home" && now - sceneAt >= sunEveryMs) {
      refreshScene();
      queueTable();
    }
    if (storyStale && mode === "story") applyStory();
    const data = frameScene(now);
    if (rafId) {
      const step = Math.min(dt, 100);
      gust.energy *= Math.exp(-step / 1000 / (gustEaseSeconds / 3));
      const energy = Math.min(gust.energy, 1);
      const boost = (gustMax - 1) * energy * energy * (3 - 2 * energy);
      if (gust.energy > gustActive) markActive();
      const base = data?.drift ?? 0;
      windPos =
        (windPos + ((base + boost * Math.abs(base) * gust.dir) * step) / 1000) %
        timeWrap;
    }
    bindGeometry();
    if (data && data !== drawn) {
      drawn = data;
      sceneVersion += 1;
      cloudsDirty = true;
    }
    if (data && !tableWait && paintReady())
      drawPaint(now, skyMs, current, data);
    else hideMoonLayer();
    if (
      tween &&
      held === undefined &&
      tween.swapped &&
      tween.startAt !== undefined &&
      now - tween.startAt >= tweenMs
    )
      finish();
  };

  const drawStill = (): void => {
    clock.pause();
    frame(performance.now());
  };

  const calmClouds = (): void => {
    gust.energy = 0;
    gust.inside = false;
  };

  const stop = (): void => {
    if (rafId) globalThis.cancelAnimationFrame(rafId);
    rafId = 0;
    pacer.reset();
    clock.pause();
  };
  const freeze = (now: number): void => {
    frozen = true;
    if (tween) {
      finish();
      return;
    }
    stop();
    frame(now);
    setState("static");
  };
  const loop = (now: number): void => {
    rafId = globalThis.requestAnimationFrame(loop);
    const next = pacer.step(now);
    if (next.kind === "freeze") freeze(now);
    else if (next.kind === "draw") frame(now, next.dt);
  };

  const sync = (): void => {
    stop();
    if (tween) {
      rafId = globalThis.requestAnimationFrame(loop);
      setState("running");
      return;
    }
    if (still || calm || reduceMotion.matches) {
      frame(performance.now());
      setState("static");
      return;
    }
    if (holding && mode !== "story") {
      calmClouds();
      setState("paused");
      return;
    }
    if (document.hidden || isSceneHeld()) {
      calmClouds();
      if (!document.hidden) drawStill();
      setState("paused");
      return;
    }
    if (frozen) {
      frame(performance.now());
      setState("static");
      return;
    }
    rafId = globalThis.requestAnimationFrame(loop);
    setState("running");
  };

  const canGlide = (): boolean =>
    paintReady() &&
    !still &&
    !calm &&
    !frozen &&
    !reduceMotion.matches &&
    !isSceneHeld() &&
    !document.hidden;

  const onRouteLeave = (
    event: DocumentEventMap["astro:before-preparation"]
  ): void => {
    finish();
    const next = linkMode(event.to.pathname);
    if (next === "story" && mode !== "story") setStoryChapter(0);
    if (
      next === undefined ||
      next === mode ||
      (paintsSky(next) && paintsSky(mode)) ||
      !canGlide()
    )
      return;
    const morph =
      storyMorph(globalThis.location.pathname, event.to.pathname) !== undefined;
    const [shift, fade] = liveDrift();
    clearArrive();
    const started: Tween = {
      clickAt: performance.now(),
      fade,
      forward: next === "blog",
      morph,
      shift,
      startAt: undefined,
      sun: undefined,
      swapped: false,
      to: next,
    };
    tween = started;
    if (next === "story") enterStory();
    else if (!started.forward) {
      weatherTarget = weatherGoal(true, weatherFixed(), weatherReported);
      snapWeather();
    }
    started.sun = sunSpot(instant(), viewFor(screenView()), skyPlace());
    if (!started.forward) refreshHome();
    if (drift) {
      drift.style.setProperty("--sky-shift", `${shift.toFixed(1)}px`);
      drift.style.setProperty("--sky-fade-now", fade.toFixed(3));
      drift.style.setProperty("--sky-paint", started.forward ? "1" : "0");
    }
    markHome();
    if (!morph) root.dataset["skyLeave"] = "";
    sync();
    event.signal.addEventListener(
      "abort",
      () => {
        if (tween === started) finish();
      },
      { once: true }
    );
    if (morph) return;
    const load = event.loader;
    event.loader = async (): Promise<void> => {
      await Promise.all([
        load(),
        new Promise((done) => globalThis.setTimeout(done, leaveMs)),
      ]);
    };
  };

  const snapStoryWeather = (): void => {
    weatherTarget = storyWeather(storyChapter());
    snapWeather();
  };

  const enterStory = (): void => {
    stillStep = -1;
    snapStoryWeather();
    timeLag = 0;
    buildStoryTable();
  };

  const onRouteSwap = (): void => {
    const next = pageMode();
    const left = mode;
    if (next !== mode) {
      mode = next;
      retarget();
    }
    const active = tween;
    if (mode === "story") {
      if (tableKind === "story") snapStoryWeather();
      else enterStory();
      firmInk = true;
      refreshScene();
      keepGrid();
    } else {
      if (mode === "home") switchTableTo("home");
      const goal = goalWeather();
      if (goal !== weatherTarget) {
        weatherTarget = goal;
        weatherEasing = true;
      }
      if (!rafId) snapWeather();
      if (mode === "home") {
        if (!active?.forward) refreshScene();
        queueTable();
        if (!weatherReported && Date.now() - weatherAt >= weatherStaleMs)
          void refreshWeather();
      } else refreshScene();
    }
    if (!active) {
      if (scriptDrift) placeDrift();
      if ((left === "story") !== (mode === "story")) sync();
      if (!rafId) drawStill();
      return;
    }
    active.swapped = true;
    if (!active.forward)
      active.sun = sunSpot(instant(), viewFor(screenView()), skyPlace());
    if (active.morph) return;
    delete root.dataset["skyLeave"];
    const delay = arriveDelay(performance.now() - active.clickAt);
    root.style.setProperty("--sky-arrive-delay", `${String(delay)}ms`);
    root.dataset["skyArrive"] = "";
    arriveTimer = globalThis.setTimeout(clearArrive, delay + arriveMs + 100);
  };

  const onStill = (): void => {
    if (tween && (reduceMotion.matches || isSceneHeld())) finish();
  };

  const stirClouds = (
    clientX: number,
    clientY: number,
    share: number
  ): void => {
    if (
      !rafId ||
      !currentLevel()?.clouds ||
      (!tween && mode === "home" && paintReady())
    )
      return;
    const view = viewCss();
    const x = clientX / view;
    const y = (window.innerHeight - clientY) / view;
    const inside = y < cloudZone * (window.innerHeight / view);
    if (inside && gust.inside) {
      const dx = x - gust.x;
      if (gust.energy < gustActive) gust.dir = -1;
      gust.energy = Math.min(
        1,
        gust.energy + Math.hypot(dx, (y - gust.y) * share) * gustGain
      );
      if (Math.abs(dx) > 0.002)
        gust.dir += (Math.sign(dx) - gust.dir) * Math.min(1, Math.abs(dx) * 12);
    }
    gust.inside = inside;
    gust.x = x;
    gust.y = y;
  };

  const onPointer = (event: PointerEvent): void => {
    markActive();
    if (reduceMotion.matches || isSceneHeld()) return;
    if (event.pointerType !== "touch")
      stirClouds(event.clientX, event.clientY, 1);
  };
  const applyResize = (): void => {
    resizeTimer = undefined;
    markActive();
    resize();
    refreshScene();
    queueTable();
    probedAt = -Infinity;
    if (!rafId) drawStill();
  };
  const onResize = (): void => {
    if (resizeTimer !== undefined) globalThis.clearTimeout(resizeTimer);
    resizeTimer = globalThis.setTimeout(applyResize, resizeDelayMs);
  };
  const onLeave = (event: PointerEvent): void => {
    if (event.relatedTarget !== null) return;
    gust.inside = false;
  };
  const onTouch = (event: TouchEvent): void => {
    const touch = event.touches[0];
    if (!touch || reduceMotion.matches || isSceneHeld()) return;
    stirClouds(touch.clientX, touch.clientY, touchScrollShare);
  };
  const onLift = (): void => {
    gust.inside = false;
  };
  const placeDrift = (): void => {
    driftFrame = 0;
    if (!drift) return;
    const home = paintsNow();
    const moving =
      !calm &&
      !home &&
      !reduceMotion.matches &&
      !root.hasAttribute(motionPausedAttribute);
    const travel = moving
      ? Math.min(window.scrollY, window.innerHeight) * driftShare
      : 0;
    const head = Math.min(
      fadeHeadPx[1],
      Math.max(fadeHeadPx[0], window.innerHeight * fadeHeadShare)
    );
    drift.style.translate = `0 ${String(-Math.round(travel))}px`;
    drift.style.setProperty(
      "--sky-fade",
      home ? "0" : Math.min(1, window.scrollY / head).toFixed(3)
    );
  };
  const onScroll = (): void => {
    scrolledAt = performance.now();
    if (scriptDrift && !driftFrame)
      driftFrame = globalThis.requestAnimationFrame(placeDrift);
    if (!rafId && (!holding || mode === "story")) wakeProbe(scrollQuietMs);
  };
  const onShift = (event: TransitionEvent): void => {
    if (
      !rafId &&
      event.target instanceof Element &&
      event.target.id === "main-content"
    )
      drawStill();
  };
  const onHold = (entries: IntersectionObserverEntry[]): void => {
    const entry = entries.at(-1);
    if (entry === undefined) return;
    const deep = !entry.isIntersecting;
    if (deep === holding) return;
    holding = deep;
    if (mode !== "story") sync();
  };
  const onBlur = (): void => {
    if (tween) return;
    stop();
    setState("paused");
  };
  const onDriftChange = (): void => {
    if (scriptDrift) placeDrift();
  };

  const onVisible = (): void => {
    if (!document.hidden && Date.now() - weatherAt >= weatherStaleMs)
      void refreshWeather();
  };

  const onPlace = (event: Event): void => {
    const detail: unknown = Reflect.get(event, "detail");
    if (!isPlace(detail)) return;
    place = detail;
    weatherAt = -Infinity;
    weatherReported = undefined;
    setLiveWeather(undefined);
    if (skyKind() === "story") return;
    weatherTarget = goalWeather();
    weatherEaseMs = weatherEaseSeconds * 1000;
    weatherEasing = true;
    if (!rafId) snapWeather();
    refreshScene();
    queueTable();
    if (!rafId) drawStill();
    void refreshWeather();
  };

  const applyPreview = (now: number): void => {
    previewFrame = 0;
    if (mode !== "home") return;
    const fixed = weatherFixed();
    const next = goalWeather();
    if (next !== weatherTarget) {
      weatherTarget = next;
      weatherEaseMs = previewMotion.skyMs;
      weatherEasing = true;
    }
    timeLag = rafId && shownAt !== undefined ? shownAt - goalInstant() : 0;
    if (now - previewAt > previewMotion.inkLeadMs)
      holdUntil = now + previewMotion.inkLeadMs;
    previewAt = now;
    quietUntil =
      now + previewMotion.inkLeadMs + previewMotion.skyMs + probeSlackMs;
    markActive();
    if (!rafId) snapWeather();
    askGoal(now);
    refreshScene();
    queueTable();
    if (!rafId) drawStill();
    if (!fixed && !weatherReported && Date.now() - weatherAt >= weatherStaleMs)
      void refreshWeather();
  };

  const onPreview = (): void => {
    if (!previewFrame)
      previewFrame = globalThis.requestAnimationFrame(applyPreview);
  };

  const onStory = (): void => {
    if (mode !== "story") return;
    const step = still || calm ? Math.round(storyChapter()) : undefined;
    if (step !== undefined && step === stillStep) return;
    stillStep = step ?? -1;
    markActive();
    storyStale = true;
    if (rafId) return;
    applyStory(step);
    if (!tween) drawStill();
  };

  const begin = (): void => {
    frame(performance.now());
    firstFramed = true;
    queueMoonMap();
    sync();
    void refreshWeather();
  };

  uploadTable();
  resize();
  retarget();
  refreshScene();
  sizeClouds(1, 1);
  launch(0);
  queueTable();
  if (tableWait) afterTable = begin;
  else begin();
  document.addEventListener("visibilitychange", onVisible);
  globalThis.addEventListener(placeEvent, onPlace);
  globalThis.addEventListener(previewEvent, onPreview);
  document.addEventListener(storyEvent, onStory);

  const sizeWatch = new ResizeObserver(onResize);
  sizeWatch.observe(canvas);
  const holdWatch = new IntersectionObserver(onHold);
  const sentinel = document.querySelector("[data-sky-sentinel]");
  if (sentinel) holdWatch.observe(sentinel);
  if (scriptDrift) {
    placeDrift();
    globalThis.addEventListener(sceneHoldEvent, onDriftChange);
    reduceMotion.addEventListener("change", onDriftChange);
  }
  document.addEventListener("astro:before-preparation", onRouteLeave);
  document.addEventListener("astro:after-swap", onRouteSwap);
  document.addEventListener("transitionend", onShift);
  window.addEventListener("resize", onResize);
  window.addEventListener("scroll", onScroll, { passive: true });
  globalThis.addEventListener("pointermove", onPointer, { passive: true });
  globalThis.addEventListener("pointerout", onLeave, { passive: true });
  globalThis.addEventListener("pointerup", onLift, { passive: true });
  globalThis.addEventListener("touchmove", onTouch, { passive: true });
  globalThis.addEventListener("touchend", onLift, { passive: true });
  globalThis.addEventListener("touchcancel", onLift, { passive: true });
  window.addEventListener("blur", onBlur);
  window.addEventListener("focus", sync);
  globalThis.addEventListener(sceneHoldEvent, sync);
  globalThis.addEventListener(sceneHoldEvent, onStill);
  document.addEventListener("visibilitychange", sync);
  reduceMotion.addEventListener("change", sync);
  reduceMotion.addEventListener("change", onStill);
  return () => {
    stop();
    tween = undefined;
    cancelTable?.();
    afterTable = undefined;
    disposed = true;
    cancelMoonMap?.();
    moonLayer?.dispose();
    gl.deleteTexture(moonTexture);
    gl.deleteTexture(lutTexture);
    document.removeEventListener("visibilitychange", onVisible);
    globalThis.removeEventListener(placeEvent, onPlace);
    globalThis.removeEventListener(previewEvent, onPreview);
    document.removeEventListener(storyEvent, onStory);
    cancelGrid?.();
    if (restTimer !== undefined) globalThis.clearTimeout(restTimer);
    if (previewFrame) globalThis.cancelAnimationFrame(previewFrame);
    if (drift) delete drift.dataset["skyHome"];
    gl.deleteFramebuffer(cloudTarget.buffer);
    gl.deleteTexture(cloudTarget.texture);
    delete root.dataset["skyLeave"];
    clearArrive();
    unpin();
    document.removeEventListener("astro:before-preparation", onRouteLeave);
    document.removeEventListener("astro:after-swap", onRouteSwap);
    document.removeEventListener("transitionend", onShift);
    if (resizeTimer !== undefined) globalThis.clearTimeout(resizeTimer);
    if (probeTimer !== undefined) globalThis.clearTimeout(probeTimer);
    if (readTimer !== undefined) globalThis.clearTimeout(readTimer);
    sizeWatch.disconnect();
    holdWatch.disconnect();
    if (driftFrame) globalThis.cancelAnimationFrame(driftFrame);
    globalThis.removeEventListener(sceneHoldEvent, onDriftChange);
    reduceMotion.removeEventListener("change", onDriftChange);
    probe?.dispose();
    gl.deleteBuffer(triangle);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("scroll", onScroll);
    globalThis.removeEventListener("pointermove", onPointer);
    globalThis.removeEventListener("pointerout", onLeave);
    globalThis.removeEventListener("pointerup", onLift);
    globalThis.removeEventListener("touchmove", onTouch);
    globalThis.removeEventListener("touchend", onLift);
    globalThis.removeEventListener("touchcancel", onLift);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("focus", sync);
    globalThis.removeEventListener(sceneHoldEvent, sync);
    globalThis.removeEventListener(sceneHoldEvent, onStill);
    document.removeEventListener("visibilitychange", sync);
    reduceMotion.removeEventListener("change", sync);
    reduceMotion.removeEventListener("change", onStill);
  };
};

const mountSky = (canvas: HTMLCanvasElement): (() => void) => {
  const reduceMotion = globalThis.matchMedia(reducedMotionQuery);
  const setState = (state: SpaceState): void => {
    canvas.dataset["spaceState"] = state;
  };
  const fallback = (): void => {
    canvas.hidden = true;
    setState("fallback");
  };
  const gl = canvas.getContext("webgl", contextOptions);
  const still = gl ? isSoftwareRenderer(gl) : false;
  const vertex = gl
    ? compileShader(gl, gl.VERTEX_SHADER, skyVertexShader)
    : null;
  const cloud = gl?.createProgram();
  const paint = gl?.createProgram();
  if (!gl || !vertex || !cloud || !paint) {
    fallback();
    return () => undefined;
  }
  const programs: Programs = { cloud, paint };
  const ready: Ready = { cloud: false, paint: false };
  const fragments: Partial<Record<ProgramName, WebGLShader>> = {};
  const cancels: Array<() => void> = [];
  let stopSky: (() => void) | undefined;
  let disposed = false;

  const build = (name: ProgramName): boolean => {
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, sources[name]);
    if (!fragment) return false;
    fragments[name] = fragment;
    linkProgram(gl, programs[name], [vertex, fragment], "a_pos");
    return true;
  };
  const settle = (names: ProgramName[], done: () => void): void => {
    let waiting = names.length;
    for (const name of names) {
      const finished = (linked: boolean): void => {
        ready[name] = linked;
        waiting -= 1;
        if (waiting === 0 && !disposed) done();
      };
      if (build(name)) cancels.push(whenLinked(gl, programs[name], finished));
      else finished(false);
    }
  };
  const begin = (): void => {
    if (!(ready.paint && ready.cloud)) {
      fallback();
      return;
    }
    stopSky = startSky(
      gl,
      programs,
      ready,
      canvas,
      reduceMotion,
      still,
      setState
    );
  };
  settle(["paint", "cloud"], begin);
  return () => {
    disposed = true;
    for (const cancel of cancels) cancel();
    stopSky?.();
    for (const name of ["cloud", "paint"] as const) {
      const fragment = fragments[name];
      releaseProgram(gl, programs[name], fragment ? [fragment] : []);
    }
    gl.deleteShader(vertex);
    releaseWhenDetached(gl, canvas);
  };
};

const mounted = new Map<HTMLCanvasElement, () => void>();

const syncSky = (): void => {
  for (const [canvas, stop] of mounted) {
    if (canvas.isConnected) continue;
    stop();
    mounted.delete(canvas);
  }
  const canvas =
    document.querySelector<HTMLCanvasElement>("canvas[data-space]");
  if (canvas && !mounted.has(canvas)) mounted.set(canvas, mountSky(canvas));
};

export const watchSky = (): void => {
  syncSky();
  document.addEventListener("astro:page-load", syncSky);
};
