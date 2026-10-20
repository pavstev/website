import {
  type CSSProperties,
  memo,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  useRef,
} from "react";

import {
  keyValue,
  plainKey,
  pointerValue,
  rangeShare,
  type RangeTick,
} from "@/lib/sky-range";

interface RangeLabel {
  content: ReactNode;
  value: number;
}

interface SkyRangeProps {
  id: string;
  keyStep: number;
  labels: readonly RangeLabel[];
  max: number;
  onValue: (value: number) => void;
  pageStep: number;
  tag?: string;
  thumb: "large" | "small";
  ticks: readonly RangeTick[];
  tickStyle: "ruler" | "stop";
  value: number;
  valueText: string;
}

const at = (value: number, max: number): CSSProperties =>
  ({ "--at": rangeShare(value, max) }) as CSSProperties;

interface TicksProps {
  max: number;
  ticks: readonly RangeTick[];
  tickStyle: "ruler" | "stop";
}

const Ticks = memo(({ max, ticks, tickStyle }: TicksProps): ReactElement => (
  <>
    {ticks.map((tick) => (
      <span
        className="sky-range-tick"
        data-major={tick.major ? "" : undefined}
        data-style={tickStyle}
        key={tick.value}
        style={at(tick.value, max)}
      />
    ))}
  </>
));

export const SkyRange = ({
  id,
  keyStep,
  labels,
  max,
  onValue,
  pageStep,
  tag,
  thumb,
  ticks,
  tickStyle,
  value,
  valueText,
}: SkyRangeProps): ReactElement => {
  const input = useRef<HTMLInputElement>(null);

  const pick = (event: PointerEvent<HTMLSpanElement>): void => {
    const box = event.currentTarget.getBoundingClientRect();
    const next = pointerValue(event.clientX, box.left, box.width, max);
    if (next !== undefined && next !== value) onValue(next);
  };

  return (
    <span className="sky-range" data-thumb={thumb}>
      <span aria-hidden="true" className="sky-range-rail">
        <span className="sky-range-track">
          <span className="sky-range-fill" style={at(value, max)} />
        </span>
        <Ticks max={max} ticks={ticks} tickStyle={tickStyle} />
      </span>
      <input
        aria-valuetext={valueText}
        className="sky-range-input"
        id={id}
        max={max}
        min={0}
        onChange={(event) => {
          onValue(Number(event.currentTarget.value));
        }}
        onKeyDown={(event) => {
          if (!plainKey(event)) return;
          const next = keyValue(event.key, value, max, keyStep, pageStep);
          if (next === undefined) return;
          event.preventDefault();
          if (next !== value) onValue(next);
        }}
        ref={input}
        step={1}
        type="range"
        value={value}
      />
      <span
        aria-hidden="true"
        className="sky-range-scale"
        data-tag={tag === undefined ? undefined : ""}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          pick(event);
          input.current?.focus({ preventScroll: true });
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            pick(event);
          }
        }}
      >
        {labels.map((label) => (
          <span
            className="sky-range-label"
            data-current={label.value === value ? "" : undefined}
            key={label.value}
            style={at(label.value, max)}
          >
            {label.content}
          </span>
        ))}
        {tag !== undefined && (
          <span className="sky-range-tag" style={at(value, max)}>
            {tag}
          </span>
        )}
      </span>
    </span>
  );
};
