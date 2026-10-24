import { type ReactElement, useEffect, useId, useRef, useState } from "react";

import landUrl from "@/assets/land-map.webp?url";
import { Icon } from "@/components/icon";
import { type LatLon, roundPlace, sameSpot } from "@/lib/geo";
import { en } from "@/lib/i18n";
import { clamp } from "@/lib/math";
import { stillQuery } from "@/lib/motion-pause";
import { placeSource } from "@/lib/place-source";
import {
  blendMotion,
  clampLatitude,
  clampZoom,
  dragCenter,
  keyMove,
  keyZoom,
  maxZoom,
  minZoom,
  type Motion,
  pointUnder,
  shortestTurn,
  stepInertia,
  subsolarPoint,
  wheelZoom,
  wrapLongitude,
} from "@/lib/sky-globe";
import { createGlobeScene, type GlobeScene } from "@/lib/sky-globe-scene";
import { plainKey } from "@/lib/sky-range";

export interface SkyGlobeProps {
  label: string;
  onMove?: (spot: LatLon) => void;
  onPick: (spot: LatLon) => void;
  spot: LatLon;
}

interface Control {
  follow: (spot: LatLon) => void;
  zoomBy: (factor: number) => void;
}

interface Drag {
  id: number;
  lastT: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  startT: number;
  startX: number;
  startY: number;
}

type Status = "loading" | "ready" | "unavailable";

interface Turn {
  delta: Motion;
  duration: number;
  from: LatLon;
  pick: boolean;
  start: number;
}

const buttonZoom = 1.6;
const keyPickMs = 400;
const tapMaxMs = 500;
const tapSlopPx = 6;
const restMs = 90;
const zoomEaseMs = 90;
const noMotion: Motion = { lat: 0, lon: 0 };

const distance = (
  a: { x: number; y: number },
  b: { x: number; y: number }
): number => Math.hypot(a.x - b.x, a.y - b.y);

export const SkyGlobe = ({
  label,
  onMove,
  onPick,
  spot,
}: SkyGlobeProps): ReactElement => {
  const [status, setStatus] = useState<Status>("loading");
  const [limits, setLimits] = useState({ atMax: false, atMin: true });
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const control = useRef<Control>(undefined);
  const handlers = useRef({ onMove, onPick });
  const first = useRef(spot);
  const hintId = useId();
  const { lat, lon } = spot;

  useEffect(() => {
    handlers.current = { onMove, onPick };
  }, [onMove, onPick]);

  useEffect(() => {
    const frame = box.current;
    const host = stage.current;
    if (!frame || !host) return;
    const canvas = document.createElement("canvas");
    canvas.className = "sky-globe-canvas";
    const fail = (): void => {
      setStatus("unavailable");
    };
    let scene: GlobeScene;
    try {
      scene = createGlobeScene(canvas, subsolarPoint(Date.now()));
    } catch {
      fail();
      return;
    }
    host.append(canvas);

    const still = stillQuery();
    const pointers = new Map<number, { x: number; y: number }>();
    let alive = true;
    let center: LatLon = {
      lat: clampLatitude(first.current.lat),
      lon: wrapLongitude(first.current.lon),
    };
    let zoom = 1;
    let zoomTarget = 1;
    let motion: Motion = noMotion;
    let inertia = false;
    let turn: Turn | undefined;
    let drag: Drag | undefined;
    let pinch: undefined | { distance: number; zoom: number };
    let raf = 0;
    let last = 0;
    let pickTimer: ReturnType<typeof setTimeout> | undefined;
    let moved = roundPlace(center);
    let limitsShown = { atMax: false, atMin: true };

    const firePick = (): void => {
      handlers.current.onPick(roundPlace(center));
    };

    const showLimits = (): void => {
      const next = {
        atMax: zoomTarget >= maxZoom - 0.001,
        atMin: zoomTarget <= minZoom + 0.001,
      };
      if (
        next.atMax === limitsShown.atMax &&
        next.atMin === limitsShown.atMin
      ) {
        return;
      }
      limitsShown = next;
      setLimits(next);
    };

    const render = (): void => {
      scene.draw({ lat: center.lat, lon: center.lon, zoom });
      const rounded = roundPlace(center);
      if (!sameSpot(rounded, moved)) {
        moved = rounded;
        handlers.current.onMove?.(rounded);
      }
      showLimits();
    };

    const schedule = (): void => {
      if (alive && raf === 0) raf = requestAnimationFrame(tick);
    };

    const tick = (now: number): void => {
      raf = 0;
      const dt = last > 0 ? Math.min(now - last, 50) : 16;
      last = now;
      let busy = false;
      if (turn) {
        if (turn.start < 0) turn.start = now;
        const p = clamp((now - turn.start) / turn.duration, 0, 1);
        const eased = 1 - (1 - p) ** 3;
        center = {
          lat: turn.from.lat + turn.delta.lat * eased,
          lon: wrapLongitude(turn.from.lon + turn.delta.lon * eased),
        };
        if (p >= 1) {
          const done = turn;
          turn = undefined;
          if (done.pick) firePick();
        } else {
          busy = true;
        }
      }
      if (inertia) {
        const step = stepInertia(motion, dt);
        const rawLat = center.lat + step.move.lat;
        const nextLat = clampLatitude(rawLat);
        center = {
          lat: nextLat,
          lon: wrapLongitude(center.lon + step.move.lon),
        };
        motion = {
          lat: nextLat === rawLat ? step.motion.lat : 0,
          lon: step.motion.lon,
        };
        if (step.done) {
          inertia = false;
          motion = noMotion;
          firePick();
        } else {
          busy = true;
        }
      }
      if (zoom !== zoomTarget) {
        zoom += (zoomTarget - zoom) * (1 - Math.exp(-dt / zoomEaseMs));
        if (Math.abs(zoomTarget - zoom) < 0.004) zoom = zoomTarget;
        else busy = true;
      }
      render();
      if (busy) schedule();
      else last = 0;
    };

    const stopMotion = (): void => {
      inertia = false;
      motion = noMotion;
      turn = undefined;
      clearTimeout(pickTimer);
    };

    const setZoom = (target: number): void => {
      zoomTarget = clampZoom(target);
      if (still.matches) zoom = zoomTarget;
      schedule();
    };

    const turnTo = (target: LatLon, pick: boolean): void => {
      stopMotion();
      const goal = {
        lat: clampLatitude(target.lat),
        lon: wrapLongitude(target.lon),
      };
      const delta = shortestTurn(center, goal);
      const span = Math.hypot(delta.lat, delta.lon);
      if (span < 0.02 || still.matches) {
        center = goal;
        schedule();
        if (pick) firePick();
        return;
      }
      turn = {
        delta,
        duration: clamp(320 + span * 7, 320, 900),
        from: center,
        pick,
        start: -1,
      };
      schedule();
    };

    const follow = (target: LatLon): void => {
      if (pointers.size > 0 || sameSpot(roundPlace(center), roundPlace(target)))
        return;
      turnTo(target, false);
    };

    const zoomBy = (factor: number): void => {
      setZoom(zoomTarget * factor);
    };

    control.current = { follow, zoomBy };

    const pointerOf = (event: PointerEvent): { x: number; y: number } => ({
      x: event.clientX,
      y: event.clientY,
    });

    const startDrag = (
      id: number,
      x: number,
      y: number,
      t: number,
      isMoved: boolean
    ): void => {
      drag = {
        id,
        lastT: t,
        lastX: x,
        lastY: y,
        moved: isMoved,
        startT: t,
        startX: x,
        startY: y,
      };
      host.toggleAttribute("data-dragging", true);
    };

    const onDown = (event: PointerEvent): void => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      host.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, pointerOf(event));
      stopMotion();
      if (pointers.size === 1) {
        startDrag(
          event.pointerId,
          event.clientX,
          event.clientY,
          event.timeStamp,
          false
        );
      } else if (pointers.size === 2) {
        const [a, b] = pointers.values();
        drag = undefined;
        if (a && b) pinch = { distance: distance(a, b) || 1, zoom: zoomTarget };
      }
    };

    const onMovePointer = (event: PointerEvent): void => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, pointerOf(event));
      if (pinch && pointers.size === 2) {
        const [a, b] = pointers.values();
        if (a && b) {
          zoomTarget = clampZoom(
            pinch.zoom * (distance(a, b) / pinch.distance)
          );
          zoom = zoomTarget;
          schedule();
        }
        return;
      }
      if (drag?.id !== event.pointerId) return;
      const dx = event.clientX - drag.lastX;
      const dy = event.clientY - drag.lastY;
      if (
        !drag.moved &&
        Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >
          tapSlopPx
      ) {
        drag.moved = true;
      }
      const before = center;
      center = dragCenter(center, dx, dy, scene.radius(1), zoom);
      const dtMs = event.timeStamp - drag.lastT;
      const turned = shortestTurn(before, center);
      motion = blendMotion(motion, turned, dtMs);
      drag.lastT = event.timeStamp;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      schedule();
    };

    const tapTarget = (event: PointerEvent): LatLon | undefined => {
      const rect = host.getBoundingClientRect();
      return pointUnder(
        center,
        {
          x: event.clientX - (rect.left + rect.width / 2),
          y: rect.top + rect.height / 2 - event.clientY,
        },
        scene.radius(zoom)
      );
    };

    const onUp = (event: PointerEvent): void => {
      if (!pointers.has(event.pointerId)) return;
      pointers.delete(event.pointerId);
      if (host.hasPointerCapture(event.pointerId)) {
        host.releasePointerCapture(event.pointerId);
      }
      if (pinch) {
        if (pointers.size < 2) pinch = undefined;
        const rest = [...pointers][0];
        if (rest) {
          startDrag(rest[0], rest[1].x, rest[1].y, event.timeStamp, true);
        } else {
          drag = undefined;
          host.toggleAttribute("data-dragging", false);
        }
        return;
      }
      const finished = drag;
      if (finished?.id !== event.pointerId) return;
      drag = undefined;
      host.toggleAttribute("data-dragging", false);
      if (event.type === "pointercancel") {
        motion = noMotion;
        firePick();
        return;
      }
      if (!finished.moved && event.timeStamp - finished.startT < tapMaxMs) {
        const target = tapTarget(event);
        if (target) turnTo(target, true);
        return;
      }
      const resting = event.timeStamp - finished.lastT > restMs;
      if (resting || still.matches) {
        motion = noMotion;
        firePick();
        return;
      }
      inertia = true;
      schedule();
    };

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : 1;
      setZoom(wheelZoom(zoomTarget, event.deltaY * unit));
    };

    const onKey = (event: KeyboardEvent): void => {
      if (event.target !== frame || !plainKey(event)) return;
      const step = keyMove(event.key, event.shiftKey);
      if (step) {
        event.preventDefault();
        stopMotion();
        center = {
          lat: clampLatitude(center.lat + step.lat),
          lon: wrapLongitude(center.lon + step.lon),
        };
        schedule();
        pickTimer = setTimeout(firePick, keyPickMs);
        return;
      }
      const factor = keyZoom(event.key);
      if (factor === undefined) {
        return;
      }

      event.preventDefault();
      zoomBy(factor);
    };

    const onStill = (): void => {
      if (!still.matches) return;
      if (turn) {
        const done = turn;
        turn = undefined;
        center = {
          lat: done.from.lat + done.delta.lat,
          lon: wrapLongitude(done.from.lon + done.delta.lon),
        };
        if (done.pick) firePick();
      }
      if (inertia) {
        stopMotion();
        firePick();
      }
      zoom = zoomTarget;
      schedule();
    };

    const observer = new ResizeObserver((entries) => {
      const box0 = entries[0]?.contentRect;
      if (!box0) return;
      scene.resize(box0.width, box0.height);
      schedule();
    });

    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointermove", onMovePointer);
    host.addEventListener("pointerup", onUp);
    host.addEventListener("pointercancel", onUp);
    host.addEventListener("wheel", onWheel, { passive: false });
    frame.addEventListener("keydown", onKey);
    still.addEventListener("change", onStill);
    observer.observe(host);

    const size = host.getBoundingClientRect();
    scene.resize(size.width, size.height);
    render();

    const loadCities = async (): Promise<void> => {
      try {
        const table = await placeSource.table();
        if (alive) scene.addCities(table);
      } catch {}
    };
    const loadLand = async (): Promise<void> => {
      try {
        await scene.addLand(landUrl);
      } catch {}
    };
    const loadAll = async (): Promise<void> => {
      await Promise.all([loadCities(), loadLand()]);
      if (!alive) return;
      setStatus("ready");
      schedule();
    };
    void loadAll();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      clearTimeout(pickTimer);
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onMovePointer);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onUp);
      host.removeEventListener("wheel", onWheel);
      frame.removeEventListener("keydown", onKey);
      still.removeEventListener("change", onStill);
      observer.disconnect();
      control.current = undefined;
      scene.dispose();
      canvas.remove();
    };
  }, []);

  useEffect(() => {
    control.current?.follow({ lat, lon });
  }, [lat, lon]);

  const unavailable = status === "unavailable";

  return (
    <div className="sky-globe">
      <div
        aria-busy={status === "loading"}
        aria-describedby={unavailable ? undefined : hintId}
        aria-label={unavailable ? undefined : label}
        className="sky-globe-box focus-ring"
        data-state={status}
        ref={box}
        role={unavailable ? undefined : "application"}
        tabIndex={unavailable ? undefined : 0}
      >
        <div className="sky-globe-stage" ref={stage} />
        {unavailable ? (
          <p className="sky-globe-note" role="status">
            {en.sky.globe.unavailable}
          </p>
        ) : (
          <>
            <span aria-hidden="true" className="sky-globe-cross">
              <span className="sky-globe-ring" />
              <span className="sky-globe-tick" data-side="top" />
              <span className="sky-globe-tick" data-side="right" />
              <span className="sky-globe-tick" data-side="bottom" />
              <span className="sky-globe-tick" data-side="left" />
              <span className="sky-globe-dot" />
            </span>
            {status === "loading" && (
              <p className="sky-globe-note sky-globe-loading">
                {en.sky.globe.loading}
              </p>
            )}
            <div className="sky-globe-zoom">
              <button
                aria-disabled={limits.atMax}
                aria-label={en.sky.globe.zoomIn}
                className="sky-globe-zoom-button focus-ring"
                onClick={() => {
                  control.current?.zoomBy(buttonZoom);
                }}
                type="button"
              >
                <Icon aria-hidden name="lucide:plus" />
              </button>
              <button
                aria-disabled={limits.atMin}
                aria-label={en.sky.globe.zoomOut}
                className="sky-globe-zoom-button focus-ring"
                onClick={() => {
                  control.current?.zoomBy(1 / buttonZoom);
                }}
                type="button"
              >
                <Icon aria-hidden name="lucide:minus" />
              </button>
            </div>
          </>
        )}
      </div>
      {!unavailable && (
        <p className="sky-globe-hint" id={hintId}>
          {en.sky.globe.hint}
        </p>
      )}
    </div>
  );
};
