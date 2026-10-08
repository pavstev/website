import { reducedMotionQuery } from "./media.ts";
import { privacyAckAttribute, privacyAckKey } from "./privacy-ack.ts";
import { motionPausedAttribute, sceneHoldEvent } from "./scene-hold.ts";

export interface StillQuery {
  addEventListener: (type: "change", listener: () => void) => void;
  readonly matches: boolean;
  removeEventListener: (type: "change", listener: () => void) => void;
}

export const motionPauseKey = "motion-paused";

export const motionPauseEvent = "motion:pause";

const markRoot = (name: string): string =>
  `document.documentElement.setAttribute("${name}","")`;

const markStored = (key: string, name: string): string =>
  `if(localStorage.getItem("${key}"))${markRoot(name)}`;

export const headScript = `${markRoot("data-js")};try{${markStored(privacyAckKey, privacyAckAttribute)};${markStored(motionPauseKey, motionPausedAttribute)}}catch{}`;

const announce = (): void => {
  globalThis.dispatchEvent(new Event(sceneHoldEvent));
  globalThis.dispatchEvent(new Event(motionPauseEvent));
};

const onStorage = (event: StorageEvent): void => {
  if (event.key !== motionPauseKey) return;
  document.documentElement.toggleAttribute(
    motionPausedAttribute,
    Boolean(event.newValue)
  );
  announce();
};

export const isMotionPaused = (): boolean =>
  document.documentElement.hasAttribute(motionPausedAttribute);

export const setMotionPaused = (paused: boolean): void => {
  document.documentElement.toggleAttribute(motionPausedAttribute, paused);
  try {
    if (paused) globalThis.localStorage.setItem(motionPauseKey, "1");
    else globalThis.localStorage.removeItem(motionPauseKey);
  } catch {}
  announce();
};

export const subscribeMotionPause = (callback: () => void): (() => void) => {
  globalThis.addEventListener(motionPauseEvent, callback);
  globalThis.addEventListener("storage", onStorage);
  return () => {
    globalThis.removeEventListener(motionPauseEvent, callback);
    globalThis.removeEventListener("storage", onStorage);
  };
};

export const stillQuery = (): StillQuery => {
  const media = globalThis.matchMedia(reducedMotionQuery);
  return {
    addEventListener: (type, listener): void => {
      media.addEventListener(type, listener);
      globalThis.addEventListener(motionPauseEvent, listener);
    },
    get matches(): boolean {
      return media.matches || isMotionPaused();
    },
    removeEventListener: (type, listener): void => {
      media.removeEventListener(type, listener);
      globalThis.removeEventListener(motionPauseEvent, listener);
    },
  };
};
