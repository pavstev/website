"use client";

import {
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { Icon } from "@/components/icon";
import { cityStrings } from "@/lib/city";
import {
  createCityGlobe,
  type GlobeControls,
  SoftwareRendererError,
} from "@/lib/city-globe";
import { personalData } from "@/lib/personal";
import { techHubs } from "@/lib/tech-hubs";

export interface CityGlobeStageProps {
  onBuilt: () => void;
  onFail: () => void;
  onReady: () => void;
  onUnsupported: () => void;
}

export const CityGlobeStage = ({
  onBuilt,
  onFail,
  onReady,
  onUnsupported,
}: CityGlobeStageProps): ReactElement => {
  const viewport = useRef<HTMLDivElement>(null);
  const labelLayer = useRef<HTMLDivElement>(null);
  const controls = useRef<GlobeControls | null>(null);
  const handlers = useRef({ onBuilt, onFail, onReady, onUnsupported });
  const [ready, setReady] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    handlers.current = { onBuilt, onFail, onReady, onUnsupported };
  });

  useEffect(() => {
    const frame = viewport.current;
    const labels = labelLayer.current;
    if (!frame || !labels) return;
    const canvas = document.createElement("canvas");
    canvas.className = "city-canvas";
    frame.append(canvas);
    let live: GlobeControls | undefined;
    try {
      live = createCityGlobe(canvas, {
        home: {
          latitude: personalData.cityCoordinates.latitude,
          longitude: personalData.cityCoordinates.longitude,
          name: personalData.city,
        },
        hubs: techHubs,
        labels,
        onInteract: () => {
          setTouched(true);
        },
        onReady: () => {
          setReady(true);
          handlers.current.onReady();
        },
      });
      controls.current = live;
      handlers.current.onBuilt();
    } catch (error) {
      canvas.remove();
      if (error instanceof SoftwareRendererError) {
        handlers.current.onUnsupported();
      } else {
        handlers.current.onFail();
      }
    }
    return () => {
      live?.dispose();
      canvas.remove();
      controls.current = null;
    };
  }, []);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget) return;
    if (controls.current?.key(event.nativeEvent)) event.preventDefault();
  };

  return (
    <div
      className="city-stage"
      data-state={ready ? "ready" : "loading"}
      data-touched={touched ? "" : undefined}
    >
      <div
        aria-label={cityStrings.globeLabel}
        className="city-viewport focus-ring"
        onKeyDown={onKeyDown}
        ref={viewport}
        role="group"
        tabIndex={0}
      />
      <div aria-hidden="true" className="city-labels" ref={labelLayer} />
      <ul aria-label={cityStrings.hubsLabel} className="sr-only">
        {techHubs.map((hub) => (
          <li key={hub.key}>{hub.name}</li>
        ))}
      </ul>
      <p className="city-credit">{cityStrings.hubsSource}</p>
      <p aria-hidden="true" className="city-hint">
        {cityStrings.hint}
      </p>
      <div className="city-tools">
        <button
          aria-label={cityStrings.zoomIn}
          className="city-tool focus-ring"
          disabled={!ready}
          onClick={() => controls.current?.zoomIn()}
          type="button"
        >
          <Icon aria-hidden name="lucide:plus" size="1rem" />
        </button>
        <button
          aria-label={cityStrings.zoomOut}
          className="city-tool focus-ring"
          disabled={!ready}
          onClick={() => controls.current?.zoomOut()}
          type="button"
        >
          <Icon aria-hidden name="lucide:minus" size="1rem" />
        </button>
        <button
          aria-label={cityStrings.reset}
          className="city-tool focus-ring"
          disabled={!ready}
          onClick={() => controls.current?.reset()}
          type="button"
        >
          <Icon aria-hidden name="lucide:locate-fixed" size="1rem" />
        </button>
      </div>
    </div>
  );
};
