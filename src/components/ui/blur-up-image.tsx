import { type CSSProperties, type ReactElement, type ReactNode } from "react";

import { stillQuery } from "@/lib/motion-pause";

interface BlurUpImageProps {
  children: ReactNode;
  eager?: boolean;
  height: number;
  placeholder: string;
  width: number;
}

export const BlurUpImage = ({
  children,
  eager = false,
  height,
  placeholder,
  width,
}: BlurUpImageProps): ReactElement => (
  <span
    className="blur-up"
    data-blur-up={eager ? "eager" : ""}
    style={
      {
        "--ratio": `${String(width)} / ${String(height)}`,
        "--width": `${String(width)}px`,
      } as CSSProperties
    }
  >
    {placeholder !== "" && (
      <img
        alt=""
        aria-hidden="true"
        className="blur-up-placeholder"
        decoding="async"
        draggable={false}
        height={height}
        loading="lazy"
        src={placeholder}
        width={width}
      />
    )}
    {children}
  </span>
);

const setState = (
  wrapper: HTMLElement,
  state: "error" | "loading" | "ready",
  instant: boolean
): void => {
  wrapper.dataset["state"] = state;
  wrapper.setAttribute("aria-busy", state === "loading" ? "true" : "false");
  if (instant || stillQuery().matches) wrapper.dataset["instant"] = "";
  else delete wrapper.dataset["instant"];
};

export const watchBlurUp = (wrapper: HTMLElement): (() => void) => {
  const image = wrapper.querySelector<HTMLImageElement>(".blog-image");
  if (image === null) return () => undefined;
  let alive = true;
  const stop = (): void => {
    alive = false;
  };
  const cached = image.complete && image.naturalWidth > 0;
  const reveal = (): void => {
    if (alive) setState(wrapper, "ready", cached);
  };
  const fail = (): void => {
    if (alive) setState(wrapper, "error", cached);
  };
  if (image.complete) {
    if (cached) reveal();
    else fail();
    return stop;
  }
  if (wrapper.dataset["blurUp"] === "eager") return stop;
  setState(wrapper, "loading", false);
  const decode = async (): Promise<void> => {
    try {
      await image.decode();
      reveal();
    } catch {
      fail();
    }
  };
  const onLoad = (): void => {
    if (alive) void decode();
  };
  image.addEventListener("load", onLoad);
  image.addEventListener("error", fail);
  return () => {
    stop();
    image.removeEventListener("load", onLoad);
    image.removeEventListener("error", fail);
  };
};
