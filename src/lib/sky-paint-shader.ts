import { moonShader } from "./sky-moon-shader.ts";

export const noiseShader = `
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

float fbm(vec2 p, float oct) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 6; i++) {
    float w = clamp(oct - float(i), 0.0, 1.0);
    v += a * (w > 0.0 ? mix(0.5, noise(p), w) : 0.5);
    p = m * p + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}
`;

const paintHead = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_res;
uniform float u_time;
uniform float u_wind;
uniform float u_cumulus;
uniform float u_alto;
uniform float u_cirrus;
uniform vec3 u_top;
uniform vec3 u_mid;
uniform vec3 u_low;
uniform vec3 u_lit;
uniform vec3 u_shade;
uniform vec3 u_sunCol;
uniform vec3 u_sun;
uniform float u_sunUp;
uniform float u_glow;
uniform float u_ov;
uniform vec4 u_moon;
uniform vec3 u_moonCol;
uniform float u_moonGlow;
uniform float u_band;
uniform vec3 u_space;
uniform sampler2D u_lut;
uniform float u_lutMix;
uniform float u_grey;
uniform float u_cell;

const float cloudTones = 6.0;
const float cloudEdge = 0.1;
const vec3 luma = vec3(0.2126, 0.7152, 0.0722);

float T;
${noiseShader}
float tone(float x) {
  return floor(clamp(x, 0.0, 1.0) * (cloudTones - 1.0) + 0.5) / (cloudTones - 1.0);
}

vec2 cellAt(vec2 fc) {
  return (floor(fc / u_cell) + 0.5) * u_cell;
}

float bandMask(vec2 fc) {
  float yb = fc.y / u_res.y;
  return smoothstep(1.0 - u_band, 1.0 + u_band * 0.2, yb);
}

vec3 skyAt(vec2 fc) {
  float yb = fc.y / u_res.y;
  vec3 gradient = mix(u_low, u_mid, smoothstep(-0.05, 0.5, yb));
  gradient = mix(gradient, u_top, smoothstep(0.4, 1.05, yb));
  vec3 c = mix(gradient, mix(texture2D(u_lut, fc / u_res).rgb, gradient, u_grey), u_lutMix);
  float ds = length((fc - u_sun.xy) / u_res.y);
  c += u_sunCol * u_glow * (exp(-ds * 5.0) * 0.32 + exp(-ds) * 0.26);
  float dm = length((fc - u_moon.xy) / u_res.y);
  c += u_moonCol * u_moonGlow * (exp(-dm * 7.0) * 0.12 + exp(-dm * 2.0) * 0.05);
  c = mix(c, u_space, bandMask(fc));
  return c;
}
`;

export const paintCloudShader = `${paintHead}
uniform vec2 u_light;
uniform vec3 u_lightCol;
uniform float u_firstLayer;

vec4 layerOf(float L) {
  if (L < 0.5) return vec4(0.07, 0.085, 0.0045, 0.32);
  if (L < 1.5) return vec4(0.18, 0.14, 0.009, 0.5);
  return vec4(0.33, 0.24, 0.015, 0.82);
}

float shapeAt(vec2 p, float L, vec4 lp, out float baseOut, out float hgOut) {
  float cw = lp.w;
  float ci = floor(p.x / cw);
  float v = 0.0;
  float best = 0.0;
  baseOut = lp.x;
  hgOut = lp.y;
  for (int j = -1; j <= 1; j++) {
    float c = ci + float(j);
    vec2 hid = vec2(c, L * 17.0 + 3.0);
    if (hash(hid) > mix(0.2, 0.97, u_cumulus)) continue;
    float s = lp.y * (0.75 + 0.5 * hash(hid + 1.0));
    float cx = (c + 0.5 + (hash(hid + 2.0) - 0.5) * 0.5) * cw;
    float w = s * (1.3 + 2.2 * hash(hid + 3.0));
    if (abs(p.x - cx) > w * 0.5 + s * 0.6) continue;
    float hg = s * (0.5 + 1.2 * hash(hid + 4.0));
    float base = lp.x + (hash(hid + 5.0) - 0.5) * lp.y * 0.4 + (noise(vec2(p.x * 9.0 / s, c)) - 0.5) * 0.06 * s;
    float cv = 0.0;
    for (int k = 0; k < 7; k++) {
      float fk = float(k);
      float u = hash(hid + 6.0 + fk) - 0.5;
      float prof = 1.0 - 4.0 * u * u;
      vec2 b = vec2(cx + u * w, base + hg * (0.15 + 0.6 * hash(hid + 13.0 + fk)) * prof);
      float r = s * (0.26 + 0.22 * hash(hid + 21.0 + fk)) * (0.55 + 0.45 * prof);
      vec2 d = p - b;
      cv += exp(-dot(d, d) / (r * r));
    }
    cv *= smoothstep(base - 0.12 * s, base + 0.18 * s, p.y);
    if (cv > best) {
      best = cv;
      baseOut = base;
      hgOut = hg;
    }
    v += cv;
  }
  return v;
}

vec4 cumulus(vec2 fc, vec3 sky) {
  float vis = smoothstep(0.0, 0.08, u_cumulus);
  if (vis <= 0.0) return vec4(0.0);
  float H = u_res.y;
  vec2 p0 = vec2((fc.x - 0.5 * u_res.x) / H, fc.y / H);
  vec2 L2 = u_light - fc;
  vec2 dir = L2 / max(length(L2), 1.0);
  float ds = length(fc - u_sun.xy) / H;
  float above0 = u_light.y / H;
  vec3 acc = vec3(0.0);
  float aa = 0.0;
  for (int li = 0; li < 3; li++) {
    float L = float(li);
    if (L < u_firstLayer) continue;
    vec4 lp = layerOf(L);
    if (p0.y < lp.x - 0.3 * lp.y || p0.y > lp.x + 2.3 * lp.y) continue;
    vec2 p = p0 - vec2(u_wind * lp.z, 0.0);
    float base;
    float hg;
    float b2;
    float h2;
    float sh = shapeAt(p, L, lp, base, hg);
    if (sh < 0.12) continue;
    float n = fbm(p * (2.4 / lp.y) + vec2(L * 7.3, T * 0.01), 2.5);
    float d = smoothstep(0.0, 0.5, sh - 0.5 + (n - 0.5) * 0.5);
    if (d < cloudEdge) continue;
    vec2 pr = p + dir * u_cell / H;
    float shr = shapeAt(pr, L, lp, b2, h2);
    float nr = fbm(pr * (2.4 / lp.y) + vec2(L * 7.3, T * 0.01), 2.5);
    float rim = step(smoothstep(0.0, 0.5, shr - 0.5 + (nr - 0.5) * 0.5), cloudEdge);
    float occ = 0.0;
    for (int i = 1; i <= 3; i++) {
      occ += shapeAt(p + dir * lp.y * 0.22 * float(i), L, lp, b2, h2);
    }
    float lit = exp(-occ * 0.55);
    float vg = clamp((p.y - base) / max(hg * 1.3, 0.001), 0.0, 1.0);
    lit *= mix(1.0, 0.55 + 0.6 * vg, smoothstep(-0.1, 0.25, above0 - base));
    lit = clamp(lit * (0.85 + 0.3 * n), 0.0, 1.0);
    lit = tone(lit * mix(1.0, 0.8, smoothstep(0.35, 0.85, d)));
    float dt = tone(d);
    float near = exp(-length(fc - u_light) / H * 1.4);
    vec3 cc = mix(mix(u_shade, u_top, 0.3) * 0.9, mix(u_lit, u_lightCol, 0.4 * near), lit);
    cc += u_top * 0.16 * (1.0 - lit);
    cc += u_sunCol * u_sunUp * (exp(-ds * 3.0) + exp(-ds * 9.0) * 1.6) * (1.25 - dt) * (0.4 + 0.6 * lit);
    cc += u_lightCol * lit * 0.08;
    float dmn = length(fc - u_moon.xy) / H;
    cc += u_moonCol * u_moonGlow * (exp(-dmn * 3.0) * 0.5 + exp(-dmn * 9.0) * 0.9) * (1.25 - dt);
    cc = mix(cc, mix(u_lit, u_lightCol, 0.35 + 0.3 * near) * 1.2, rim * 0.85);
    cc *= clamp(dot(sky, luma) / max(dot(cc, luma), 0.001), 1.0, 8.0);
    float haze = (2.0 - L) * 0.22;
    cc = mix(cc, sky * 1.04, haze);
    float a = 0.96 - haze * 0.3;
    acc = cc * a + acc * (1.0 - a);
    aa = a + aa * (1.0 - a);
  }
  return vec4(aa > 0.0001 ? acc / aa : vec3(0.0), aa * vis);
}

vec4 overcastLayer(vec2 fc) {
  if (u_ov <= 0.0) return vec4(0.0);
  float H = u_res.y;
  float yb = fc.y / H;
  float x = (fc.x - 0.5 * u_res.x) / H;
  float z = 1.0 / (yb + 0.3);
  vec2 q = vec2(x * z * 1.2 - u_wind * 0.008, z * 1.6);
  float n = fbm(q * 1.3, 5.0);
  float body = tone(smoothstep(0.3, 0.75, n + u_ov * 0.35 - 0.1));
  float thin = 1.0 - body;
  float ds = length(fc - u_sun.xy) / H;
  float dm = length(fc - u_moon.xy) / H;
  vec3 cc = mix(u_shade, u_lit, 0.25 + 0.45 * tone(thin * (0.6 + 0.6 * fbm(q * 2.6 + 4.0, 3.0))));
  cc += u_sunCol * u_sunUp * exp(-ds * 3.5) * (0.25 + 0.6 * thin);
  cc += u_moonCol * u_moonGlow * exp(-dm * 5.0) * (0.2 + 0.5 * thin);
  cc = mix(cc, skyAt(fc), 0.25 * smoothstep(0.35, 0.0, yb));
  float a = clamp(u_ov * (0.75 + 0.25 * body) * smoothstep(-0.05, 0.12, yb), 0.0, 0.98);
  return vec4(cc * a, a);
}

vec4 glazeLayer(vec2 fc, vec3 sky) {
  vec4 c = cumulus(fc, sky);
  if (c.a <= 0.0) return vec4(0.0);
  float rim = smoothstep(0.04, 0.2, c.a) * smoothstep(0.6, 0.3, c.a);
  vec3 cc = c.rgb * (1.0 - rim * 0.16);
  float bloom = tone(fbm(fc / (u_res.y * 0.18) + 3.0, 3.0));
  cc += (bloom - 0.5) * 0.1 * (u_lit + u_sunCol * u_glow * 0.3);
  cc = mix(cc, sky, 0.12);
  float a = c.a * 0.9;
  return vec4(cc * a, a);
}

vec4 altoLayer(vec2 fc) {
  if (u_alto < 0.02) return vec4(0.0);
  float yb = fc.y / u_res.y;
  if (yb < 0.25) return vec4(0.0);
  float x = (fc.x - 0.5 * u_res.x) / u_res.y;
  vec2 q = vec2(x * 7.0 + u_wind * 0.012, yb * 11.0);
  float field = fbm(q, 4.0);
  float gaps = fbm(vec2(x * 1.4 + u_wind * 0.006, yb * 2.0) + 11.0, 3.0);
  float body = step(0.35, smoothstep(0.42, 0.62, field) * smoothstep(0.55 - 0.25 * u_alto, 0.8, gaps));
  vec3 cc = mix(mix(u_shade, u_top, 0.3), u_lit, tone(smoothstep(0.4, 0.7, field))) + u_sunCol * u_glow * 0.12;
  float a = 0.55 * u_alto * body * smoothstep(0.25, 0.32, yb) * (1.0 - u_ov);
  return vec4(cc * a, a);
}

float streakNoise(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = vec2(p.x * 1.9 + 1.7, p.y * 2.1 + 9.2);
    a *= 0.5;
  }
  return v / 0.9375;
}

vec4 cirrusLayer(vec2 fc) {
  if (u_cirrus < 0.02) return vec4(0.0);
  float yb = fc.y / u_res.y;
  if (yb < 0.3) return vec4(0.0);
  float x = (fc.x - 0.5 * u_res.x) / u_res.y;
  vec2 q = vec2(x * 0.7 + u_wind * 0.005, yb * 18.0);
  q.y += fbm(vec2(q.x * 0.9, yb * 1.5), 3.0) * 3.0;
  float s = streakNoise(q);
  float c = tone(smoothstep(0.5, 0.78, s) * smoothstep(0.42, 0.85, yb)) * (0.15 + 0.85 * u_cirrus);
  float veil = 0.18 * smoothstep(0.7, 1.0, u_cirrus) * smoothstep(0.3, 0.8, yb);
  vec3 cc = mix(u_lit, u_sunCol, 0.35) * 0.9 + u_sunCol * u_glow * 0.15;
  float a = min(c * 0.4 + veil, 0.35) * (1.0 - u_ov);
  return vec4(cc * a, a);
}

vec4 over(vec4 top, vec4 under) {
  return top + under * (1.0 - top.a);
}

void main() {
  vec2 fc = gl_FragCoord.xy * u_cell;
  T = u_time;
  vec3 sky = skyAt(fc);
  vec4 acc = overcastLayer(fc);
  acc = over(glazeLayer(fc, sky), acc);
  acc = over(altoLayer(fc), acc);
  acc = over(cirrusLayer(fc), acc);
  gl_FragColor = acc;
}`;

export const paintSkyShader = `${paintHead}
uniform float u_px;
uniform float u_floor;
uniform vec2 u_cloudRes;
uniform vec3 u_corona;
uniform vec3 u_coronaCol;
uniform vec4 u_meteor;
uniform float u_meteorScale;
uniform float u_stars;
uniform float u_starGate;
uniform float u_rain;
uniform float u_snow;
uniform float u_still;
uniform vec4 u_clear;
uniform float u_fog;
uniform float u_moonFace;
uniform float u_cloudOn;
uniform sampler2D u_clouds;
uniform vec4 u_probe;
uniform float u_haze;

const float grain = 0.33;
const float clearFeather = 56.0;

vec3 starLayer(vec2 fc, float cell, float keep, float seed) {
  vec2 g = fc / cell + seed;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float r = hash(id);
  if (r < keep) return vec3(0.0);
  vec2 o = (vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5) * 0.6;
  vec2 d = (f - o) * cell / u_px;
  float b = pow(hash(id + 1.3), 6.0) * 2.0 + 0.05;
  float tw = 0.75 + 0.25 * sin(T * (0.6 + r * 2.0) + r * 40.0);
  vec3 tint = mix(vec3(0.68, 0.78, 1.0), vec3(1.0, 0.86, 0.66), hash(id + 5.5));
  float l = length(d);
  float s = smoothstep(1.4, 0.0, l) + exp(-l) * b * 0.18;
  return tint * b * tw * s;
}

vec3 stars(vec2 fc) {
  float h = u_res.y;
  return (starLayer(fc, h / 42.0, 0.86, 0.0) + starLayer(fc, h / 97.0, 0.9, 3.7) * 0.75 + starLayer(fc, h / 208.0, 0.94, 9.1) * 0.5) * 0.55;
}

vec3 sunDisk(vec2 fc) {
  if (u_sunUp <= 0.0) return vec3(0.0);
  vec2 d = (fc - u_sun.xy) / u_sun.z;
  float r = length(d);
  if (r > 14.0) return vec3(0.0);
  vec2 dir = d / max(r, 0.0001);
  float rr = max(r, 1.0);
  float str = pow(fbm(dir * 4.0 + vec2(log(rr) * 0.3 - T * 0.02, T * 0.01), 4.0), 2.0) * 2.2;
  float cor = (pow(1.0 / rr, 2.6) * 2.0 + pow(1.0 / rr, 1.25) * 0.3 * str) * smoothstep(0.99, 1.01, r);
  float disk = smoothstep(1.0 + 1.5 / u_sun.z, 1.0 - 1.5 / u_sun.z, r);
  return u_sunCol * (cor * 0.5 * smoothstep(14.0, 8.0, r) + disk * 3.0) * u_sunUp;
}

vec3 shoulder(vec3 c) {
  vec3 o = max(c - 0.8, 0.0);
  return min(c, 0.8) + 0.2 * (1.0 - exp(-o / 0.2));
}

vec3 mistLayer(vec2 fc, vec3 col) {
  float yb = fc.y / u_res.y;
  if (yb > 0.5) return col;
  float x = (fc.x - 0.5 * u_res.x) / u_res.y;
  float roll = fbm(vec2(x * 1.6 + u_wind * 0.01, yb * 5.0 - T * 0.004), 4.0);
  float m = exp(-yb * 7.0) * (0.55 + 0.7 * roll) * 0.75;
  vec3 mc = mix(u_low, u_lit, 0.35) * 1.05 + u_sunCol * u_glow * 0.05;
  return mix(col, mc, clamp(m * u_haze, 0.0, 0.85));
}

vec3 grainLayer(vec2 fc, vec3 col) {
  vec2 cp = fc / u_px;
  float g = hash(floor(cp)) - 0.5;
  vec2 dp = mod(cp, 4.0);
  float dots = (length(dp - 0.5) < 0.7 ? 0.08 : 0.0) - (length(dp - 2.5) < 0.7 ? 0.15 : 0.0);
  vec3 c2 = col + grain * (g * 0.05 + dots * 0.3 * col);
  vec3 gc = (c2 - 0.5) * 1.18 + 0.5;
  float l = dot(gc, luma);
  gc = max(mix(vec3(l), gc, 1.22) * 0.98, 0.0);
  return mix(c2, gc, grain);
}

${moonShader}

vec3 coronaLayer(vec2 fc) {
  if (u_corona.z <= 0.0) return vec3(0.0);
  vec2 q = fc - u_corona.xy;
  float d = length(q) / min(u_res.y, 900.0 * u_px);
  float a = atan(q.y, q.x);
  float s = pow(fbm(vec2(a * 9.0, log(d + 0.02) * 0.8 - T * 0.008), 4.0), 2.0) * 2.4;
  float fine = pow(noise(vec2(a * 70.0, 1.0)), 3.0);
  float r0 = 0.31;
  float core = pow(r0 / max(d, 0.05), 1.8) * 0.42;
  float streams = pow(r0 / max(d, 0.05), 0.85) * (0.2 * s + 0.1 * fine);
  return u_coronaCol * (core + streams) * u_corona.z * 0.5;
}

const float meteorTail = 0.35;
const float meteorTravel = 0.75;
const float meteorWidth = 0.0028;

vec3 meteorLayer(vec2 fc) {
  if (u_meteor.w >= 1.0) return vec3(0.0);
  vec2 ps = (fc - 0.5 * u_res) / u_meteorScale;
  vec2 md = vec2(cos(u_meteor.z), sin(u_meteor.z));
  vec2 rel = ps - (u_meteor.xy + md * u_meteor.w * meteorTravel);
  float behind = dot(rel, -md);
  float across = dot(rel, vec2(-md.y, md.x)) / meteorWidth;
  float trail = smoothstep(meteorTail, 0.0, behind) * step(-0.003, behind) * exp(-across * across);
  float head = exp(-dot(rel, rel) / 0.00005);
  return vec3(0.92, 0.96, 1.0) * (trail * 0.9 + head * 1.4) * sin(3.14159265 * u_meteor.w) * u_stars;
}

float clearOutside(vec2 fc) {
  if (u_clear.z <= u_clear.x) return 1.0;
  vec2 q = abs(fc - 0.5 * (u_clear.xy + u_clear.zw)) - 0.5 * (u_clear.zw - u_clear.xy);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  return smoothstep(0.0, clearFeather * u_px, d);
}

vec3 rainLayer(vec2 fc, vec3 col) {
  if (u_rain <= 0.0) return col;
  float H = u_res.y;
  float yb = fc.y / H;
  float xs = (fc.x - 0.5 * u_res.x) / H + yb * 0.16;
  float shaft = smoothstep(0.35, 0.75, fbm(vec2(xs * 2.0 - u_wind * 0.012, 3.1), 3.0));
  float fall = smoothstep(0.7, 0.05, yb);
  float calm = mix(1.0, clearOutside(fc), u_still);
  float streak = smoothstep(mix(0.55, 0.45, u_still), mix(0.95, 1.0, u_still), noise(vec2(xs * mix(150.0, 70.0, u_still), yb * 3.0 + T * 2.6)));
  vec3 rc = mix(u_shade, u_lit, 0.35);
  col = mix(col, rc, u_rain * shaft * fall * (0.3 + 0.3 * streak * mix(1.0, calm, u_still)));
  float fine = smoothstep(0.82, 1.0, noise(vec2(xs * 380.0, yb * 7.0 + T * 7.0))) * mix(1.0, 0.2 * calm, u_still);
  return col + mix(u_lit, vec3(0.8), 0.3) * fine * u_rain * 0.07;
}

float flakes(vec2 fc, float cells, float fall, float seed, float size, float amount, float calmKeep) {
  vec2 q = vec2((fc.x - 0.5 * u_res.x) / u_res.y, fc.y / u_res.y) * cells;
  q.y += T * fall;
  q.x += sin(T * 0.7 + floor(q.y) * 1.7 + seed) * 0.35;
  vec2 id = floor(q);
  if (hash(id + seed) > amount * mix(1.0, calmKeep, u_still)) return 0.0;
  vec2 f = fract(q) - 0.5 - (vec2(hash(id + seed + 1.1), hash(id + seed + 2.7)) - 0.5) * 0.6;
  float d = length(f * vec2(1.0, 0.85)) * u_res.y / cells / u_px;
  float disc = smoothstep(mix(size, size * 1.7, u_still), mix(size * 0.2, 0.0, u_still), d);
  return disc * mix(1.0, 0.55, u_still) * (0.6 + 0.4 * hash(id + seed + 4.4));
}

vec3 fogLayer(vec2 fc, vec3 col) {
  if (u_fog <= 0.0) return col;
  float yb = fc.y / u_res.y;
  float x = (fc.x - 0.5 * u_res.x) / u_res.y;
  float roll = fbm(vec2(x * 1.3 + u_wind * 0.006, yb * 2.6 - T * 0.003), 4.0);
  float m = clamp(exp(-yb * 2.2) * (0.6 + 0.6 * roll) + 0.18, 0.0, 0.92);
  vec3 mc = mix(u_low, u_lit, 0.4) * 1.05 + u_sunCol * u_glow * 0.04;
  return mix(col, mc, tone(m) * u_fog);
}

void main() {
  vec2 cfc = u_probe.z > 0.0 ? gl_FragCoord.xy * u_probe.zw + u_probe.xy : gl_FragCoord.xy;
  vec2 fc = cfc - vec2(0.0, u_floor);
  T = u_time;
  float yb = fc.y / u_res.y;
  vec3 sky = skyAt(fc);
  vec3 col = sky;
  float starAmt = u_stars * smoothstep(0.02, 0.35, yb);
  starAmt *= 1.0 - u_starGate * smoothstep(0.03, 0.2, dot(sky, luma));
  starAmt = max(starAmt, bandMask(fc) * 0.95);
  if (starAmt > 0.0) col += stars(fc) * starAmt;
  float mc = moonCover(fc);
  vec3 md = vec3(0.0);
  if (u_moonFace > 0.5) md = moonFace(fc, mc);
  col = mix(col, sky, mc) + md;
  col += moonAura(fc);
  col += coronaLayer(fc);
  col += meteorLayer(fc);
  col += sunDisk(fc);
  if (u_cloudOn > 0.5) {
    vec4 cl = texture2D(u_clouds, (floor(fc / u_cell) + 0.5) / u_cloudRes);
    col = col * (1.0 - cl.a) + cl.rgb;
  }
  vec2 pc = cellAt(fc);
  col = rainLayer(pc, col);
  col = mistLayer(fc, col);
  col = fogLayer(pc, col);
  if (u_snow > 0.0) {
    float snowFall = flakes(pc, 18.0, 1.6, 1.0, 4.5, 0.35, 0.25) + flakes(pc, 34.0, 2.2, 5.0, 3.0, 0.3, 0.08) * 0.8;
    if (u_still < 0.5) snowFall += flakes(pc, 62.0, 2.8, 9.0, 2.0, 0.25, 0.0) * 0.6;
    else snowFall *= clearOutside(pc);
    col += mix(u_lit, vec3(1.0), 0.5) * snowFall * u_snow * 0.75;
  }
  col = grainLayer(fc, col);
  vec2 v = fc / u_res - 0.5;
  col *= 1.0 - 0.28 * smoothstep(0.35, 0.95, length(v * vec2(1.1, 1.3)));
  col = shoulder(col);
  col += (hash(fc + fract(T)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;
