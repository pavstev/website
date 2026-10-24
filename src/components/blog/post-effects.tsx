import { type ReactElement, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

import { watchBlurUp } from "@/components/ui/blur-up-image";
import { CopyButton } from "@/components/ui/copy-button";
import { Lightbox } from "@/components/ui/lightbox";
import {
  type SortableColumn,
  SortableTable,
} from "@/components/ui/sortable-table";
import { type SortState } from "@/lib/blog/sort-rows";
import { en } from "@/lib/i18n";

interface TableCell {
  text: string;
  value: number | string;
}

interface TableRow {
  cells: TableCell[];
  id: string;
}

interface TableTarget {
  caption: string;
  columns: Array<SortableColumn<TableRow>>;
  host: HTMLElement;
  restore: () => void;
  rows: TableRow[];
}

interface ZoomTarget {
  alt: string;
  caption: string;
  height: number;
  origin: HTMLElement;
  src: string;
  width: number;
}

const wideQuery = "(min-width: 48em)";
const activationKeys = new Set([" ", "Enter"]);

const zoomLabel = (alt: string): string =>
  en.blog.zoomImage.replace("{alt}", () => alt);

const wireZoom = (
  trigger: HTMLElement,
  media: MediaQueryList,
  open: (target: ZoomTarget) => void
): (() => void) => {
  const image = trigger.querySelector<HTMLImageElement>(":scope picture img");
  if (image === null) return () => undefined;
  const { alt } = image;
  const activate = (): void => {
    if (!media.matches) return;
    const caption = trigger.closest("figure")?.querySelector("figcaption");
    open({
      alt,
      caption: caption?.textContent ?? alt,
      height: Number(image.getAttribute("height")),
      origin:
        trigger.querySelector<HTMLElement>(":scope [data-blur-up]") ?? trigger,
      src: image.getAttribute("src") ?? "",
      width: Number(image.getAttribute("width")),
    });
  };
  const onKey = (event: KeyboardEvent): void => {
    if (!media.matches || !activationKeys.has(event.key)) return;
    event.preventDefault();
    activate();
  };
  const apply = (): void => {
    if (media.matches) {
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-label", zoomLabel(alt));
      trigger.setAttribute("role", "button");
      trigger.tabIndex = 0;
    } else {
      trigger.removeAttribute("aria-haspopup");
      trigger.removeAttribute("aria-label");
      trigger.removeAttribute("role");
      trigger.removeAttribute("tabindex");
    }
  };
  apply();
  media.addEventListener("change", apply);
  trigger.addEventListener("click", activate);
  trigger.addEventListener("keydown", onKey);
  return () => {
    media.removeEventListener("change", apply);
    trigger.removeEventListener("click", activate);
    trigger.removeEventListener("keydown", onKey);
  };
};

const cellOf = (cell: Element): TableCell => {
  const text = cell.textContent ?? "";
  const value = cell instanceof HTMLElement ? cell.dataset["value"] : undefined;
  return { text, value: value === undefined ? text : Number(value) };
};

const readChartTable = (container: HTMLElement): null | TableTarget => {
  const table = container.querySelector<HTMLTableElement>(":scope > table");
  if (table === null) return null;
  const headers = [...table.querySelectorAll(":scope > thead th")].map(
    (head) => head.textContent ?? ""
  );
  const rows = [...table.querySelectorAll(":scope > tbody > tr")].map((row) => {
    const cells = [...row.children].map((cell) => cellOf(cell));
    return { cells, id: cells[0]?.text ?? "" };
  });
  const host = document.createElement("div");
  container.append(host);
  table.hidden = true;
  return {
    caption: table.querySelector(":scope > caption")?.textContent ?? "",
    columns: headers.map((header, index) => ({
      header,
      id: String(index),
      numeric: index > 0,
      text: (row: TableRow) => row.cells[index]?.text ?? "",
      value: (row: TableRow) => row.cells[index]?.value,
    })),
    host,
    restore: () => {
      host.remove();
      table.hidden = false;
    },
    rows,
  };
};

const describeSort = (
  sort: null | SortState,
  header: string,
  count: number
): string => {
  if (sort === null) {
    return en.blog.tableOriginal.replace("{n}", () => String(count));
  }
  const direction =
    sort.direction === "ascending"
      ? en.blog.tableAscending
      : en.blog.tableDescending;
  return en.blog.tableSorted
    .replace("{column}", () => header)
    .replace("{direction}", () => direction)
    .replace("{n}", () => String(count));
};

const rowId = (row: TableRow): string => row.id;

const zoomStatus = (zoom: number): string =>
  en.blog.lightboxZoom.replace("{n}", () => zoom.toFixed(1));

const mountTables = (): (() => void) => {
  const done: Array<() => void> = [];
  for (const container of document.querySelectorAll<HTMLElement>(
    ".prose-blog [data-sortable-table]"
  )) {
    const target = readChartTable(container);
    if (target === null) continue;
    const root = createRoot(target.host);
    root.render(
      <SortableTable
        caption={target.caption}
        columns={target.columns}
        describe={describeSort}
        getRowId={rowId}
        rows={target.rows}
      />
    );
    done.push(() => {
      queueMicrotask(() => {
        root.unmount();
      });
      target.restore();
    });
  }
  return () => {
    for (const stop of done) stop();
  };
};

const mountCopyButtons = (): (() => void) => {
  const roots: Root[] = [];
  for (const host of document.querySelectorAll<HTMLElement>(
    ".prose-blog [data-code-copy]"
  )) {
    const pre = host.closest(".code-block")?.querySelector("pre");
    if (pre === null || pre === undefined) continue;
    const root = createRoot(host);
    root.render(
      <CopyButton
        ariaLabel={en.blog.codeCopyLabel}
        copiedLabel={en.blog.codeCopied}
        errorLabel={en.blog.codeCopyFailed}
        getValue={() => (pre.textContent ?? "").trimEnd()}
        label={en.blog.codeCopy}
      />
    );
    roots.push(root);
  }
  return () => {
    for (const root of roots) {
      queueMicrotask(() => {
        root.unmount();
      });
    }
  };
};

export const PostEffects = (): null | ReactElement => {
  const [zoom, setZoom] = useState<null | ZoomTarget>(null);
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    const media = globalThis.matchMedia(wideQuery);
    const undo = [
      ...document.querySelectorAll<HTMLElement>(".prose-blog [data-blur-up]"),
    ].map((wrapper) => watchBlurUp(wrapper));
    for (const trigger of document.querySelectorAll<HTMLElement>(
      ".prose-blog .image-zoom"
    )) {
      undo.push(
        wireZoom(trigger, media, (target) => {
          setZoom(target);
          setZoomOpen(true);
        })
      );
    }
    undo.push(mountTables(), mountCopyButtons());
    return (): void => {
      for (const stop of undo) stop();
    };
  }, []);

  if (zoom === null) return null;
  return (
    <Lightbox
      alt={zoom.alt}
      caption={zoom.caption}
      closeLabel={en.blog.lightboxClose}
      height={zoom.height}
      hint={en.blog.lightboxHint}
      onClose={() => {
        setZoomOpen(false);
      }}
      onExited={() => {
        setZoom(null);
      }}
      open={zoomOpen}
      origin={zoom.origin}
      src={zoom.src}
      width={zoom.width}
      zoomInLabel={en.blog.lightboxZoomIn}
      zoomOutLabel={en.blog.lightboxZoomOut}
      zoomStatus={zoomStatus}
    />
  );
};
