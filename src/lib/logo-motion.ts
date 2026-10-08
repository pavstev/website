export const logoMotionConfig = {
  hotAmplitude: 0.5,
  hotSpeed: 3.4,
  hotTauMs: 140,
  sunriseFrom: -1.9,
  sunriseMs: 2400,
  wobbleAmplitude: 0.35,
  wobblePeriodMs: 9000,
} as const;

export interface LogoInput {
  hotGoal: number;
  started: boolean;
}

export interface LogoMotion {
  readonly elapsedMs: number;
  readonly hot: number;
  readonly phase: number;
}

const {
  hotAmplitude,
  hotSpeed,
  hotTauMs,
  sunriseFrom,
  sunriseMs,
  wobbleAmplitude,
  wobblePeriodMs,
} = logoMotionConfig;
const fullTurn = 2 * Math.PI;

export const createLogoMotion = (): LogoMotion => ({
  elapsedMs: -1,
  hot: 0,
  phase: 0,
});

export const stepLogoMotion = (
  state: LogoMotion,
  dtMs: number,
  input: LogoInput
): LogoMotion => {
  if (dtMs <= 0) return state;
  const hot =
    state.hot + (input.hotGoal - state.hot) * (1 - Math.exp(-dtMs / hotTauMs));
  if (!input.started && state.elapsedMs < 0) return { ...state, hot };
  const from = Math.max(state.elapsedMs, 0);
  const end = from + dtMs;
  const elapsedMs = Math.min(end, sunriseMs);
  const speed = 1 + (hotSpeed - 1) * hot;
  const turn = (fullTurn * (end - elapsedMs)) / wobblePeriodMs;
  const phase = (state.phase + turn * speed) % fullTurn;
  return { elapsedMs, hot, phase };
};

export const settleLogoMotion = (state: LogoMotion): LogoMotion => ({
  ...state,
  elapsedMs: sunriseMs,
  phase: 0,
});

export const logoSpin = ({ elapsedMs, hot, phase }: LogoMotion): number => {
  if (elapsedMs < 0) return sunriseFrom;
  if (elapsedMs < sunriseMs) {
    return sunriseFrom * (1 - elapsedMs / sunriseMs) ** 3;
  }
  const amplitude = wobbleAmplitude + (hotAmplitude - wobbleAmplitude) * hot;
  return amplitude * Math.sin(phase);
};
