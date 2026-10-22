export interface Placed<T extends Styled = Styled> {
  alpha: number;
  at: string;
  el: T;
}

interface Styled {
  readonly style: { opacity: string; transform: string };
}

export const translateOf = (left: number, top: number): string =>
  `translate3d(${left.toFixed(1)}px,${top.toFixed(1)}px,0)`;

export const moveTo = (item: Placed, left: number, top: number): void => {
  const at = translateOf(left, top);
  if (item.at === at) return;
  item.at = at;
  item.el.style.transform = at;
};

export const fadeTo = (item: Placed, alpha: number): void => {
  if (item.alpha === alpha) return;
  item.alpha = alpha;
  item.el.style.opacity = alpha.toFixed(2);
};

export const wirePath = (
  x0: number,
  y0: number,
  x1: number,
  y1: number
): string =>
  `M${x0.toFixed(1)} ${y0.toFixed(1)}V${((y0 + y1) / 2).toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}`;
