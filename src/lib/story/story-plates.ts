import { type Box, overlapsRect } from "./story-scroll.ts";

export interface PlateArea {
  height: number;
  top: number;
  width: number;
}

export interface PlateBoard {
  dispose(): void;
  invalidate(): void;
  place(
    index: number,
    anchor: [number, number] | undefined,
    avoid: readonly Box[],
    area: PlateArea,
    wide: boolean,
    sub?: number
  ): void;
}

export interface PlateSpot {
  left: number;
  top: number;
  width: number;
  wire: [number, number, number, number] | undefined;
}

interface Plate {
  alpha: number;
  el: HTMLDivElement;
  height: number;
  room: number;
  width: number;
}

const pad = 12;
const textGap = 24;
const wireInset = 16;
const wireGap = 10;
const maxWidth = 544;
const svgNs = "http://www.w3.org/2000/svg";

export const plateSpot = (
  anchor: [number, number],
  size: { height: number; width: number },
  avoid: Box | undefined,
  area: PlateArea,
  wide: boolean
): PlateSpot => {
  const floor =
    wide && avoid ? Math.max(pad, avoid.left + avoid.width + textGap) : pad;
  const room = Math.max(0, area.width - pad - floor);
  const width = Math.min(maxWidth, size.width, room);
  const [ax, ay] = anchor;
  const left = Math.max(
    floor,
    Math.min(ax - width / 3, area.width - pad - width)
  );
  const top = area.top + pad;
  const bottom = top + size.height;
  const wireX = Math.max(
    left + wireInset,
    Math.min(ax, left + width - wireInset)
  );
  return {
    left,
    top,
    width,
    wire: ay > bottom + wireGap ? [wireX, bottom, ax, ay] : undefined,
  };
};

const rowOf = (span: Element): HTMLDivElement => {
  const row = document.createElement("div");
  const kind = span.className.replace("story-strip-", "");
  row.className = `story-plate-${kind}`;
  row.textContent = span.textContent;
  return row;
};

const makePlate = (source: HTMLElement, box: HTMLElement): Plate => {
  const el = document.createElement("div");
  el.className = "story-plate";
  el.append(...[...source.children].map((span) => rowOf(span)));
  box.append(el);
  return { alpha: 0, el, height: 0, room: 0, width: 0 };
};

const fade = (plate: Plate, alpha: number): void => {
  if (plate.alpha === alpha) return;
  plate.alpha = alpha;
  plate.el.style.opacity = String(alpha);
};

const measure = (plate: Plate, room: number): void => {
  if (plate.room === room && plate.height > 0) return;
  plate.room = room;
  plate.el.style.maxInlineSize = `${String(room)}px`;
  plate.width = plate.el.offsetWidth;
  plate.height = plate.el.offsetHeight;
};

const makeWire = (
  box: HTMLElement
): [SVGSVGElement, SVGPathElement, SVGCircleElement] => {
  const svg = document.createElementNS(svgNs, "svg");
  svg.setAttribute("class", "story-wire");
  const path = document.createElementNS(svgNs, "path");
  const dot = document.createElementNS(svgNs, "circle");
  dot.setAttribute("r", "2.5");
  svg.append(path, dot);
  box.append(svg);
  return [svg, path, dot];
};

export const createPlates = (
  items: readonly HTMLElement[],
  box: HTMLElement
): PlateBoard => {
  const strips = items.map((item) =>
    item.querySelector<HTMLElement>(".story-strip")
  );
  const plates = items.map((item, i) => {
    const stops = [...item.querySelectorAll<HTMLElement>("[data-plate]")];
    const strip = strips[i];
    const sources = stops.length > 0 ? stops : strip ? [strip] : [];
    return sources.map((source) => makePlate(source, box));
  });
  const all = plates.flat();
  const [svg, path, dot] = makeWire(box);
  let wireAlpha = -1;
  let lastWidth = -1;
  for (const strip of strips) strip?.removeAttribute("tabindex");

  const showWire = (alpha: number): void => {
    if (wireAlpha === alpha) return;
    wireAlpha = alpha;
    svg.style.opacity = String(alpha);
  };

  const place: PlateBoard["place"] = (
    index,
    anchor,
    avoid,
    area,
    wide,
    sub = 0
  ) => {
    if (area.width !== lastWidth) {
      lastWidth = area.width;
      for (const plate of all) plate.height = 0;
    }
    const plate = plates[index]?.[sub];
    for (const other of all) if (other !== plate) fade(other, 0);
    if (!plate || !anchor) {
      if (plate) fade(plate, 0);
      showWire(0);
      return;
    }
    const natural = Math.min(maxWidth, area.width - 2 * pad);
    const spotFor = (width: number): PlateSpot =>
      plateSpot(anchor, { height: plate.height, width }, avoid[0], area, wide);
    measure(plate, spotFor(natural).width);
    const spot = spotFor(plate.width);
    plate.el.style.transform = `translate3d(${spot.left.toFixed(1)}px,${spot.top.toFixed(1)}px,0)`;
    const rect = {
      height: plate.height,
      left: spot.left,
      top: spot.top,
      width: spot.width,
    };
    const blocked =
      spot.width < 160 || avoid.some((text) => overlapsRect(rect, text, pad));
    const alpha = blocked ? 0 : 1;
    fade(plate, alpha);
    if (blocked || !spot.wire) {
      showWire(0);
      return;
    }
    const [x0, y0, x1, y1] = spot.wire;
    path.setAttribute(
      "d",
      `M${x0.toFixed(1)} ${y0.toFixed(1)}V${((y0 + y1) / 2).toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}`
    );
    dot.setAttribute("cx", x1.toFixed(1));
    dot.setAttribute("cy", y1.toFixed(1));
    showWire(alpha);
  };

  return {
    dispose: (): void => {
      for (const plate of all) plate.el.remove();
      svg.remove();
      for (const strip of strips) strip?.setAttribute("tabindex", "0");
    },
    invalidate: (): void => {
      for (const plate of all) plate.height = 0;
    },
    place,
  };
};
