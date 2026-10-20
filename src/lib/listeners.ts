export interface Listeners {
  add: (dispose: () => void) => void;
  dispose: () => void;
  on: (
    target: EventTarget,
    type: string,
    listener: (event: Event) => void
  ) => void;
}

export const createListeners = (
  options?: AddEventListenerOptions
): Listeners => {
  const disposers: Array<() => void> = [];
  return {
    add: (dispose) => {
      disposers.push(dispose);
    },
    dispose: () => {
      for (const dispose of disposers) dispose();
    },
    on: (target, type, listener) => {
      target.addEventListener(type, listener, options);
      disposers.push(() => {
        target.removeEventListener(type, listener);
      });
    },
  };
};
