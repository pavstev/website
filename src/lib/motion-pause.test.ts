import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { runInNewContext } from "node:vm";

import { reducedMotionQuery } from "./media.ts";
import {
  headScript,
  isMotionPaused,
  motionPauseEvent,
  motionPauseKey,
  setMotionPaused,
  type StillQuery,
  stillQuery,
  subscribeMotionPause,
} from "./motion-pause.ts";
import { privacyAckKey } from "./privacy-ack.ts";
import { holdScene, isSceneHeld, sceneHoldEvent } from "./scene-hold.ts";

const stubs = [
  "addEventListener",
  "dispatchEvent",
  "document",
  "localStorage",
  "matchMedia",
  "removeEventListener",
];

const blocked = (): never => {
  throw new Error("storage blocked");
};

const fakeRoot = (attributes: Set<string>): object => ({
  hasAttribute: (name: string): boolean => attributes.has(name),
  setAttribute: (name: string): void => {
    attributes.add(name);
  },
  toggleAttribute: (name: string, force: boolean): boolean => {
    if (force) attributes.add(name);
    else attributes.delete(name);
    return force;
  },
});

const install = (storageWorks = true) => {
  const attributes = new Set<string>();
  const events: string[] = [];
  const media = Object.assign(new EventTarget(), { matches: false });
  const storage = new Map<string, string>();
  const target = new EventTarget();
  for (const type of [sceneHoldEvent, motionPauseEvent])
    target.addEventListener(type, () => {
      events.push(type);
    });
  const write = (change: () => void): void => {
    if (!storageWorks) blocked();
    change();
  };
  Object.assign(globalThis, {
    addEventListener: target.addEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
    document: { documentElement: fakeRoot(attributes) },
    localStorage: {
      removeItem: (key: string): void => {
        write(() => storage.delete(key));
      },
      setItem: (key: string, value: string): void => {
        write(() => storage.set(key, value));
      },
    },
    matchMedia: (query: string): typeof media => {
      assert.equal(query, reducedMotionQuery);
      return media;
    },
    removeEventListener: target.removeEventListener.bind(target),
  });
  return { attributes, events, media, storage };
};

const storageEvent = (key: string, newValue: null | string): Event =>
  Object.assign(new Event("storage"), { key, newValue });

afterEach(() => {
  for (const name of stubs) Reflect.deleteProperty(globalThis, name);
});

describe("motion pause", () => {
  it("sets the attribute, stores the choice and announces hold then pause", () => {
    const fake = install();
    setMotionPaused(true);
    assert.deepEqual(
      [isMotionPaused(), [...fake.attributes], [...fake.storage]],
      [true, ["data-motion-paused"], [["motion-paused", "1"]]]
    );
    assert.deepEqual(fake.events, ["scene:hold", "motion:pause"]);
    setMotionPaused(false);
    assert.deepEqual(
      [isMotionPaused(), fake.storage.size, fake.events.length],
      [false, 0, 4]
    );
  });

  it("pauses for the session when storage throws", () => {
    const fake = install(false);
    setMotionPaused(true);
    assert.equal(isMotionPaused(), true);
    assert.deepEqual(fake.events, ["scene:hold", "motion:pause"]);
  });

  it("holds the scene while held or paused, so closing the globe keeps a pause", () => {
    install();
    holdScene(true);
    setMotionPaused(true);
    holdScene(false);
    assert.equal(isSceneHeld(), true);
    setMotionPaused(false);
    assert.equal(isSceneHeld(), false);
    holdScene(true);
    assert.equal(isSceneHeld(), true);
  });

  it("follows other tabs through storage events until unsubscribed", () => {
    const fake = install();
    let calls = 0;
    const unsubscribe = subscribeMotionPause(() => {
      calls += 1;
    });
    globalThis.dispatchEvent(storageEvent("privacy-ack", "1"));
    assert.equal(calls, 0);
    globalThis.dispatchEvent(storageEvent(motionPauseKey, "1"));
    assert.equal(isMotionPaused(), true);
    assert.deepEqual(fake.events, ["scene:hold", "motion:pause"]);
    globalThis.dispatchEvent(storageEvent(motionPauseKey, null));
    assert.equal(isMotionPaused(), false);
    setMotionPaused(true);
    assert.equal(calls, 3);
    unsubscribe();
    setMotionPaused(false);
    globalThis.dispatchEvent(storageEvent(motionPauseKey, "1"));
    assert.equal(calls, 3);
    assert.equal(isMotionPaused(), false);
  });

  it("stillQuery matches reduced motion or a pause and reports both changes", () => {
    const fake = install();
    const query: StillQuery = stillQuery();
    let changes = 0;
    const onChange = (): void => {
      changes += 1;
    };
    query.addEventListener("change", onChange);
    assert.equal(query.matches, false);
    setMotionPaused(true);
    assert.equal(query.matches, true);
    fake.media.matches = true;
    fake.media.dispatchEvent(new Event("change"));
    setMotionPaused(false);
    assert.equal(query.matches, true);
    fake.media.matches = false;
    assert.equal(query.matches, false);
    assert.equal(changes, 3);
    query.removeEventListener("change", onChange);
    setMotionPaused(true);
    fake.media.dispatchEvent(new Event("change"));
    assert.equal(changes, 3);
  });
});

const runHeadScript = (
  stored: ReadonlyMap<string, string>,
  storageWorks = true
): string[] => {
  const attributes = new Set<string>();
  runInNewContext(headScript, {
    document: { documentElement: fakeRoot(attributes) },
    localStorage: {
      getItem: (key: string): null | string =>
        storageWorks ? (stored.get(key) ?? null) : blocked(),
    },
  });
  return [...attributes];
};

describe("headScript", () => {
  it("marks JS, then the privacy OK and the pause found in storage", () => {
    const both = new Map([
      [motionPauseKey, "1"],
      [privacyAckKey, "1"],
    ]);
    assert.deepEqual(runHeadScript(both), [
      "data-js",
      "data-privacy-ack",
      "data-motion-paused",
    ]);
    assert.deepEqual(runHeadScript(new Map([[motionPauseKey, "1"]])), [
      "data-js",
      "data-motion-paused",
    ]);
    assert.deepEqual(runHeadScript(new Map()), ["data-js"]);
  });

  it("marks JS and does not throw when storage throws", () => {
    assert.deepEqual(runHeadScript(new Map([[motionPauseKey, "1"]]), false), [
      "data-js",
    ]);
  });
});
