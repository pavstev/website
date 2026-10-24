export const sceneHoldEvent = "scene:hold";
export const motionPausedAttribute = "data-motion-paused";

export const isSceneHeld = (): boolean =>
  document.documentElement.hasAttribute(motionPausedAttribute);
