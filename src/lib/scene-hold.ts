export const sceneHoldEvent = "scene:hold";
export const motionPausedAttribute = "data-motion-paused";

const attribute = "data-scene-hold";

export const isSceneHeld = (): boolean => {
  const root = document.documentElement;
  return (
    root.hasAttribute(attribute) || root.hasAttribute(motionPausedAttribute)
  );
};

export const holdScene = (hold: boolean): void => {
  document.documentElement.toggleAttribute(attribute, hold);
  globalThis.dispatchEvent(new Event(sceneHoldEvent));
};
