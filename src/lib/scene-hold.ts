export const sceneHoldEvent = "scene:hold";

const attribute = "data-scene-hold";

export const isSceneHeld = (): boolean =>
  document.documentElement.hasAttribute(attribute);

export const holdScene = (hold: boolean): void => {
  document.documentElement.toggleAttribute(attribute, hold);
  globalThis.dispatchEvent(new Event(sceneHoldEvent));
};
