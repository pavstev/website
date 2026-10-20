import { motion } from "motion/react";
import {
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useStill } from "@/lib/use-still";

const crossfade = {
  damping: 34,
  mass: 0.8,
  stiffness: 260,
  type: "spring",
} as const;
const instant = { duration: 0 } as const;

type AsyncActionStatus = "error" | "idle" | "pending" | "success";

interface UseAsyncActionOptions {
  action: () => Promise<unknown>;
  resetAfter?: number;
}

interface UseAsyncActionResult {
  run: () => void;
  status: AsyncActionStatus;
}

export const useAsyncAction = ({
  action,
  resetAfter = 1400,
}: UseAsyncActionOptions): UseAsyncActionResult => {
  const [status, setStatus] = useState<AsyncActionStatus>("idle");
  const phase = useRef<AsyncActionStatus>("idle");
  const runId = useRef(0);
  const timer = useRef<null | ReturnType<typeof setTimeout>>(null);
  const alive = useRef(true);
  const act = useRef(action);

  useEffect(() => {
    act.current = action;
  });

  const clear = useCallback(() => {
    if (!timer.current) {
      return;
    }

    clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const run = useCallback(() => {
    if (phase.current === "pending") return;
    clear();
    runId.current += 1;
    const id = runId.current;
    phase.current = "pending";
    setStatus("pending");

    const settle = (next: "error" | "success"): void => {
      if (!alive.current || id !== runId.current) return;
      clear();
      phase.current = next;
      setStatus(next);
      timer.current = setTimeout(() => {
        if (!alive.current || id !== runId.current) return;
        phase.current = "idle";
        setStatus("idle");
      }, resetAfter);
    };

    const execute = async (): Promise<void> => {
      try {
        await act.current();
        settle("success");
      } catch {
        settle("error");
      }
    };
    void execute();
  }, [clear, resetAfter]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clear();
    };
  }, [clear]);

  return { run, status };
};

interface SpinnerProps {
  still: boolean;
}

const Spinner = ({ still }: SpinnerProps): ReactElement => (
  <motion.svg
    aria-hidden="true"
    className="shrink-0"
    fill="none"
    height="12"
    viewBox="0 0 12 12"
    width="12"
    {...(still
      ? {}
      : {
          animate: { rotate: 360 },
          transition: { duration: 0.85, ease: "linear", repeat: Infinity },
        })}
  >
    <circle
      cx="6"
      cy="6"
      r="4.5"
      stroke="currentColor"
      strokeOpacity="0.22"
      strokeWidth="1.5"
    />
    <path
      d="M10.5 6A4.5 4.5 0 0 0 6 1.5"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.5"
    />
  </motion.svg>
);

const CheckMark = (): ReactElement => (
  <svg
    aria-hidden="true"
    className="shrink-0"
    fill="none"
    height="12"
    viewBox="0 0 12 12"
    width="12"
  >
    <path
      d="M2.6 6.3 4.9 8.6 9.4 3.6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    />
  </svg>
);

const AlertMark = (): ReactElement => (
  <svg
    aria-hidden="true"
    className="shrink-0"
    fill="none"
    height="12"
    viewBox="0 0 12 12"
    width="12"
  >
    <path
      d="M6 2.9v3.5"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.7"
    />
    <path
      d="M6 9.05h.01"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.9"
    />
  </svg>
);

interface LoadingFacesProps {
  idleIcon: ReactNode;
  labels: Record<AsyncActionStatus, string>;
  status: AsyncActionStatus;
}

export const LoadingFaces = ({
  idleIcon,
  labels,
  status,
}: LoadingFacesProps): ReactElement => {
  const still = useStill();
  const faces: Array<{
    icon: ReactNode;
    key: AsyncActionStatus;
    tone: string;
  }> = [
    { icon: idleIcon, key: "idle", tone: "" },
    {
      icon: <Spinner still={still || status !== "pending"} />,
      key: "pending",
      tone: "text-(--ui-key-pending)",
    },
    { icon: <CheckMark />, key: "success", tone: "text-(--ui-key-success)" },
    { icon: <AlertMark />, key: "error", tone: "text-(--ui-key-error)" },
  ];
  return (
    <span aria-hidden="true" className="relative grid place-items-center">
      {faces.map((face) => (
        <motion.span
          animate={
            face.key === status
              ? { filter: "blur(0px)", opacity: 1, y: 0 }
              : { filter: "blur(3px)", opacity: 0, y: 3 }
          }
          className={`col-start-1 row-start-1 flex items-center justify-center gap-1.5 ${face.tone}`.trim()}
          initial={false}
          key={face.key}
          transition={still ? instant : crossfade}
        >
          {face.icon}
          <span data-label="">{labels[face.key]}</span>
        </motion.span>
      ))}
    </span>
  );
};
