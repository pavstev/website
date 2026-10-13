import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { moonRiseSet, sunPosition, sunRiseSet } from "./sky-ephemeris.ts";
import {
  arcLayout,
  type CardRect,
  type PathViewport,
  skyPath,
  viewportFocal,
} from "./sky-path.ts";

const latitude = 48.2082;
const longitude = 16.3738;
const minute = 60_000;

const desktop: PathViewport = {
  focal: viewportFocal(50),
  height: 900,
  horizon: 0.13,
  width: 1440,
};
const phone: PathViewport = {
  focal: viewportFocal(50),
  height: 844,
  horizon: 0.09,
  width: 390,
};
const textBlock: CardRect = { bottom: 541, left: 383, right: 1057, top: 196 };
const fullCard: CardRect = { bottom: 541, left: 383, right: 1057, top: 16 };
const phoneCard: CardRect = { bottom: 662, left: 12, right: 378, top: 40 };

const utc = (text: string): number => Date.parse(`${text}Z`);

const close = (actual: number, expected: number, within: number): void => {
  assert.ok(
    Math.abs(actual - expected) <= within,
    `${String(actual)} is not within ${String(within)} of ${String(expected)}`
  );
};

const sunTimes = (day: string): { rise: number; set: number } => {
  const times = sunRiseSet(utc(`${day}T00:00`), latitude, longitude);
  return { rise: times.rise ?? 0, set: times.set ?? 0 };
};

describe("skyPath sun", () => {
  const { rise, set } = sunTimes("2026-12-11");
  const arc = arcLayout(desktop, 0, textBlock);

  it("puts sunrise at the right end on the horizon", () => {
    const { sun } = skyPath(
      rise + minute,
      latitude,
      longitude,
      desktop,
      textBlock
    );
    assert.equal(sun.visible, true);
    close(sun.progress, 0, 0.01);
    close(sun.x, arc.right, 15);
    close(sun.y, arc.rim, 25);
  });

  it("puts sunset at the left end on the horizon", () => {
    const { sun } = skyPath(
      set - minute,
      latitude,
      longitude,
      desktop,
      textBlock
    );
    assert.equal(sun.visible, true);
    close(sun.progress, 1, 0.01);
    close(sun.x, arc.left, 15);
    close(sun.y, arc.rim, 25);
  });

  it("finds the true rise and set of the day", () => {
    const { sun } = skyPath((rise + set) / 2, latitude, longitude, desktop);
    close(sun.rise ?? 0, rise, minute);
    close(sun.set ?? 0, set, minute);
  });

  it("puts noon near the peak and above the card at 1440x900", () => {
    const { sun } = skyPath(
      (rise + set) / 2,
      latitude,
      longitude,
      desktop,
      textBlock
    );
    assert.equal(sun.mode, "above");
    close(sun.progress, 0.5, 0.01);
    close(sun.x, desktop.width / 2, 15);
    assert.ok(sun.y < textBlock.top - 16);
    assert.ok(sun.y > 0);
  });

  it("keeps the whole day arc clear of the card", () => {
    for (let at = rise + minute; at < set; at += 20 * minute) {
      const { sun } = skyPath(at, latitude, longitude, desktop, textBlock);
      const overCard = sun.x > textBlock.left && sun.x < textBlock.right;
      assert.ok(!overCard || sun.y < textBlock.top);
    }
  });

  it("runs under the card when the card starts at the top", () => {
    const { sun } = skyPath(
      (rise + set) / 2,
      latitude,
      longitude,
      desktop,
      fullCard
    );
    assert.equal(sun.mode, "below");
    assert.ok(
      sun.y > fullCard.bottom && sun.y < desktop.height * (1 - desktop.horizon)
    );
  });

  it("runs under the card on a phone", () => {
    const { sun } = skyPath(
      (rise + set) / 2,
      latitude,
      longitude,
      phone,
      phoneCard
    );
    assert.equal(sun.mode, "below");
    assert.ok(sun.y > phoneCard.bottom);
  });

  it("draws a higher arc in summer than in winter", () => {
    const june = sunTimes("2026-06-21");
    const summer = skyPath(
      (june.rise + june.set) / 2,
      latitude,
      longitude,
      desktop
    ).sun;
    const winter = skyPath((rise + set) / 2, latitude, longitude, desktop).sun;
    assert.ok(summer.y < winter.y);
  });

  it("gives a view direction that points at the screen point", () => {
    const { sun } = skyPath((rise + set) / 2, latitude, longitude, desktop);
    const [dx, dy, dz] = sun.direction;
    close(Math.hypot(dx, dy, dz), 1, 1e-9);
    close(
      desktop.width / 2 + (dx / dz) * desktop.focal * desktop.height,
      sun.x,
      1e-6
    );
    close(
      desktop.height * (1 - desktop.horizon) -
        (dy / dz) * desktop.focal * desktop.height,
      sun.y,
      1e-6
    );
  });

  it("is never visible below the horizon and never under the horizon line", () => {
    const start = utc("2026-06-21T00:00");
    for (let at = start; at < start + 86_400_000; at += 15 * minute) {
      const { sun } = skyPath(at, latitude, longitude, desktop, textBlock);
      const altitude = sunPosition(at, latitude, longitude).trueAltitude;
      if (altitude < -1) assert.equal(sun.visible, false);
      if (sun.visible)
        assert.ok(sun.y <= desktop.height * (1 - desktop.horizon) + 1e-9);
    }
  });
});

describe("skyPath moon", () => {
  it("follows a moon that is up across midnight", () => {
    const at = utc("2026-10-25T23:30");
    const { moon } = skyPath(at, latitude, longitude, desktop, textBlock);
    const before = moonRiseSet(utc("2026-10-25T00:00"), latitude, longitude);
    const after = moonRiseSet(utc("2026-10-26T00:00"), latitude, longitude);
    assert.equal(moon.visible, true);
    close(moon.rise ?? 0, before.rise ?? 0, 2 * minute);
    close(moon.set ?? 0, after.set ?? 0, 2 * minute);
    assert.ok(moon.progress > 0.5 && moon.progress < 0.8);
  });

  it("shows the day moon", () => {
    const { moon } = skyPath(
      utc("2026-10-18T15:00"),
      latitude,
      longitude,
      desktop,
      textBlock
    );
    assert.equal(moon.visible, true);
    assert.ok(moon.x > desktop.width / 2);
  });

  it("hides a moon that has set", () => {
    const { moon } = skyPath(
      utc("2026-10-25T10:00"),
      latitude,
      longitude,
      desktop
    );
    assert.equal(moon.visible, false);
  });
});
