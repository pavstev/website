import { useEffect } from "react";

import { en } from "@/lib/i18n";

const wideQuery = "(min-width: 48em)";
const activationKeys = new Set([" ", "Enter"]);

const watchLoaded = (image: HTMLImageElement): (() => void) => {
  const mark = (): void => {
    image.dataset["loaded"] = "";
  };
  if (image.complete && image.naturalWidth > 0) mark();
  image.addEventListener("load", mark);
  return () => {
    image.removeEventListener("load", mark);
  };
};

const zoomLabel = (alt: string): string =>
  en.blog.zoomImage.replace("{alt}", () => alt);

const wireZoom = (
  trigger: HTMLElement,
  media: MediaQueryList
): (() => void) => {
  const dialog = trigger.nextElementSibling;
  const picture = trigger.querySelector<HTMLImageElement>(":scope picture img");
  if (picture === null || !(dialog instanceof HTMLDialogElement)) {
    return () => undefined;
  }
  const alt = dialog.getAttribute("aria-label") ?? "";
  const open = (): void => {
    if (dialog.querySelector("img") === null) {
      const full = document.createElement("img");
      full.alt = alt;
      full.className = "image-zoom-full";
      full.decoding = "async";
      full.src = picture.getAttribute("src") ?? "";
      full.setAttribute("height", picture.getAttribute("height") ?? "");
      full.setAttribute("width", picture.getAttribute("width") ?? "");
      dialog.append(full);
    }
    dialog.showModal();
  };
  const onClick = (): void => {
    if (media.matches) open();
  };
  const onKey = (event: KeyboardEvent): void => {
    if (!media.matches || !activationKeys.has(event.key)) return;
    event.preventDefault();
    open();
  };
  const onDialogClick = (): void => {
    dialog.close();
  };
  const onClose = (): void => {
    trigger.focus({ preventScroll: true });
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
  trigger.addEventListener("click", onClick);
  trigger.addEventListener("keydown", onKey);
  dialog.addEventListener("click", onDialogClick);
  dialog.addEventListener("close", onClose);
  return () => {
    media.removeEventListener("change", apply);
    trigger.removeEventListener("click", onClick);
    trigger.removeEventListener("keydown", onKey);
    dialog.removeEventListener("click", onDialogClick);
    dialog.removeEventListener("close", onClose);
  };
};

export const PostEffects = (): null => {
  useEffect(() => {
    const media = globalThis.matchMedia(wideQuery);
    const undo = [
      ...document.querySelectorAll<HTMLImageElement>(
        ".prose-blog picture > img.blog-image"
      ),
    ].map((image) => watchLoaded(image));
    for (const trigger of document.querySelectorAll<HTMLElement>(
      ".prose-blog .image-zoom"
    )) {
      undo.push(wireZoom(trigger, media));
    }
    return (): void => {
      for (const stop of undo) stop();
    };
  }, []);
  return null;
};
