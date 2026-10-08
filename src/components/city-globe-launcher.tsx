"use client";

import {
  type ComponentType,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import type { CityGlobeStageProps } from "@/components/city-globe-stage";

import { holdScene } from "@/lib/scene-hold";
import { hasSeenSoftwareRenderer } from "@/lib/webgl";

interface CityGlobeLauncherProps {
  closeIcon: ReactNode;
  heading: ReactNode;
  labels: GlobeLabels;
  launchIcon: ReactNode;
  titleId: string;
}

interface GlobeLabels {
  close: string;
  failed: string;
  launch: string;
  loading: string;
  percent: string;
  reload: string;
  retry: string;
  unsupported: string;
}

type Phase = "failed" | "loading" | "ready" | "unsupported";

const creepMs = 80;
const settleMs = 420;
const loadedShare = 0.6;
const builtShare = 0.85;

export const CityGlobeLauncher = ({
  closeIcon,
  heading,
  labels,
  launchIcon,
  titleId,
}: CityGlobeLauncherProps): ReactElement => {
  const button = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const ceiling = useRef(0);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [progress, setProgress] = useState(0);
  const [failures, setFailures] = useState(0);
  const [session, setSession] = useState(0);
  const [Stage, setStage] = useState<ComponentType<CityGlobeStageProps> | null>(
    null
  );

  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, [open]);

  useEffect(() => {
    if (!open || phase !== "loading") return;
    const timer = globalThis.setInterval(() => {
      setProgress((value) => value + (ceiling.current - value) * 0.12);
    }, creepMs);
    return () => {
      globalThis.clearInterval(timer);
    };
  }, [open, phase]);

  useEffect(() => {
    if (phase !== "ready" || progress < 1) return;
    const timer = globalThis.setTimeout(() => {
      setProgress(0);
    }, settleMs);
    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [phase, progress]);

  const fail = (): void => {
    setFailures((count) => count + 1);
    setPhase("failed");
  };

  const load = async (): Promise<void> => {
    ceiling.current = loadedShare - 0.05;
    setPhase("loading");
    try {
      const { CityGlobeStage } = await import("@/components/city-globe-stage");
      ceiling.current = loadedShare;
      setStage(() => CityGlobeStage);
    } catch {
      fail();
    }
  };

  const start = (): void => {
    setProgress(0.04);
    setSession((value) => value + 1);
    if (hasSeenSoftwareRenderer()) {
      setPhase("unsupported");
      return;
    }
    if (Stage) {
      ceiling.current = loadedShare;
      setPhase("loading");
      return;
    }
    void load();
  };

  const launch = (): void => {
    button.current?.closest<HTMLElement>("[popover]")?.hidePopover();
    holdScene(true);
    setOpen(true);
    start();
  };

  const close = (): void => {
    dialog.current?.close();
  };

  const onClosed = (): void => {
    setOpen(false);
    holdScene(false);
    const panel = button.current?.closest<HTMLElement>("[popover]");
    if (!panel) return;
    document
      .querySelector<HTMLElement>(
        `[popovertarget="${CSS.escape(panel.id)}"]:not([popovertargetaction="hide"])`
      )
      ?.focus({ preventScroll: true });
  };

  const onBuilt = (): void => {
    ceiling.current = builtShare;
  };

  const onReady = (): void => {
    setProgress(1);
    setPhase("ready");
  };

  const onUnsupported = (): void => {
    setPhase("unsupported");
  };

  const retry = (): void => {
    if (failures > 1) {
      globalThis.location.reload();
      return;
    }
    start();
  };

  const percent = Math.round(progress * 100);
  const live = phase === "loading" || phase === "ready";
  const showProgress =
    phase === "loading" || (phase === "ready" && progress > 0);

  return (
    <>
      <button
        className="city-launch focus-ring"
        onClick={launch}
        ref={button}
        type="button"
      >
        {launchIcon}
        {labels.launch}
      </button>
      {open
        ? createPortal(
            <dialog
              aria-labelledby={titleId}
              className="globe-dialog"
              onClose={onClosed}
              ref={dialog}
            >
              <span
                aria-hidden="true"
                className="globe-scrim"
                onClick={close}
              />
              <div className="globe-sheet" data-phase={phase} data-topic="city">
                <header className="topic-head globe-head">
                  {heading}
                  <button
                    aria-label={labels.close}
                    className="topic-close focus-ring"
                    onClick={close}
                    type="button"
                  >
                    {closeIcon}
                  </button>
                </header>
                <div className="globe-body">
                  {Stage && live ? (
                    <Stage
                      key={session}
                      onBuilt={onBuilt}
                      onFail={fail}
                      onReady={onReady}
                      onUnsupported={onUnsupported}
                    />
                  ) : null}
                  {showProgress ? (
                    <div
                      aria-label={labels.loading}
                      aria-valuemax={100}
                      aria-valuemin={0}
                      aria-valuenow={percent}
                      className="globe-progress"
                      role="progressbar"
                      style={{ "--progress": progress } as CSSProperties}
                    >
                      <span aria-hidden="true" className="globe-orb" />
                      <span aria-hidden="true" className="globe-track">
                        <span className="globe-fill" />
                      </span>
                      <span aria-hidden="true" className="globe-progress-text">
                        <span>{labels.loading}</span>
                        <span className="globe-progress-value">
                          {labels.percent.replace("{value}", () =>
                            String(percent)
                          )}
                        </span>
                      </span>
                    </div>
                  ) : null}
                  {phase === "failed" ? (
                    <div className="globe-message" role="alert">
                      <p>{labels.failed}</p>
                      <button
                        className="city-launch focus-ring"
                        onClick={retry}
                        type="button"
                      >
                        {failures > 1 ? labels.reload : labels.retry}
                      </button>
                    </div>
                  ) : null}
                  {phase === "unsupported" ? (
                    <div className="globe-message" role="status">
                      <p>{labels.unsupported}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </dialog>,
            document.body
          )
        : null}
    </>
  );
};
