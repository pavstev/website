export const skyVertexShader = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const noiseGlsl = `
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

float fbm3(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p = m * p + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}
`;

const skyCommon = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_res;
uniform float u_view;
uniform float u_labPx;
uniform float u_time;
uniform vec2 u_pointer;
uniform vec4 u_meteor;
uniform float u_clouds;
uniform float u_cloudTime;
uniform float u_cloudShift;
uniform vec3 u_daylight;
uniform vec4 u_weather;
uniform vec4 u_fall;
uniform vec4 u_probe;

const float PI = 3.14159265;
const float speed = 1.82;
const float brightness = 0.7;
const float hueShift = -0.2618;
const float skyTop = 0.5;
const float dayLift = 0.87;
const float dayTint = 1.6;
const float dayGain = 1.6731;
const float starFade = 0.75;
const float meteorTail = 0.35;
const float meteorTravel = 0.75;
const float meteorWidth = 0.0028;
const float haze = 0.21;
const float precip = 0.5;
const vec3 tauRay = vec3(0.046, 0.108, 0.265);
const vec3 aerosol = vec3(0.759, 1.0, 1.337);
const float skyFov = 0.873;
const vec3 luma = vec3(0.2126, 0.7152, 0.0722);
const float dayKnee = 0.09;

vec3 srgbToLinear(vec3 c) {
  c = max(c, 0.0);
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

vec3 linearToSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

float flashAmt;
float openSky;
vec3 underLight;
float flashX;

${noiseGlsl}
vec3 hueRotate(vec3 c, float a) {
  vec3 k = vec3(0.57735);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}

vec3 hz(vec3 c) {
  return hueRotate(c, -hueShift);
}

float airmass(float h) {
  float e = max(h, 0.0);
  return 1.0 / (sin(e) + 0.50572 * pow(e * 57.29578 + 6.07995, -1.6364));
}

vec3 clearSky(float h, vec3 tau, float aod) {
  return (tauRay + aerosol * aod * 0.8) / tau * (1.0 - exp(-tau * airmass(h)));
}

vec3 sunTint(vec3 tau, float el) {
  vec3 t = exp(-tau * (airmass(el) / 3.2 + max(-el, 0.0) * 46.0));
  return t / max(max(t.r, max(t.g, t.b)), 0.0001);
}

float rainLayer(vec2 p, float cells, float fall, float t, float seed, float rows) {
  vec2 q = vec2((p.x + p.y * u_fall.w) * cells, p.y * cells * 0.07 + t * fall);
  float lane = floor(q.x);
  float lag = hash(vec2(lane, seed + 2.3)) * 9.1;
  float x = fract(q.x) - 0.5 - (hash(vec2(lane, seed)) - 0.5) * 0.7;
  float y = fract(q.y + lag);
  float keep = step(0.45, hash(vec2(lane, mod(floor(q.y + lag), rows) + seed)));
  float line = smoothstep(cells / u_view * 1.2, 0.0, abs(x));
  return line * smoothstep(0.0, 0.08, y) * smoothstep(0.5, 0.2, y) * keep;
}

float snowLayer(vec2 p, float cells, float fall, float t, float seed, float size, float amount) {
  vec2 q = p * cells;
  q.y += t * fall;
  q.x += sin(t * 0.7 + floor(q.y) * 1.7 + seed) * 0.35 - t * fall * u_fall.w;
  vec2 id = floor(q);
  if (hash(id + seed) > amount) return 0.0;
  vec2 f = fract(q) - 0.5 - (vec2(hash(id + seed + 1.1), hash(id + seed + 2.7)) - 0.5) * 0.6;
  float d = length(f) * u_view / cells * u_labPx;
  return smoothstep(size, size * 0.25, d) * (0.6 + 0.4 * hash(id + seed + 4.4));
}

float fogMix(vec2 p, float yb, float tm, float ts) {
  if (u_weather.w <= 0.0) return 0.0;
  float fogAmt = u_weather.w;
  float roll = fbm3(vec2(p.x * 1.3 + ts * 0.003, yb * 2.6 - tm * 0.003));
  return fogAmt * clamp(exp(-yb * mix(3.2, 1.4, fogAmt)) * (0.7 + 0.6 * roll) + 0.15 * fogAmt, 0.0, 1.0) * 0.92;
}
`;

const blogCommon = `
uniform vec3 u_portrait;
uniform vec4 u_puffs[10];
uniform float u_puffOn;
const float TAU = 6.2831853;
const float starAmount = 0.78;
const float twinkle = 0.25;
const float starTop = 1.7;
const float cityGlow = 0.65;
const vec3 lampColor = vec3(1.5217, 0.9125, 0.331);
const float centerDim = 0.39;
const float coronaSize = 0.48;
const float coronaBright = 1.06;
const float streamers = 1.68;
const float streamDetail = 5.1;
const float fineRays = 1.27;
const float equator = 0.97;
const float lowerFade = 0.7;
const float drift = 0.02;
const float raySpin = 0.09;
const float fineSpin = -0.05;
const float flareSpin = 0.03;
const float flares = 0.52;
const float flareSize = 0.123;
const float flareHue = -0.4363;
const float rim = 0.5;
const float flash = 0.44;
const float flashAngle = 2.3562;
const float flashPeriod = 13.96;
const float horizonGlow = 1.0;
const float glowFalloff = 5.1;
const float cloudHeight = 0.34;
const float cloudScale = 3.13;
const float cloudDrift = 2.6;
const float underglow = 1.52;
const float cloudDark = 0.74;
const float cloudOpacity = 0.92;
const float cloudReach = 0.62;
const float cloudLight = 0.45;
const float cloudDayLight = 0.55;
const float cloudLightStep = 0.09;
const float wispLight = 0.49;
const float variety = 0.65;
const float wisps = 0.4;
const float dayShade = 1.18;
const float coronaDay = 0.75;
const float twilightGlow = 1.0;
const float warmth = 0.65;
const float coronaReach = 14.0;
const float coronaFade = 9.0;
const float coronaTaperStart = 3.0;
const float coronaTaperEnd = 6.0;
const vec4 cloudTone = vec4(1.0, 0.55, 0.5, 0.8);
const vec3 cloudGlow = vec3(1.0, 0.78, 0.58);
const float puffMode = 0.0;
const float puffWide = 0.12;
const float puffTall = 0.07;
const float cloudFollow = 0.7;
const float dayCeiling = 0.15;
float nightSky;

vec3 starField(vec2 p, float scale, float keep, float t, float boost) {
  vec2 g = p * scale;
  vec2 id = floor(g);
  float ybc = (id.y + 0.5) / scale - u_pointer.y + 0.5 * u_res.y / u_view;
  float high = smoothstep(0.3, 0.95, ybc * u_view / u_res.y);
  keep = clamp(1.0 - (1.0 - keep) * starAmount * (1.0 + (starTop - 1.0) * high * boost), 0.0, 1.0);
  vec2 f = fract(g) - 0.5;
  float r = hash(id);
  if (r < keep) return vec3(0.0);
  vec2 o = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5;
  float d = length(f - o * 0.6) * u_view / scale * u_labPx;
  float b = pow(hash(id + 1.3), 6.0) * 2.0 + 0.03;
  float tw = 1.0 - twinkle + twinkle * sin(t * (0.6 + r * 2.0) + r * 40.0);
  vec3 tint = mix(vec3(0.68, 0.78, 1.0), vec3(1.0, 0.86, 0.66), hash(id + 5.5));
  float core = smoothstep(max(1.4, u_labPx * 1.1), 0.0, d);
  return tint * b * tw * (core + exp(-d) * b * 0.18);
}

vec3 stars(vec2 p, float t) {
  return starField(p, 30.0, 0.8, t, 0.35) + starField(p + 3.7, 70.0, 0.88, t, 0.8) * 0.75 + starField(p + 9.1, 150.0, 0.93, t, 1.0) * 0.5;
}

float fbmTaper(vec2 p, float keep) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    if (i >= 3) {
      if (keep <= 0.0) break;
      a *= keep;
    }
    v += a * noise(p);
    p = m * p + vec2(1.7, 9.2);
    a *= i >= 3 ? 0.5 / keep : 0.5;
  }
  return v;
}

vec2 spin(vec2 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

float stratoCells(vec2 g, float near, float rows, float keepLow, float keepHigh) {
  vec2 gi = floor(g);
  vec2 gf = fract(g);
  float best = 9.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      vec2 cell = gi + o;
      float hc = pow(max((cell.y + 0.5 - near * 0.5) / rows, 0.0), 1.33);
      if (hash(cell + near * 13.0) > mix(keepLow, keepHigh, clamp(hc, 0.0, 1.0))) continue;
      vec2 jit = vec2(hash(cell + 3.3), hash(cell + 8.1)) * 0.7 + 0.15;
      vec2 dv = o + jit - gf;
      best = min(best, length(dv * vec2(1.0, 1.5)) * (0.8 + 0.4 * hash(cell + 1.9)));
    }
  }
  return best;
}

float puffBump(vec2 p, float yb, float near) {
  if (u_puffOn < 0.5) return 0.0;
  float k = 0.01 * cloudDrift * (1.0 + near * 0.8) / (cloudScale * (1.0 + near * 0.6)) * speed;
  float b = 0.0;
  for (int i = 0; i < 10; i++) {
    vec4 q = u_puffs[i];
    vec2 d = vec2((p.x - q.x + q.z * k) / puffWide, (yb - q.y) / puffTall);
    b += q.w * exp(-dot(d, d));
  }
  return min(b, 1.5);
}

float cloudX(vec2 p, float near, float ts) {
  float sc = cloudScale * (1.0 + near * 0.6);
  return p.x + ts * 0.01 * cloudDrift * (1.0 + near * 0.8) / sc + near * 5.3;
}

float cloudTop(float x, float near) {
  return cloudHeight * mix(1.0, 0.6, near) * (1.0 + (noise(vec2(x * 0.6 + near * 4.0, near * 7.3)) - 0.5) * variety) * (1.0 + (u_weather.x - 0.6) * 0.9);
}

float stratoShape(float x, float yb, float near, float tm, float top, float detail, float bump) {
  float cover = u_weather.x - 0.6;
  float swell = bump * (1.0 - puffMode);
  float fresh = bump * puffMode * smoothstep(0.3, 0.7, detail + 0.15);
  float raise = swell * 0.35;
  float h = yb / top;
  if (h > 1.3 + raise || h < -0.1) return fresh;
  float rows = mix(4.0, 3.2, near);
  vec2 g = vec2(x * mix(6.0, 4.4, near), pow(max(h, 0.0), 0.75) * rows + near * 0.5);
  vec2 wq = vec2(x * 2.4, yb * 3.0 + near * 3.0);
  g += (vec2(fbm3(wq + tm * 0.002), fbm3(wq + 5.2 - tm * 0.002)) - 0.5) * 1.1;
  float cells = stratoCells(g, near, rows, 1.0 + min(cover, 0.0) * 0.6, 0.6 + cover * 0.8);
  float blob = smoothstep(1.0 + swell * 0.3, 0.2, cells + (detail - 0.5) * 1.0 - cover * 0.35);
  float fill = smoothstep(0.55 + cover * 0.6 + swell * 0.2, 0.0, h) * smoothstep(0.3 - cover * 0.4, 0.75, detail + 0.15);
  float env = smoothstep(1.2 + raise, 0.7 + raise, h + (detail - 0.5) * 0.4);
  return clamp(max(max(blob, fill) * env, fresh), 0.0, 1.0);
}

vec3 cloudLayer(vec3 col, vec2 p, float yb, float near, float tm, float ts, vec3 warm) {
  float x = cloudX(p, near, ts);
  float bump = puffBump(p, yb, near);
  float top = cloudTop(x, near);
  if (yb > top * (1.3 + bump * 0.35) && bump * puffMode < 0.01) return col;
  float detail = fbm(vec2(x * 12.0, yb * 18.0) + near * 7.0 + tm * 0.004);
  float dens = stratoShape(x, yb, near, tm, top, detail, bump);
  if (dens <= 0.005) return col;
  float below = stratoShape(x, yb - top * cloudLightStep, near, tm, top, detail, bump);
  float above = stratoShape(x, yb + top * cloudLightStep, near, tm, top, detail, bump);
  float toGlow = exp(-below * 2.4);
  float toSky = exp(-above * 1.6);
  float under = exp(-yb * glowFalloff * 0.8);
  float heavy = u_weather.y;
  float sunUp = u_daylight.x;
  vec3 warmTone = mix(vec3(dot(warm, luma)), warm, cloudTone.z);
  float ul = max(dot(underLight, luma), 0.0001);
  vec3 glowTint = mix(mix(cloudGlow, warmTone, clamp(u_daylight.y * warmth, 0.0, 1.0)), underLight / ul * dot(cloudGlow, luma), cloudFollow);
  float glowGain = mix(cloudTone.y * (1.0 - cloudTone.w * sunUp) * (1.0 - 0.45 * heavy), cloudTone.y * clamp(ul / 0.2, 0.2, 1.5), cloudFollow);
  vec3 body = mix(vec3(0.08, 0.085, 0.12), vec3(0.015, 0.017, 0.03), cloudDark) * (1.0 - near * 0.3);
  body += vec3(0.15, 0.16, 0.21) * cloudLight * (0.55 + 0.45 * toSky);
  body += vec3(0.3, 0.34, 0.44) * cloudDayLight * dayGain * sunUp * (0.6 + 1.1 * toSky) * (1.0 - 0.4 * heavy);
  body *= (0.85 + 0.3 * detail) * (1.0 - 0.3 * heavy);
  vec3 lit = glowTint * under * underglow * 0.9 * horizonGlow * (0.15 + 1.05 * toGlow) * (1.0 + u_daylight.y * twilightGlow * 0.6) * glowGain;
  float thin = dens * (1.0 - dens) * 4.0;
  vec3 cc = body + lit + glowTint * under * thin * 0.35 * glowGain + vec3(0.75, 0.8, 1.0) * thin * toSky * 0.05 * (1.0 + sunUp);
  float fd = (p.x - flashX) / 0.4;
  cc += vec3(0.75, 0.8, 1.0) * flashAmt * exp(-fd * fd) * (0.35 + 0.65 * toGlow) * dens;
  cc = mix(vec3(dot(cc, luma)), cc, cloudTone.z);
  cc = mix(cc, hueRotate(cc, -hueShift), cloudTone.x);
  float alpha = (1.0 - exp(-dens * 3.2)) / (1.0 - exp(-3.2));
  return mix(col, cc, alpha * cloudOpacity);
}

vec3 coronaLight(vec2 d, float r, float r0, float t, float keep) {
  vec3 light = vec3(0.0);
  vec2 dir = d / max(r, 0.0001);
  float rr = max(1.0 + (r - 1.0) / coronaSize, 1.0);
  float taper = smoothstep(coronaTaperEnd, coronaTaperStart, r);
  float str = pow(fbmTaper(spin(dir, t * raySpin) * streamDetail + vec2(log(rr) * 0.3 - t * drift, t * drift * 0.5), taper), 2.0) * 2.2;
  float fine = fbmTaper(spin(dir, t * fineSpin) * 16.0 + vec2(log(rr) * 0.2, t * drift * 0.75), taper);
  float eq = (1.0 - equator * 0.69) + equator * abs(dir.x);
  float cor = (pow(1.0 / rr, 2.6) * 2.4 + pow(1.0 / rr, 1.25) * 0.32 * (str * 1.8 * streamers + fine * fineRays) * eq) * smoothstep(0.995, 1.01, r);
  cor *= mix(1.0 - lowerFade, 1.0, smoothstep(-2.6, 0.2, d.y));
  vec3 inner = mix(vec3(1.0, 0.97, 0.92), vec3(1.0, 0.82, 0.52), 0.5);
  vec3 outer = mix(vec3(0.92, 0.92, 0.95), vec3(0.6, 0.74, 1.0), 0.5);
  light += mix(inner, outer, smoothstep(1.0, 3.2, rr)) * cor * 0.8 * coronaBright * smoothstep(coronaReach, coronaFade, r) * keep;
  if (r < 1.0 + flareSize + 0.05) {
    float pr = smoothstep(0.6, 0.8, fbm(spin(dir, t * flareSpin) * 9.0 + vec2(t * 0.03, 0.0))) * smoothstep(1.0 + flareSize, 1.0, r) * step(1.0, r);
    light += hueRotate(vec3(1.0, 0.32, 0.55), flareHue) * pr * 1.4 * flares * keep;
  }
  light += hueRotate(vec3(1.0, 0.42, 0.62), flareHue) * exp(-abs(r - 1.0) * r0 * u_labPx * 0.45) * rim;
  float pulse = pow(0.5 + 0.5 * sin(t * TAU / flashPeriod), 10.0) * flash * keep;
  if (pulse > 0.002) {
    vec2 bq = (d - vec2(cos(flashAngle), sin(flashAngle)) * 1.01) * r0 * u_labPx;
    float bl = length(bq);
    float bead = exp(-bl * 0.22) * 1.6 + exp(-abs(bq.y) * 0.7) * exp(-abs(bq.x) * 0.02) * 0.5 + exp(-abs(bq.x) * 0.7) * exp(-abs(bq.y) * 0.03) * 0.3;
    light += vec3(1.0, 0.96, 0.88) * bead * pulse;
  }
  return light;
}
`;

export const skyFragmentShader = `${skyCommon}${blogCommon}
void main() {
  vec2 fc = u_probe.z > 0.0 ? gl_FragCoord.xy * u_probe.zw + u_probe.xy : gl_FragCoord.xy;
  float yb = fc.y / u_view;
  float yt = (u_res.y - fc.y) / u_view;
  vec2 p = (fc - 0.5 * u_res) / u_view;
  vec2 ps = p + u_pointer;
  float t = u_time * speed;
  float tm = u_cloudTime * speed;
  float ts = u_cloudShift * speed;
  float sunUp = u_daylight.x;
  float twi = u_daylight.y;
  float day = sunUp * dayLift;
  vec3 warm = mix(vec3(1.0, 0.5, 0.6), vec3(1.0, 0.42, 0.16), u_daylight.z);
  float starKeep = 1.0 - sunUp * min(1.0, starFade * dayGain);
  float coronaKeep = mix(1.0, coronaDay, sunUp);

  vec3 night = vec3(0.02, 0.025, 0.05) + vec3(0.03, 0.05, 0.13) * (1.0 - clamp(yb, 0.0, 1.0)) * skyTop * 2.0;
  vec3 dayTop = mix(vec3(0.05, 0.08, 0.22), vec3(0.1, 0.24, 0.52), dayTint);
  vec3 dayLow = mix(vec3(0.25, 0.3, 0.46), vec3(0.45, 0.6, 0.78), dayTint);
  vec3 col = mix(night, mix(dayLow, dayTop, smoothstep(0.0, 1.2, yb)), day);
  float ov = u_weather.y;
  float fogA = u_weather.w;
  openSky = (1.0 - ov) * (1.0 - 0.85 * fogA);
  nightSky = 1.0 - sunUp;
  float aod = haze * mix(0.7, 1.0, u_daylight.z);
  vec3 tau = tauRay + aerosol * aod;
  float h = clamp(yb, 0.0, 1.2) * skyFov;
  float sunEl = u_daylight.x > 0.0 ? mix(0.009, 0.593, clamp((u_daylight.x - 0.55) / 0.45, 0.0, 1.0)) : -0.105 * (1.0 - clamp(twi, 0.0, 1.0));
  vec3 lampSky = mix(vec3(dot(lampColor, luma)), lampColor, 0.45);
  float amp = pow((1.0 + 9.1 * ov) * (1.0 + 18.0 * u_fall.y) * (1.0 + 4.0 * fogA), 0.33);
  float cityLight = 0.11 * cityGlow * amp * nightSky;
  vec3 band = sunTint(tau, sunEl);
  float bandLight = twi * openSky * openSky;
  underLight = lampSky * cityLight + band * bandLight * 0.45 + vec3(0.9, 0.92, 0.95) * sunUp * (1.0 - twi) * 0.03;
  vec3 night05 = vec3(0.02, 0.025, 0.05) + vec3(0.03, 0.05, 0.13) * 0.5 * skyTop * 2.0;
  vec3 base05 = mix(night05, mix(dayLow, dayTop, smoothstep(0.0, 1.2, 0.5)), day);
  vec3 ref = hz(clearSky(0.5 * skyFov, tau, aod));
  vec3 phys = hz(clearSky(h, tau, aod)) * dot(base05, luma) / max(dot(ref, luma), 0.0001);
  col = mix(col, phys, sunUp * (1.0 - 0.5 * twi) * smoothstep(0.75, 0.05, yb));
  float trans = 1.0 / (1.0 + 0.1125 * (12.0 + 22.0 * u_fall.x + 30.0 * u_fall.z));
  float snowLift = 1.0 / (1.0 - 0.8 * (1.0 - trans) * u_fall.y);
  vec3 deckNight = vec3(0.03, 0.032, 0.04);
  vec3 deckDay = vec3(0.66, 0.68, 0.72) * sqrt(dayGain) * trans * snowLift * (1.0 + 2.0 * sin(h)) / 3.0 * 1.7;
  col = mix(col, hueRotate(mix(deckNight, deckDay, sunUp), -hueShift), ov * 0.85);
  col += stars(ps, t) * 0.55 * starKeep * (1.0 - 0.92 * ov);
  col += hz(lampSky) * cityLight * mix(1.0 - exp(-0.25 * airmass(h)), 0.75, ov * 0.6);
  col += hz(band) * (0.7 * exp(-yb * 4.0) + 0.07 * exp(-yb * 1.5)) * bandLight;

  if (u_portrait.z > 0.5) {
    float r0 = u_portrait.z;
    vec2 d = (fc - u_portrait.xy) / r0;
    float r = length(d);
    if (r < coronaReach) {
      col += coronaLight(d, r, r0, t, coronaKeep);
      col *= smoothstep(0.97, 1.0, r) * 0.97 + 0.03;
    }
  }

  if (u_meteor.w < 1.0) {
    vec2 md = vec2(cos(u_meteor.z), sin(u_meteor.z));
    vec2 rel = ps - (u_meteor.xy + md * u_meteor.w * meteorTravel);
    float behind = dot(rel, -md);
    float across = dot(rel, vec2(-md.y, md.x)) / meteorWidth;
    float trail = smoothstep(meteorTail, 0.0, behind) * step(-0.003, behind) * exp(-across * across);
    float head = exp(-dot(rel, rel) / 0.00005);
    col += vec3(0.92, 0.96, 1.0) * (trail * 0.9 + head * 1.4) * sin(PI * u_meteor.w) * starKeep * (1.0 - ov);
  }

  float tr = mod(tm, 2000.0);
  flashAmt = 0.0;
  flashX = 0.0;
  if (u_fall.z > 0.0) {
    float slot = floor(tm / 9.0);
    float at = tm - slot * 9.0 - hash(vec2(slot, 1.7)) * 4.0;
    if (hash(vec2(slot, 4.2)) < 0.5 && at > 0.0) flashAmt = u_fall.z * exp(-at * 6.0) * smoothstep(0.0, 0.04, at) * (0.8 + 0.4 * hash(vec2(slot, 2.9)));
    flashX = (hash(vec2(slot, 9.1)) - 0.5) * u_res.x / u_view * 0.9;
  }
  if (u_clouds > 0.5 && yb > 0.22 && yb < 0.8) {
    float band = smoothstep(0.26, 0.42, yb) * smoothstep(0.8, 0.52, yb);
    float wx = p.x + ts * 0.012 * cloudDrift / 1.1;
    vec2 wq = vec2(wx * 1.1, yb * 9.0 + fbm3(vec2(wx * 0.8, yb * 2.0 + tm * 0.004)) * 1.6);
    float streak = smoothstep(0.55, 0.85, fbm(wq)) * band;
    vec3 wisp = vec3(0.3, 0.33, 0.42) * (0.4 + wispLight) + warm * 0.75 * twi + vec3(0.35, 0.4, 0.5) * sunUp * cloudDayLight;
    col += wisp * streak * wisps * u_weather.z * 2.0;
  }

  if (u_clouds > 0.5 && yb < cloudReach * (1.0 + max(u_weather.x - 0.6, 0.0) * 0.9) + u_puffOn * 0.2) {
    col = cloudLayer(col, p, yb, 0.0, tm, ts, warm);
    col = cloudLayer(col, p, yb, 1.0, tm, ts, warm);
  }

  if (u_fall.x > 0.0 && yb < 0.45) {
    float cx = p.x + ts * 0.004 * cloudDrift;
    float shaft = smoothstep(0.45, 0.75, fbm3(vec2(cx * 2.2, 3.1)));
    float lines = 0.6 + 0.4 * noise(vec2((cx + yb * u_fall.w * 0.5) * 90.0, yb * 3.0 - tr * 0.6));
    vec3 shaftCol = mix(vec3(0.05, 0.055, 0.07), vec3(0.32, 0.35, 0.4), sunUp);
    col = mix(col, hueRotate(shaftCol, -hueShift), u_fall.x * shaft * lines * smoothstep(0.42, 0.05, yb) * 0.45);
  }

  float fog = fogMix(p, yb, tm, ts);
  if (fog > 0.0) {
    vec3 fogNight = vec3(0.07, 0.072, 0.078) + mix(vec3(dot(lampColor, luma)), lampColor, 0.25) * 0.07 * cityGlow * amp * exp(-yb * 1.2);
    col = mix(col, hueRotate(mix(fogNight, vec3(0.47, 0.48, 0.5) * sqrt(dayGain), sunUp), -hueShift), fog);
  }

  if (u_fall.x > 0.0) {
    float drops = rainLayer(p, 110.0, 7.2, tr, 1.0, 240.0) + rainLayer(p, 190.0, 9.5, tr, 7.0, 380.0) * 0.6;
    col += hueRotate(mix(vec3(0.3, 0.33, 0.4), vec3(0.7, 0.75, 0.82), sunUp), -hueShift) * drops * u_fall.x * 0.5 * precip;
  }
  if (u_fall.y > 0.0) {
    float dense = mix(0.45, 1.0, precip);
    float flakes = snowLayer(p, 28.0, 2.8, tr, 1.0, 4.5, 0.35 * dense) + snowLayer(p, 55.0, 3.3, tr, 5.0, 3.0, 0.3 * dense) * 0.8 + snowLayer(p, 100.0, 3.8, tr, 9.0, 2.0, 0.25 * dense) * 0.6;
    col += hueRotate(mix(vec3(0.55, 0.58, 0.66), vec3(0.9, 0.93, 1.0), sunUp), -hueShift) * flakes * u_fall.y * 0.7 * precip;
  }

  float vx = fc.x / u_res.x - 0.5;
  float vy = max(max(0.5 - yt, 0.5 - yb), 0.0);
  float vignette = smoothstep(0.1, 0.9, length(vec2(vx, vy)) * 1.3);
  col *= mix(1.0 - centerDim * mix(1.0, dayShade, sunUp), 1.0, vignette);
  col = max(hueRotate(col * brightness, hueShift), 0.0);
  col = 1.0 - exp(-col * 1.15);
  float roll = smoothstep(0.0, 0.3, sunUp);
  if (u_portrait.z > 0.5) roll *= smoothstep(1.4, 2.4, length(fc - u_portrait.xy) / u_portrait.z);
  if (roll > 0.0) {
    vec3 lin = srgbToLinear(col);
    float lum = dot(lin, luma);
    if (lum > dayKnee) {
      float room = dayCeiling - dayKnee;
      float soft = dayKnee + room * (1.0 - exp((dayKnee - lum) / room));
      col = linearToSrgb(lin * mix(1.0, soft / lum, roll));
    }
  }
  col += (fract(52.9829189 * fract(dot(fc, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

const textShade = `
uniform vec4 u_txt[3];
const float textKnee = 0.1;
const float textCeiling = 0.16;

float textNear(vec2 fc, float feather) {
  float k = 0.0;
  for (int i = 0; i < 3; i++) {
    vec4 b = u_txt[i];
    if (b.z > b.x) {
      vec2 q = max(max(b.xy - fc, fc - b.zw), 0.0);
      k = max(k, 1.0 - smoothstep(0.0, feather, length(q)));
    }
  }
  return k;
}

vec3 capText(vec3 col, float near, float ceiling) {
  if (near <= 0.0) return col;
  vec3 c = max(col, 0.0);
  vec3 lin = mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
  float lum = dot(lin, vec3(0.2126, 0.7152, 0.0722));
  float knee = min(textKnee, ceiling * 0.6);
  if (lum <= knee) return col;
  float room = ceiling - knee;
  float soft = knee + room * (1.0 - exp((knee - lum) / room));
  lin *= mix(1.0, soft / lum, near);
  return mix(lin * 12.92, 1.055 * pow(lin, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), lin));
}

`;

export const homeSkyFragmentShader = `${skyCommon}
${textShade}
uniform vec3 u_cam;
uniform mat3 u_basis;
uniform mat3 u_gal;
uniform vec4 u_sun;
uniform vec3 u_sunCol;
uniform vec4 u_wind;
uniform vec2 u_orbit;
uniform vec4 u_meteor2;
uniform vec4 u_wpuff[6];
uniform vec4 u_sunDisk;
uniform vec4 u_moon;
uniform vec4 u_moon2;
uniform vec4 u_moon3;
uniform vec3 u_moonCol;
const float earthR = 6371000.0;
const float scaleH = 8000.0;
const float horizonMass = 35.4;
const float tangentSigma = 225000.0;
const float deckBase = 2600.0;
const float deckCell = 2400.0;
const float cirrusBase = 8500.0;
const float cirrusTau = 0.9;
const float airglowAlt = 95000.0;
const float lightGain = 1.6;
const float glareText = 0.3;
const float homeCeiling = 0.17;
const float milkyGain = 0.2;
const float starTail = 0.6;
const float starWidth = 0.0034;
const vec3 spaceColor = vec3(0.004, 0.007, 0.022);
const vec3 nightLight = vec3(0.02, 0.032, 0.075);

float pixAngle;
float eyeR;
float cellScale;
vec3 tauA;
vec3 scatterK;

vec3 camRay(vec2 fc) {
  float k = u_cam.x / ((1.0 - u_cam.y) * u_res.y);
  vec2 w = vec2(fc.x - 0.5 * u_res.x, fc.y - u_cam.y * u_res.y) * k;
  float r2 = dot(w, w);
  pixAngle = 2.0 * k / (1.0 + r2);
  return normalize(u_basis * (vec3(2.0 * w, 1.0 - r2) / (1.0 + r2)));
}

float hgPhase(float mu, float g) {
  float g2 = g * g;
  return (1.0 - g2) / pow(max(1.0 + g2 - 2.0 * g * mu, 0.0001), 1.5);
}

float noise3(vec3 p) {
  float k = floor(p.z);
  float f = fract(p.z);
  f = f * f * (3.0 - 2.0 * f);
  return mix(noise(p.xy + k * vec2(17.13, 31.71)), noise(p.xy + (k + 1.0) * vec2(17.13, 31.71)), f);
}

float milkyWay(vec3 rd) {
  vec3 g = u_gal * rd;
  float b = asin(clamp(g.z, -1.0, 1.0));
  float lxy = max(length(g.xy), 0.0001);
  float cl = g.x / lxy;
  float sl = g.y / lxy;
  float clump = noise3(g * 9.0 + 4.0) * 0.6 + noise3(g * 23.0) * 0.4;
  float band = exp(-b * b / 0.02) * (0.55 + 0.9 * clump);
  float glow = exp(-b * b / 0.1) * 0.3;
  float center = 0.4 + 0.6 * pow(0.5 + 0.5 * cl, 2.0);
  float bulge = exp(-(1.0 - cl) * 9.0 - b * b / 0.016) * (0.7 + 0.6 * clump);
  float rift = exp(-pow((b + 0.012) / 0.028, 2.0)) * smoothstep(-0.15, 0.2, sl) * smoothstep(-0.2, 0.3, cl) * (0.55 + 0.45 * noise3(g * 31.0));
  return (band * center + glow * center + bulge) * (1.0 - 0.8 * rift);
}

float bodyMask;

void tangent(vec3 d, out vec3 r, out vec3 u) {
  r = normalize(cross(vec3(0.0, 1.0, 0.0), d));
  u = cross(d, r);
}

float textCap(vec2 fc) {
  float k = 1.0;
  float feather = 28.0 * u_res.y / 900.0;
  for (int i = 0; i < 3; i++) {
    vec4 b = u_txt[i];
    if (b.z > b.x) {
      vec2 q = max(max(b.xy - fc, fc - b.zw), 0.0);
      k = min(k, mix(1.0, glareText, 1.0 - smoothstep(0.0, feather, length(q))));
    }
  }
  return k;
}

float mare(vec2 p) {
  float m = 0.0;
  m += exp(-dot(p - vec2(-0.3, 0.42), p - vec2(-0.3, 0.42)) / 0.045);
  m += exp(-dot(p - vec2(0.17, 0.38), p - vec2(0.17, 0.38)) / 0.02);
  m += exp(-dot(p - vec2(0.36, 0.12), p - vec2(0.36, 0.12)) / 0.03);
  m += exp(-dot(p - vec2(0.72, 0.3), p - vec2(0.72, 0.3)) / 0.008);
  m += exp(-dot(p - vec2(0.58, -0.16), p - vec2(0.58, -0.16)) / 0.016);
  m += exp(-dot(p - vec2(0.36, -0.28), p - vec2(0.36, -0.28)) / 0.01);
  m += exp(-dot(p - vec2(-0.2, -0.36), p - vec2(-0.2, -0.36)) / 0.022);
  m += exp(-dot(p - vec2(-0.47, -0.42), p - vec2(-0.47, -0.42)) / 0.008);
  m += exp(-dot((p - vec2(-0.62, 0.1)) * vec2(1.0, 0.7), (p - vec2(-0.62, 0.1)) * vec2(1.0, 0.7)) / 0.06);
  m += exp(-pow((p.y - 0.74) / 0.06, 2.0)) * smoothstep(0.7, 0.2, abs(p.x)) * 0.6;
  m = clamp(m, 0.0, 1.0) * (0.75 + 0.5 * noise(p * 9.0 + 3.0));
  float tycho = exp(-dot(p - vec2(-0.12, -0.74), p - vec2(-0.12, -0.74)) / 0.0015);
  return clamp(m, 0.0, 1.0) - tycho * 0.6;
}

vec3 sunAndMoon(vec3 rd, vec2 fc, float vis) {
  bodyMask = 0.0;
  vec3 add = vec3(0.0);
  float pix = pixAngle;
  vec3 r;
  vec3 u;
  vec3 s = u_sun.xyz;
  float cs = dot(rd, s);
  if (u_sunDisk.y > 0.0 && cs > 0.0) {
    tangent(s, r, u);
    vec3 dv = rd - s;
    vec2 o = vec2(dot(dv, r), dot(dv, u) / u_sunDisk.w) / u_sunDisk.x;
    float rr = length(o);
    float edge = pix / u_sunDisk.x;
    float disk = smoothstep(1.0 + edge, 1.0 - edge, rr);
    float mu = sqrt(max(1.0 - rr * rr, 0.0));
    float a = length(dv);
    float shape = 0.45 * exp(-a / 0.012) + 0.12 * exp(-a / 0.05) + 0.01 * exp(-a / 0.2);
    float cap = textCap(fc);
    add += hz(u_sunCol) * (disk * vis * u_sunDisk.y * (0.42 + 0.58 * mu) + shape * u_sunDisk.z * cap);
    vec3 sc = vec3(dot(s, u_basis[0]), dot(s, u_basis[1]), dot(s, u_basis[2]));
    vec2 sunPx = vec2(0.5 * u_res.x, u_cam.y * u_res.y) + sc.xy / (1.0 + sc.z) * ((1.0 - u_cam.y) * u_res.y / u_cam.x);
    vec2 dir = normalize(fc - sunPx + vec2(0.0001, 0.0));
    float t = u_time;
    float out1 = max(rr - 1.0, 0.0);
    float rise = smoothstep(0.95, 1.35, rr);
    float angle = noise(dir * 18.0 + vec2(t * 0.05, -t * 0.04));
    float lengthMix = noise(dir * 5.0 + vec2(-t * 0.03, t * 0.025) + 4.0) * (0.5 + 0.8 * noise(dir * 11.0 + 2.0));
    float thin = smoothstep(0.6, 0.93, angle) * (0.75 + 0.25 * sin(t * 0.9 + angle * 40.0));
    float reachR = 1.2 + 9.0 * lengthMix * lengthMix * 2.2;
    float rays = thin * exp(-out1 / reachR) * smoothstep(1.05, 1.6, rr);
    vec3 tint = mix(vec3(1.0, 0.87, 0.68), vec3(0.8, 0.89, 1.0), smoothstep(0.0, 6.0, out1));
    float halo = 0.42 * exp(-out1 / 0.45) + 0.11 * exp(-out1 / 2.0) + 0.03 * exp(-out1 / 8.0);
    add += hz(u_sunCol * tint) * (rays * 0.5 + halo) * rise * u_sunDisk.z * vis;
    bodyMask = max(disk * vis, clamp((0.45 * exp(-a / 0.012) + 0.12 * exp(-a / 0.05)) * u_sunDisk.z * 3.0, 0.0, 1.0) * cap);
  }
  vec3 m = u_moon.xyz;
  float cm = dot(rd, m);
  if (u_moon3.x > 0.0 && cm > 0.0) {
    tangent(m, r, u);
    vec3 dv = rd - m;
    vec2 o = vec2(dot(dv, r), dot(dv, u) / u_moon3.w) / u_moon.w;
    float rr = length(o);
    float edge = pix / u_moon.w;
    float a = length(dv);
    vec3 moonTint = vec3(1.0, 0.96, 0.9);
    float halo = u_moon3.y * (0.3 * exp(-a / 0.02) + 0.07 * exp(-a / 0.08) + 0.012 * exp(-a / 0.3)) * textCap(fc);
    add += hz(moonTint) * halo;
    if (rr < 1.0 + edge) {
      float disk = smoothstep(1.0 + edge, 1.0 - edge, rr) * vis;
      vec2 oc = o / max(rr, 1.0);
      vec3 n = vec3(oc, sqrt(max(1.0 - dot(oc, oc), 0.0)));
      float la = u_moon2.y;
      float si = sqrt(max(1.0 - u_moon2.x * u_moon2.x, 0.0));
      vec3 L = vec3(vec2(-sin(la), cos(la)) * si, u_moon2.x);
      float lit = smoothstep(-0.03, 0.05, dot(n, L));
      float q = u_moon2.z;
      vec2 sel = vec2(dot(oc, vec2(cos(q), -sin(q))), dot(oc, vec2(sin(q), cos(q))));
      float alb = mix(1.0, 0.58, mare(sel)) * (0.92 + 0.08 * noise(sel * 40.0));
      float shine = lit * alb + u_moon2.w * (1.0 - lit) * alb;
      add *= 1.0 - disk;
      add += hz(moonTint) * u_moon3.x * shine * disk;
      bodyMask = max(bodyMask, disk);
    }
  }
  return add;
}

float rho(float h) {
  return exp(-max(h, 0.0) / scaleH);
}

float depress(float h) {
  return acos(earthR / (earthR + max(h, 0.0)));
}

float nearShare(float t) {
  return sqrt(1.0 - exp(-0.6366 * t * t / (tangentSigma * tangentSigma)));
}

float skyMass(vec3 rd, float sinN, float down) {
  if (rd.y >= 0.0) return rho(u_cam.z) * airmass(asin(min(rd.y, 1.0)));
  float tangent = max(eyeR * sinN - earthR, 0.0);
  return horizonMass * rho(tangent) * (1.0 + nearShare(eyeR * down));
}

vec3 airLight(vec3 n, float h) {
  float el = asin(clamp(dot(n, u_sun.xyz), -1.0, 1.0));
  float dip = depress(h);
  float lit = smoothstep(-dip - 0.09, -dip + 0.12, el);
  return sunTint(tauA, el + dip) * lit;
}

vec3 scatter(float mass, vec3 light, float mu) {
  vec3 s = scatterK / tauA * (1.0 - exp(-tauA * mass));
  float ph = 0.52 * (1.0 + mu * mu) + 0.04 * hgPhase(mu, 0.76);
  return s * light * ph * lightGain;
}

float shellHit(float radius, float sinN, float down) {
  float rr = radius / eyeR;
  return eyeR * (down - sqrt(max(rr * rr - sinN * sinN, 0.0)));
}

vec2 surfaceCoords(vec3 n) {
  float ring = length(n.xz);
  return n.xz / max(ring, 0.000001) * (atan(ring, n.y) * earthR);
}

vec3 surfaceLight(vec3 n) {
  float sunHere = dot(n, u_sun.xyz);
  float elS = asin(clamp(sunHere, -1.0, 1.0));
  float day = smoothstep(-0.09, 0.28, sunHere);
  vec3 direct = sunTint(tauA, elS) * (0.2 + 1.3 * max(sunHere, 0.0)) * day;
  vec3 sky = vec3(0.26, 0.33, 0.46) * smoothstep(-0.22, 0.3, sunHere);
  float moonK = 0.5 * (1.0 + u_moon2.x);
  vec3 moon = vec3(0.85, 0.92, 1.05) * 0.3 * pow(moonK, 1.5) * smoothstep(-0.05, 0.2, dot(n, u_moon.xyz));
  return direct + sky + moon + nightLight * 0.6;
}

float layerDensity(vec2 q, float keep, float fine, out float detail) {
  float cov = clamp(u_weather.x, 0.0, 1.0);
  float ov = u_weather.y;
  float cell = deckCell * cellScale;
  vec2 warp = vec2(fbm3(q / (cell * 6.0)), fbm3(q / (cell * 6.0) + 5.2)) - 0.5;
  float n = 0.65 * fbm(q / cell + warp * 1.8) + 0.35 * fbm3(q / (cell * 7.0) + 11.0);
  for (int i = 0; i < 6; i++) {
    vec4 w = u_wpuff[i];
    if (w.w > 0.001) {
      vec2 d = (q - w.xy) / w.z;
      n += w.w * 0.3 * exp(-dot(d, d));
    }
  }
  n = mix(0.484, n, keep);
  float shape = smoothstep(0.58 - 0.4 * cov, 0.88 - 0.32 * cov, n);
  shape = mix(shape, 1.0, ov * 0.9);
  detail = fine > 0.01 ? mix(0.5, fbm3(q / (cell * 0.21) + 3.7), fine) : 0.5;
  return clamp(shape * (0.45 + 1.1 * detail) - 0.18 * (1.0 - detail), 0.0, 1.0) * smoothstep(0.02, 0.3, max(cov, ov));
}

float cirrusDensity(vec2 q, float keep) {
  if (u_weather.z <= 0.0) return 0.0;
  vec2 s = vec2(q.x * 0.8 + q.y * 0.6, -q.x * 0.6 + q.y * 0.8);
  float n = fbm(vec2(s.x / (16000.0 * cellScale), s.y / (2800.0 * cellScale))) + (fbm3(s / (700.0 * cellScale)) - 0.45) * 0.2 * keep;
  n = mix(0.484, n, keep);
  return smoothstep(0.5, 0.82, n) * u_weather.z;
}

vec3 skyColor(vec3 rd, float sinN, float down, float mu) {
  float mass = skyMass(rd, sinN, down);
  float through = exp(-tauA.g * mass);
  bool below = rd.y < 0.0;
  vec3 nca = below ? vec3(rd.x * down, sinN * sinN, rd.z * down) / max(sinN, 0.0001) : vec3(0.0, 1.0, 0.0);
  float hT = below ? max(eyeR * sinN - earthR, 0.0) : u_cam.z;
  float seen = dot(nca, u_sun.xyz);
  vec3 light = airLight(nca, hT) + nightLight;
  vec3 col = spaceColor + hz(scatter(mass, light, mu));
  float glow = exp(-pow((hT - airglowAlt) / 9000.0, 2.0)) * smoothstep(0.1, -0.2, seen) * smoothstep(0.02, -0.04, rd.y);
  col += vec3(0.1, 0.42, 0.22) * glow * 0.22;
  float moonSky = clamp(u_moonCol.r * 25.0, 0.0, 1.0);
  float dark = through * (1.0 - 0.85 * moonSky) * mix(1.0, 0.35, u_daylight.x);
  col += hz(vec3(0.82, 0.84, 0.95)) * milkyWay(rd) * milkyGain * dark;
  return col;
}

vec3 earthColor(vec3 rd, float sinN, float down, float mu, vec2 p) {
  float sG = min(sinN, earthR / eyeR);
  float tG = shellHit(earthR, sG, down);
  vec3 n = vec3(rd.x * tG, eyeR + rd.y * tG, rd.z * tG) / earthR;
  float cosV = clamp(-dot(rd, n), 0.0, 1.0);
  float mpp = tG * pixAngle / max(cosV, 0.03);
  vec2 qg = surfaceCoords(n) + u_orbit;
  float keepG = 1.0 - smoothstep(9000.0, 60000.0, mpp);
  float terrain = mix(0.5, noise(qg / 70000.0) * 0.6 + noise(qg / 14000.0) * 0.4, keepG);
  vec3 alb = mix(vec3(0.05, 0.065, 0.048), vec3(0.12, 0.105, 0.075), terrain);
  vec3 surf = alb * surfaceLight(n);
  if (u_clouds > 0.5) {
    float rD = earthR + deckBase;
    float sD = min(sinN, rD / eyeR);
    float tD = shellHit(rD, sD, down);
    vec3 nD = vec3(rd.x * tD, eyeR + rd.y * tD, rd.z * tD) / rD;
    float mppD = tD * pixAngle / max(-dot(rd, nD), 0.03);
    float cell = deckCell * cellScale;
    float keepD = 1.0 - smoothstep(0.35 * cell, 2.2 * cell, mppD);
    float fineD = 1.0 - smoothstep(0.04 * cell, 0.21 * cell, mppD);
    vec2 qD = surfaceCoords(nD) + u_wind.xy + u_orbit;
    float detail;
    float dens = layerDensity(qD, keepD, fineD, detail);
    if (dens > 0.002) {
      float tau = dens * mix(0.9, 2.4, clamp(u_weather.x, 0.0, 1.0)) * 1.5;
      float alpha = 1.0 - exp(-tau);
      float detailAside;
      float aside = layerDensity(qD + normalize(u_sun.xz + vec2(0.0001, 0.0)) * cell * 0.3, keepD, 0.0, detailAside);
      float sunward = exp(-aside * 1.8);
      vec3 cloud = surfaceLight(nD) * 0.9 * (0.55 + 0.6 * sunward) * (0.82 + 0.36 * detail);
      surf = mix(surf, cloud, alpha);
    }
  }
  float eyePart = rho(u_cam.z) * airmass(asin(min(down, 1.0)));
  float mass = max(airmass(asin(cosV)) - eyePart, 0.0);
  vec3 light = airLight(n, 0.0) + nightLight;
  return hz(surf * exp(-tauA * mass) + scatter(mass, light, mu));
}

vec3 shootingStar(vec4 m, vec2 ps) {
  if (m.w >= 1.0) return vec3(0.0);
  vec2 md = vec2(cos(m.z), sin(m.z));
  vec2 rel = ps - (m.xy + md * m.w * meteorTravel);
  float behind = dot(rel, -md);
  float t = clamp(behind / starTail, 0.0, 1.0);
  float across = dot(rel, vec2(-md.y, md.x)) / (starWidth * mix(1.0, 0.3, t));
  float trail = pow(1.0 - t, 1.6) * step(-0.004, behind) * exp(-across * across);
  float spark = 0.85 + 0.15 * sin(behind * 380.0 - m.w * 40.0);
  float head = exp(-dot(rel, rel) / 0.00007);
  float halo = exp(-dot(rel, rel) / 0.0016);
  vec3 tint = mix(vec3(0.82, 0.92, 1.0), vec3(1.0, 0.72, 0.45), t);
  return (tint * trail * spark * 1.5 + vec3(0.95, 0.98, 1.0) * (head * 2.2 + halo * 0.22)) * sin(PI * m.w);
}

void main() {
  vec2 fc = u_probe.z > 0.0 ? gl_FragCoord.xy * u_probe.zw + u_probe.xy : gl_FragCoord.xy;
  vec3 rd = camRay(fc);
  vec2 p = (fc - 0.5 * u_res) / u_view;
  vec2 ps = p + u_pointer;
  float sunUp = u_daylight.x;
  eyeR = earthR + u_cam.z;
  cellScale = 1.0 + 7.0 * smoothstep(5000.0, 120000.0, u_cam.z);
  float aod = haze * mix(0.7, 1.0, u_daylight.z);
  tauA = tauRay + aerosol * aod;
  scatterK = tauRay + aerosol * aod * 0.8;
  float sinN = length(rd.xz);
  float down = max(-rd.y, 0.0);
  float mu = dot(rd, u_sun.xyz);
  float rhoL = (earthR + deckBase) / eyeR;
  float margin = rd.y >= 0.0 ? 9.0 : (sinN - rhoL) / max(down, 0.04);
  float cover = 1.0 - smoothstep(-0.75, 0.75, margin / pixAngle);

  vec3 col = vec3(0.0);
  if (cover < 1.0) col += (1.0 - cover) * skyColor(rd, sinN, down, mu);
  if (cover > 0.0) col += cover * earthColor(rd, sinN, down, mu, p);

  float rC = earthR + cirrusBase;
  if (u_clouds > 0.5 && u_weather.z > 0.0 && rd.y < 0.0 && sinN < rC / eyeR) {
    float tC = shellHit(rC, sinN, down);
    vec3 nC = vec3(rd.x * tC, eyeR + rd.y * tC, rd.z * tC) / rC;
    float cell = 16000.0 * cellScale;
    float mppC = tC * pixAngle / max(-dot(rd, nC), 0.03);
    float keepC = 1.0 - smoothstep(0.35 * cell, 2.2 * cell, mppC);
    float m = cirrusDensity(surfaceCoords(nC) + u_wind.zw + u_orbit, keepC);
    if (m > 0.0) col = mix(col, hz(surfaceLight(nC) * 1.05), 1.0 - exp(-m * cirrusTau * 1.3));
  }

  col += sunAndMoon(rd, fc, 1.0 - cover);

  col += (shootingStar(u_meteor, ps) + shootingStar(u_meteor2, ps)) * (1.0 - cover) * mix(1.0, 0.8, sunUp);

  col = max(hueRotate(col * brightness, hueShift), 0.0);
  col = 1.0 - exp(-col * 1.15);
  float roll = smoothstep(0.0, 0.3, sunUp) * (1.0 - bodyMask) * textNear(fc, 260.0 * u_res.y / 900.0);
  if (roll > 0.0) {
    vec3 lin = srgbToLinear(col);
    float lum = dot(lin, luma);
    if (lum > dayKnee) {
      float room = homeCeiling - dayKnee;
      float soft = dayKnee + room * (1.0 - exp((dayKnee - lum) / room));
      col = linearToSrgb(lin * mix(1.0, soft / lum, roll));
    }
  }
  col = capText(col, textNear(fc, 64.0 * u_res.y / 900.0), textCeiling);
  col += (fract(52.9829189 * fract(dot(fc, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;
