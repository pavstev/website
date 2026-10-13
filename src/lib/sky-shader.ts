export const skyVertexShader = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

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
const float starAmount = 0.78;
const float twinkle = 0.25;
const float skyTop = 0.5;
const float starTop = 1.7;
const float dayLift = 0.87;
const float dayTint = 1.6;
const float dayGain = 1.6731;
const float starFade = 0.75;
const float meteorTail = 0.35;
const float meteorTravel = 0.75;
const float meteorWidth = 0.0028;
const float haze = 0.21;
const float cityGlow = 0.65;
const float precip = 0.5;
const vec3 lampColor = vec3(1.5217, 0.9125, 0.331);
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
float nightSky;
vec3 underLight;
float flashX;

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

export const textShade = `
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
uniform vec2 u_look;
uniform vec4 u_sun;
uniform vec3 u_sunCol;
uniform vec3 u_amb;
uniform vec4 u_wind;
uniform vec2 u_ground;
uniform vec4 u_wpuff[6];
uniform vec4 u_sunDisk;
uniform vec4 u_moon;
uniform vec4 u_moon2;
uniform vec4 u_moon3;
uniform vec3 u_moonCol;

const float cloudBase = 1500.0;
const float cloudCeiling = 2500.0;
const float cloudReachView = 0.62;
const float cloudCell = 1800.0;
const float silverLining = 0.6;
const float edgeGlow = 1.0;
const float cirrusAmount = 1.0;
const float cloudSteps = 7.0;
const float glowAmount = 1.6;
const float streetAmount = 1.0;
const float trafficAmount = 1.0;
const float parkDepth = 1450.0;
const float visibility = 16000.0;
const float lampAmount = 1.0;
const float glareText = 0.3;
const float homeCeiling = 0.17;

vec3 camRay(vec2 fc) {
  vec3 d = vec3((fc.x - 0.5 * u_res.x) / u_view, fc.y / u_view - u_cam.y, u_cam.x);
  float cp = cos(u_look.y);
  float sp = sin(u_look.y);
  d = vec3(d.x, cp * d.y + sp * d.z, -sp * d.y + cp * d.z);
  float cy = cos(u_look.x);
  float sy = sin(u_look.x);
  d = vec3(cy * d.x + sy * d.z, d.y, -sy * d.x + cy * d.z);
  return normalize(d);
}

float hgPhase(float mu, float g) {
  float g2 = g * g;
  return (1.0 - g2) / pow(max(1.0 + g2 - 2.0 * g * mu, 0.0001), 1.5);
}

float cumH(vec2 q, float lod) {
  vec2 s = q / cloudCell;
  float n = lod > 0.5 ? fbm3(s) + 0.047 : fbm(s);
  float cov = clamp(u_weather.x, 0.0, 1.0);
  for (int i = 0; i < 6; i++) {
    vec4 w = u_wpuff[i];
    if (w.w > 0.001) {
      vec2 d = (q - w.xy) / w.z;
      n += w.w * 0.3 * exp(-dot(d, d));
    }
  }
  float H = clamp((n - (0.68 - 0.4 * cov)) / 0.13, 0.0, 1.0);
  return H * (0.72 + 0.28 * noise(q / (cloudCell * 0.17) + 4.7)) * smoothstep(0.02, 0.3, cov);
}

float noise3(vec3 p) {
  float k = floor(p.z);
  float f = fract(p.z);
  f = f * f * (3.0 - 2.0 * f);
  return mix(noise(p.xy + k * vec2(17.13, 31.71)), noise(p.xy + (k + 1.0) * vec2(17.13, 31.71)), f);
}

float cumField(vec3 rd, float t, float lod) {
  vec3 pos = rd * t;
  float hf = (pos.y + u_cam.z - cloudBase) / (cloudCeiling - cloudBase);
  if (hf < 0.0 || hf > 1.0) return -1.0;
  vec2 q = pos.xz + u_wind.xy;
  float H = cumH(q, lod);
  if (H <= 0.0) return -1.0;
  float z = hf * (cloudCeiling - cloudBase);
  float b = noise3(vec3(q, z) / 360.0) * 0.62 + noise3(vec3(q.yx, z) / 140.0 + 5.3) * 0.38;
  return H - hf * hf * 0.9 - 0.03 + (b - 0.5) * mix(0.2, 0.55, hf);
}

float cumLight(vec2 q, float hf) {
  if (hf < 0.0 || hf > 1.0) return 0.0;
  return smoothstep(-0.04, 0.28, cumH(q, 1.0) - hf * hf * 0.9 - 0.03);
}

vec4 cumulus(vec3 rd, float ys, float px) {
  if (rd.y < 0.004) return vec4(0.0);
  float rise = cloudBase - u_cam.z;
  float t0 = rise / rd.y;
  float far = 70000.0;
  if (t0 > far) return vec4(0.0);
  float thick = cloudCeiling - cloudBase;
  float t1 = min((cloudCeiling - u_cam.z) / rd.y, t0 + 3.0 * thick);
  float n = cloudSteps;
  float dt = (t1 - t0) / n;
  float lod = smoothstep(9000.0, 14000.0, t0);
  float jit = 0.25 + 0.5 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float ta = t0;
  float th = -1.0;
  for (int i = 0; i < 10; i++) {
    if (float(i) >= n) break;
    float tt = t0 + dt * (float(i) + jit);
    if (cumField(rd, tt, lod) > -0.02) {
      float tb = tt;
      for (int k = 0; k < 4; k++) {
        float tm = 0.5 * (ta + tb);
        if (cumField(rd, tm, lod) > -0.02) tb = tm; else ta = tm;
      }
      th = tb;
      break;
    }
    ta = tt;
  }
  if (th < 0.0) return vec4(0.0);
  float f0 = cumField(rd, th + 40.0, lod);
  float f1 = cumField(rd, th + 160.0, lod);
  float f2 = cumField(rd, th + 450.0, lod);
  float d0 = smoothstep(-0.02, 0.2, f0);
  float d1 = smoothstep(-0.02, 0.2, f1);
  float d2 = smoothstep(-0.02, 0.2, f2);
  float alpha = 1.0 - exp(-(d0 * 0.6 + d1 * 1.6 + d2 * 2.6) * 1.3);
  vec3 pos = rd * th;
  float hf = clamp((pos.y + u_cam.z - cloudBase) / thick, 0.0, 1.0);
  vec2 q = pos.xz + u_wind.xy;
  vec3 sd = u_sun.xyz;
  vec3 ls = sd * 220.0;
  float l1 = cumLight(q + ls.xz, hf + ls.y / thick);
  float l2 = cumLight(q + ls.xz * 3.0, hf + ls.y * 3.0 / thick);
  float tsun = exp(-(l1 + l2 * 1.6) * 1.5 - d1 * 0.3);
  float ph = mix(1.0, hgPhase(dot(rd, sd), silverLining), 0.5);
  float edge = 1.0 - d1;
  vec3 light = u_sunCol * tsun * ph * (1.0 + edge * edgeGlow * max(ph - 1.0, 0.0) * 0.6);
  float mph = mix(1.0, hgPhase(dot(rd, u_moon.xyz), silverLining), 0.5);
  light += u_moonCol * (0.5 + 0.5 * tsun) * mph * (0.7 + 0.6 * edge);
  light += u_amb * mix(0.45, 1.15, hf) * (0.85 + 0.15 * edge);
  float fd = (px - flashX) / 0.4;
  light += underLight * (1.0 - hf) * 2.2 + vec3(0.75, 0.8, 1.0) * flashAmt * exp(-fd * fd) * 6.0 * (1.0 - 0.5 * hf);
  alpha *= smoothstep(far, far * 0.4, t0) * smoothstep(cloudReachView + 0.14, cloudReachView - 0.14, ys);
  return vec4(light, alpha);
}

vec4 cirrus(vec3 rd) {
  if (rd.y < 0.012) return vec4(0.0);
  float t = (8500.0 - u_cam.z) / rd.y;
  vec2 q = rd.xz * t + u_wind.zw;
  vec2 s = vec2(q.x * 0.8 + q.y * 0.6, -q.x * 0.6 + q.y * 0.8);
  float n = fbm(vec2(s.x / 16000.0, s.y / 2800.0)) + (fbm3(s / 700.0) - 0.45) * 0.2;
  float m = smoothstep(0.5, 0.82, n) * u_weather.z * cirrusAmount;
  m *= smoothstep(0.012, 0.09, rd.y) * smoothstep(140000.0, 50000.0, t);
  if (m <= 0.0) return vec4(0.0);
  vec3 c = u_sunCol * 0.6 * mix(1.0, hgPhase(dot(rd, u_sun.xyz), 0.55), 0.4) + u_amb * 1.15 + underLight * 0.5;
  return vec4(c, m * 0.6);
}

float lampDot(float al, float pe, vec2 dir, float sp, vec2 hd, vec2 pd, float dn, float mpp, float stretch) {
  vec2 nrm = vec2(dir.y, -dir.x);
  float k = u_labPx / 1.6;
  vec2 ow = nrm * pe + dir * ((fract(al / sp) - 0.5) * sp);
  float pt = smoothstep(1.3, 0.0, length(vec2(dot(ow, pd), dot(ow, hd) * dn * stretch) / mpp * k));
  float spPx = sp * (abs(dot(dir, pd)) + abs(dot(dir, hd)) * dn) / mpp;
  vec2 ln = nrm * pe;
  float line = smoothstep(1.3, 0.0, length(vec2(dot(ln, pd), dot(ln, hd) * dn) / mpp * k)) * 1.1 / max(spPx, 1.0);
  return mix(pt, line, smoothstep(4.0, 1.5, spPx));
}

vec3 streets(vec2 q, vec2 hd, vec2 pd, float dn, float mpp, float wet, float on) {
  vec3 sodium = vec3(1.0, 0.55, 0.22);
  vec3 led = vec3(0.85, 0.9, 1.0);
  float st = mix(1.0, 0.15, wet);
  vec3 c = vec3(0.0);
  float tt = u_time * 9.0;
  vec2 d1 = vec2(sin(-0.244), cos(-0.244));
  float al1 = dot(q, d1);
  float pe1 = dot(q, vec2(d1.y, -d1.x));
  c += sodium * (lampDot(al1, pe1 - 11.0, d1, 32.0, hd, pd, dn, mpp, st) + lampDot(al1 + 16.0, pe1 + 11.0, d1, 32.0, hd, pd, dn, mpp, st)) * on;
  float car1 = lampDot(al1 + tt, pe1 - 3.5, d1, 47.0, hd, pd, dn, mpp, st) * step(0.45, hash(vec2(floor((al1 + tt) / 47.0), 3.0)));
  float car2 = lampDot(al1 - tt * 0.8, pe1 + 3.5, d1, 53.0, hd, pd, dn, mpp, st) * step(0.4, hash(vec2(floor((al1 - tt * 0.8) / 53.0), 5.0)));
  c += (vec3(1.0, 0.95, 0.85) * car2 * 1.4 + vec3(1.0, 0.08, 0.05) * car1) * trafficAmount * on;
  vec2 cen = vec2(sin(-0.157), cos(-0.157)) * 1980.0;
  vec2 r = q - cen;
  float rl = length(r);
  vec2 rad = r / max(rl, 0.001);
  vec2 tg = vec2(-rad.y, rad.x);
  float ang = atan(r.y, r.x);
  float pe2 = rl - 650.0;
  if (abs(pe2) < 40.0) {
    c += led * (lampDot(ang * 650.0, pe2 - 14.0, tg, 30.0, hd, pd, dn, mpp, st) + lampDot(ang * 650.0 + 15.0, pe2 + 14.0, tg, 30.0, hd, pd, dn, mpp, st)) * on;
    float cr = lampDot(ang * 650.0 + tt, pe2 - 4.0, tg, 41.0, hd, pd, dn, mpp, st) * step(0.4, hash(vec2(floor((ang * 650.0 + tt) / 41.0), 9.0)));
    float cw = lampDot(ang * 650.0 - tt, pe2 + 4.0, tg, 37.0, hd, pd, dn, mpp, st) * step(0.4, hash(vec2(floor((ang * 650.0 - tt) / 37.0), 11.0)));
    c += (vec3(1.0, 0.08, 0.05) * cr + vec3(1.0, 0.95, 0.85) * cw * 1.3) * trafficAmount * on;
  }
  float pe3 = rl - 3300.0;
  if (abs(pe3) < 60.0) c += sodium * (lampDot(ang * 3300.0, pe3 - 18.0, tg, 34.0, hd, pd, dn, mpp, st) + lampDot(ang * 3300.0 + 17.0, pe3 + 18.0, tg, 34.0, hd, pd, dn, mpp, st)) * on;
  vec2 d4 = vec2(sin(0.95), cos(0.95));
  vec2 o4 = vec2(sin(0.28), cos(0.28)) * 1500.0;
  float al4 = dot(q - o4, d4);
  float pe4 = dot(q - o4, vec2(d4.y, -d4.x));
  if (abs(pe4) < 40.0 && al4 > -100.0) c += sodium * (lampDot(al4, pe4 - 10.0, d4, 30.0, hd, pd, dn, mpp, st) + lampDot(al4 + 15.0, pe4 + 10.0, d4, 30.0, hd, pd, dn, mpp, st)) * on;
  return c * streetAmount;
}

vec3 ground(vec3 sky, vec3 rd, float sunUp) {
  float dn = max(-rd.y, 0.0004);
  float t = u_cam.z / dn;
  vec2 q = rd.xz * t;
  float mpp = t / (u_cam.x * u_view);
  float sn = u_ground.y;
  vec2 hd = normalize(rd.xz);
  vec2 pd = vec2(hd.y, -hd.x);
  float park = smoothstep(parkDepth + 60.0, parkDepth - 60.0, t);
  float n = mix(noise(q / 40.0) * 0.6 + noise(q / 9.0) * 0.4, 0.5, smoothstep(1.5, 8.0, mpp));
  vec3 alb = mix(vec3(0.045, 0.05, 0.047), vec3(0.09, 0.09, 0.085), n);
  float crown = mix(noise(q / 14.0) * 0.65 + noise(q / 5.0) * 0.35, 0.5, smoothstep(1.0, 5.0, mpp));
  alb = mix(alb, mix(vec3(0.018, 0.032, 0.02), vec3(0.05, 0.08, 0.04), crown), park);
  alb = mix(alb, vec3(0.8, 0.82, 0.86), sn * mix(0.92, 0.7, park));
  float shade = mix(1.0, 0.55 + 0.45 * crown, park);
  vec3 lit = alb * shade * (u_sunCol * max(sin(u_sun.w), 0.0) * 1.1 + u_amb * 1.3 + underLight * 3.0 * (1.0 - 0.8 * park));
  float wet = u_ground.x * (1.0 - sn) * (1.0 - park);
  float fres = 0.03 + 0.97 * pow(1.0 - dn, 6.0);
  lit = mix(lit, lit * 0.45 + sky * fres * 0.85, wet);
  float on = 1.0 - smoothstep(0.45, 0.85, u_daylight.x);
  if (on > 0.0) {
    if (park < 0.99) {
      float cell = 24.0;
      vec2 c = q / cell;
      vec2 id = floor(c);
      float keepL = step(0.5, hash(id + 0.7));
      vec2 o = (fract(c) - 0.5 - (vec2(hash(id + 1.3), hash(id + 2.9)) - 0.5) * 0.6) * cell;
      vec2 pp = vec2(dot(o, pd), dot(o, hd) * dn * mix(1.0, 0.1, wet)) / mpp * (u_labPx / 1.6);
      float pt = smoothstep(1.3, 0.0, length(pp)) * keepL;
      float cellPx = cell * dn / mpp;
      float avg = min(0.5 * 1.2 / max(cellPx * cell / mpp, 0.01), 0.6);
      float lamps = mix(pt, avg, smoothstep(3.5, 1.2, cellPx)) * (1.0 - park);
      lit += lampColor * lamps * 1.4 * on * lampAmount;
      lit += alb * lampColor * on * (0.05 + 0.4 * sn) * smoothstep(0.0, 0.2, dn) * (1.0 - park);
    }
    lit += streets(q, hd, pd, dn, mpp, u_ground.x * (1.0 - sn), on) * 1.5;
  }
  float vis = visibility * (1.0 - 0.9 * u_weather.w) * (1.0 - 0.45 * u_fall.x) * (1.0 - 0.35 * u_fall.y);
  return mix(hz(lit), sky, 1.0 - exp(-t / vis));
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

vec3 sunAndMoon(vec3 rd, vec2 fc) {
  bodyMask = 0.0;
  vec3 add = vec3(0.0);
  float pix = 1.0 / (u_view * u_cam.x);
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
    float shape = 0.5 * exp(-a / 0.0045) + 0.12 * exp(-a / 0.03) + 0.025 * exp(-a / 0.2) + 0.004 * hgPhase(cs, 0.7);
    float cap = textCap(fc);
    add += hz(u_sunCol) * (disk * u_sunDisk.y * (0.42 + 0.58 * mu) + shape * u_sunDisk.z * cap);
    bodyMask = max(disk, clamp((0.5 * exp(-a / 0.0045) + 0.12 * exp(-a / 0.03)) * u_sunDisk.z * 3.0, 0.0, 1.0) * cap);
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
    float halo = u_moon3.y * (0.3 * exp(-a / 0.012) + 0.07 * exp(-a / 0.06) + 0.012 * exp(-a / 0.3)) * textCap(fc);
    add += hz(moonTint) * halo;
    if (rr < 1.0 + edge) {
      float disk = smoothstep(1.0 + edge, 1.0 - edge, rr);
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
      add += hz(moonTint) * u_moon3.x * shine * disk;
      bodyMask = max(bodyMask, disk);
    }
  }
  return add;
}

void main() {
  vec2 fc = u_probe.z > 0.0 ? gl_FragCoord.xy * u_probe.zw + u_probe.xy : gl_FragCoord.xy;
  float ys = fc.y / u_view;
  vec3 rd = camRay(fc);
  float el = asin(clamp(rd.y, -1.0, 1.0));
  float yb = max(el, 0.0) / skyFov;
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
  float h = max(el, 0.0);
  float sunEl = u_sun.w;
  vec3 lampSky = mix(vec3(dot(lampColor, luma)), lampColor, 0.45);
  float amp = pow((1.0 + 9.1 * ov) * (1.0 + 18.0 * u_fall.y) * (1.0 + 4.0 * fogA), 0.33);
  float cityLight = 0.11 * cityGlow * amp * nightSky * glowAmount;
  vec3 band = sunTint(tau, sunEl);
  float bandLight = twi * openSky * openSky * mix(0.35, 1.65, pow(0.5 + 0.5 * dot(normalize(rd.xz + vec2(0.0, 0.0001)), normalize(u_sun.xz + vec2(0.0, 0.0001))), 2.0));
  underLight = lampSky * cityLight + band * bandLight * 0.45 + vec3(0.9, 0.92, 0.95) * sunUp * (1.0 - twi) * 0.03;
  vec3 night05 = vec3(0.02, 0.025, 0.05) + vec3(0.03, 0.05, 0.13) * 0.5 * skyTop * 2.0;
  vec3 base05 = mix(night05, mix(dayLow, dayTop, smoothstep(0.0, 1.2, 0.5)), day);
  vec3 ref = hz(clearSky(0.5 * skyFov, tau, aod));
  vec3 phys = hz(clearSky(h, tau, aod)) * dot(base05, luma) / max(dot(ref, luma), 0.0001);
  col = mix(col, phys, sunUp * (1.0 - 0.5 * twi) * 1.0);
  float trans = 1.0 / (1.0 + 0.1125 * (12.0 + 22.0 * u_fall.x + 30.0 * u_fall.z));
  float snowLift = 1.0 / (1.0 - 0.8 * (1.0 - trans) * u_fall.y);
  vec3 deckNight = vec3(0.03, 0.032, 0.04);
  vec3 deckDay = vec3(0.66, 0.68, 0.72) * sqrt(dayGain) * trans * snowLift * (1.0 + 2.0 * sin(h)) / 3.0 * 1.7;
  col = mix(col, hueRotate(mix(deckNight, deckDay, sunUp), -hueShift), ov * 0.85);
  col += stars(ps, t) * 0.55 * starKeep * (1.0 - 0.92 * ov) * smoothstep(0.0, 0.05, el);
  col += hz(lampSky) * cityLight * mix(1.0 - exp(-0.25 * airmass(h)), 0.75, ov * 0.6);
  col += hz(band) * (0.7 * exp(-yb * 4.0) + 0.07 * exp(-yb * 1.5)) * bandLight;
  col += hz(lampSky) * cityLight * exp(-yb * 9.0) * 1.6 * smoothstep(-0.01, 0.0, el);

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
  col += sunAndMoon(rd, fc);
  float cloudA = 0.0;
  if (u_clouds > 0.5 && rd.y > 0.0) {
    vec4 ci = cirrus(rd);
    if (ci.a > 0.0) col = mix(col, hz(ci.rgb), ci.a);
    vec4 cu = cumulus(rd, ys, p.x);
    cloudA = cu.a;
    if (cu.a > 0.0) {
      float air = 1.0 - exp(-((cloudBase - u_cam.z) / max(rd.y, 0.003)) / (visibility * 2.2));
      col = mix(col, mix(hz(cu.rgb), col, air), cu.a);
    }
  }

  if (u_fall.x > 0.0 && rd.y > -0.002) {
    vec2 hd = normalize(rd.xz);
    float dist = 7000.0;
    float yAt = rd.y / max(length(rd.xz), 0.001) * dist + u_cam.z;
    if (yAt < cloudBase) {
      vec2 sq = hd * dist + u_wind.xy * 0.5;
      float shaft = smoothstep(0.42, 0.72, fbm3(sq / 4200.0 + 3.1));
      float lines = 0.6 + 0.4 * noise(vec2(atan(hd.x, hd.y) * 700.0 + yAt * u_fall.w * 0.01, yAt * 0.004 - tr * 0.6));
      vec3 shaftCol = mix(vec3(0.05, 0.055, 0.07), vec3(0.32, 0.35, 0.4), sunUp);
      col = mix(col, hueRotate(shaftCol, -hueShift), u_fall.x * shaft * lines * smoothstep(cloudBase, cloudBase * 0.4, yAt) * 0.5);
    }
  }

  if (el < 0.0) col = ground(col, rd, sunUp);
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

  col = max(hueRotate(col * brightness, hueShift), 0.0);
  col = 1.0 - exp(-col * 1.15);
  float roll = max(smoothstep(0.0, 0.3, sunUp), step(0.0, el) * max(ov, cloudA)) * (1.0 - bodyMask);
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
