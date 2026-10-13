import { skyFragmentShader } from "./sky-shader.ts";

interface CornerCorona {
  radius: number;
  x: number;
  y: number;
}

interface MeteorPath {
  angle: number;
  x: number;
  y: number;
}

type RayKnob = "coronaBright" | "coronaSize";

const tunedRays: Readonly<Record<RayKnob, number>> = {
  coronaBright: 1.06,
  coronaSize: 0.48,
};

const longRays: Readonly<Record<RayKnob, number>> = {
  coronaBright: 1.3,
  coronaSize: 1.6,
};

const raySource = 0.43;

const shaderLine = (knob: RayKnob, value: number): string =>
  `const float ${knob} = ${value.toFixed(2)};`;

export const cornerMeteor: Readonly<MeteorPath> = {
  angle: -0.4,
  x: 0.3,
  y: 0.38,
};

export const patchShader = (
  shader: string,
  swaps: ReadonlyArray<readonly [string, string]>
): string => {
  let source = shader;
  for (const [from, to] of swaps) {
    if (!source.includes(from))
      throw new Error(`The sky shader no longer holds: ${from}`);
    source = source.replace(from, () => to);
  }
  return source;
};

export const longRaysShader: string = patchShader(
  skyFragmentShader,
  (["coronaSize", "coronaBright"] as const).map(
    (knob) =>
      [
        shaderLine(knob, tunedRays[knob]),
        shaderLine(knob, longRays[knob]),
      ] as const
  )
);

export const cornerCorona = (height: number): CornerCorona => {
  const radius = Math.round(raySource * height);
  return { radius, x: -radius, y: -radius };
};
