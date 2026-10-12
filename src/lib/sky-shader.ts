export const skyVertexShader = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

export const skyFragmentShader = `
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
uniform vec3 u_portrait;
uniform vec3 u_ripple;
uniform vec4 u_meteor;
uniform float u_clouds;
uniform float u_cloudTime;
uniform vec3 u_stir;
uniform vec2 u_wind;
uniform vec3 u_daylight;

const float PI = 3.14159265;
const float TAU = 6.2831853;
const float speed = 1.82;
const float brightness = 0.7;
const float hueShift = -0.2618;
const float centerDim = 0.39;
const float starAmount = 0.78;
const float twinkle = 0.25;
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
const float skyTop = 0.5;
const float cloudHeight = 0.36;
const float cloudCover = 0.5;
const float cloudSoft = 0.053;
const float cloudScale = 3.13;
const float cloudDrift = 2.6;
const float underglow = 1.52;
const float silver = 0.9;
const float cloudDark = 0.74;
const float cloudOpacity = 0.82;
const float cloudReach = 0.62;
const float cloudLight = 0.49;
const float cloudDayLight = 0.55;
const float puff = 0.85;
const float variety = 0.65;
const float wisps = 0.4;
const float dayLift = 0.52;
const float dayTint = 0.8;
const float starFade = 0.75;
const float coronaDay = 0.75;
const float twilightGlow = 1.0;
const float warmth = 0.65;
const float stirRadius = 0.24;
const float stirSwirl = 0.3;
const float stirPush = 0.32;
const float stirWarp = 1.8;
const float stirGlow = 0.7;
const float coronaReach = 14.0;
const float coronaFade = 9.0;
const float coronaTaperStart = 3.0;
const float coronaTaperEnd = 6.0;
const float meteorTail = 0.35;
const float meteorTravel = 0.75;
const float meteorWidth = 0.0028;
const float rippleStrength = 0.44;
const float rippleSharpness = 10.0;
const float rippleLife = 1.6;
const vec3 glowColor = vec3(1.0, 0.5, 0.24);

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

vec3 hueRotate(vec3 c, float a) {
  vec3 k = vec3(0.57735);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}

vec3 starField(vec2 p, float scale, float keep, float t) {
  keep = 1.0 - (1.0 - keep) * starAmount;
  vec2 g = p * scale;
  vec2 id = floor(g);
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
  return starField(p, 30.0, 0.8, t) + starField(p + 3.7, 70.0, 0.88, t) * 0.75 + starField(p + 9.1, 150.0, 0.93, t) * 0.5;
}

vec3 cloudLayer(vec3 col, vec2 p, float yb, float near, float t, float sf, vec2 sd, vec3 warm) {
  float tt = t * 0.01 * cloudDrift * (1.0 + near * 0.8);
  float bank = fbm3(vec2(p.x * 0.45 + tt * 0.25 + near * 4.0, near * 7.3)) - 0.5;
  float top = cloudHeight * mix(1.0, 0.62, near) * (1.0 + bank * variety * 1.1);
  if (yb - top * 0.35 > top + cloudSoft) return col;
  float sc = cloudScale * (1.0 + near * 0.6);
  vec2 push = (u_wind * stirPush + vec2(-sd.y, sd.x) * stirSwirl) * sf * (1.0 + near * 0.5);
  vec2 q = vec2((p.x - push.x) * sc + tt + near * 13.7, (yb - push.y) * sc * 1.6 + near * 5.1);
  vec2 w = vec2(fbm3(q * 0.7 + tt * 0.3), fbm3(q * 0.7 + 3.1 - tt * 0.2));
  float n = fbm(q + w * (1.2 + sf * stirWarp));
  float y = yb + (n - 0.5) * top * 0.7;
  float hm = smoothstep(top + cloudSoft, top - cloudSoft, y);
  if (hm <= 0.0) return col;
  float cover = cloudCover + bank * variety * 0.55;
  float dens = hm * smoothstep(1.0 - cover - 0.12, 1.0 - cover + 0.14, n + (1.0 - yb / max(top, 0.001)) * 0.35);
  dens = clamp(dens, 0.0, 1.0);
  if (dens <= 0.0) return col;
  float billow = fbm3(q * 2.3 + w * 2.0);
  float edge = smoothstep(0.0, 0.35, dens) * (1.0 - smoothstep(0.35, 0.9, dens));
  float under = exp(-yb * glowFalloff * 0.8);
  vec3 body = mix(vec3(0.08, 0.085, 0.12), vec3(0.015, 0.017, 0.03), cloudDark) * (1.0 - near * 0.3);
  body += vec3(0.15, 0.16, 0.21) * cloudLight + vec3(0.3, 0.34, 0.44) * cloudDayLight * u_daylight.x;
  body *= 1.0 - puff * 0.5 + puff * billow;
  vec3 glowTint = mix(glowColor, warm, clamp(u_daylight.y * warmth, 0.0, 1.0));
  vec3 lit = glowTint * under * underglow * 0.9 * horizonGlow * (0.5 + 0.9 * (1.0 - billow)) * (1.0 + sf * stirGlow) * (1.0 + u_daylight.y * twilightGlow * 0.6);
  vec3 cc = body + lit * (1.0 - dens * 0.4) + vec3(0.75, 0.8, 1.0) * edge * silver * 0.22 * (1.0 + u_daylight.x * 0.8);
  return mix(col, cc, dens * cloudOpacity);
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  float yb = fc.y / u_view;
  float yt = (u_res.y - fc.y) / u_view;
  vec2 p = (fc - 0.5 * u_res) / u_view;
  vec2 ps = p + u_pointer;
  float t = u_time * speed;
  float sunUp = u_daylight.x;
  float twi = u_daylight.y;
  float day = sunUp * dayLift;
  vec3 warm = mix(vec3(1.0, 0.5, 0.6), vec3(1.0, 0.42, 0.16), u_daylight.z);
  float starKeep = 1.0 - sunUp * starFade;
  float coronaKeep = mix(1.0, coronaDay, sunUp);

  vec3 night = vec3(0.02, 0.025, 0.05) + vec3(0.03, 0.05, 0.13) * (1.0 - clamp(yb, 0.0, 1.0)) * skyTop * 2.0;
  vec3 dayTop = mix(vec3(0.05, 0.08, 0.22), vec3(0.1, 0.24, 0.52), dayTint);
  vec3 dayLow = mix(vec3(0.25, 0.3, 0.46), vec3(0.45, 0.6, 0.78), dayTint);
  vec3 col = mix(night, mix(dayLow, dayTop, smoothstep(0.0, 1.2, yb)), day);
  col += stars(ps, t) * 0.55 * starKeep;
  col += (glowColor * 0.3 * exp(-yb * glowFalloff) + vec3(0.55, 0.32, 0.6) * 0.1 * exp(-yb * glowFalloff * 0.39)) * horizonGlow * 2.0 * (1.0 - day * 0.6);
  col += (warm * 0.55 * exp(-yb * glowFalloff * 0.55) + vec3(0.6, 0.35, 0.72) * 0.16 * exp(-yb * 1.5)) * twi * twilightGlow;

  if (u_portrait.z > 0.5) {
    float r0 = u_portrait.z;
    vec2 d = (fc - u_portrait.xy) / r0;
    float r = length(d);
    if (r < coronaReach) {
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
      col += mix(inner, outer, smoothstep(1.0, 3.2, rr)) * cor * 0.8 * coronaBright * smoothstep(coronaReach, coronaFade, r) * coronaKeep;
      if (r < 1.0 + flareSize + 0.05) {
        float pr = smoothstep(0.6, 0.8, fbm(spin(dir, t * flareSpin) * 9.0 + vec2(t * 0.03, 0.0))) * smoothstep(1.0 + flareSize, 1.0, r) * step(1.0, r);
        col += hueRotate(vec3(1.0, 0.32, 0.55), flareHue) * pr * 1.4 * flares * coronaKeep;
      }
      col += hueRotate(vec3(1.0, 0.42, 0.62), flareHue) * exp(-abs(r - 1.0) * r0 * u_labPx * 0.45) * rim;
      float pulse = pow(0.5 + 0.5 * sin(t * TAU / flashPeriod), 10.0) * flash * coronaKeep;
      if (pulse > 0.002) {
        vec2 bq = (d - vec2(cos(flashAngle), sin(flashAngle)) * 1.01) * r0 * u_labPx;
        float bl = length(bq);
        float bead = exp(-bl * 0.22) * 1.6 + exp(-abs(bq.y) * 0.7) * exp(-abs(bq.x) * 0.02) * 0.5 + exp(-abs(bq.x) * 0.7) * exp(-abs(bq.y) * 0.03) * 0.3;
        col += vec3(1.0, 0.96, 0.88) * bead * pulse;
      }
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
    col += vec3(0.92, 0.96, 1.0) * (trail * 0.9 + head * 1.4) * sin(PI * u_meteor.w) * starKeep;
  }

  float ct = u_cloudTime * speed;
  if (u_clouds > 0.5 && yb > 0.22 && yb < 0.8) {
    float band = smoothstep(0.26, 0.42, yb) * smoothstep(0.8, 0.52, yb);
    vec2 wq = vec2(p.x * 1.1 + ct * 0.012 * cloudDrift, yb * 9.0 + fbm3(vec2(p.x * 0.8 + ct * 0.004, yb * 2.0)) * 1.6);
    float streak = smoothstep(0.55, 0.85, fbm(wq)) * band;
    vec3 wisp = vec3(0.3, 0.33, 0.42) * (0.4 + cloudLight) + warm * 0.75 * twi + vec3(0.35, 0.4, 0.5) * sunUp * cloudDayLight;
    col += wisp * streak * wisps;
  }

  if (u_clouds > 0.5 && yb < cloudReach) {
    vec2 sd = (p - u_stir.xy) / stirRadius;
    float sf = u_stir.z * exp(-dot(sd, sd));
    col = cloudLayer(col, ps * 0.6 + p * 0.4, yb, 0.0, ct, sf, sd, warm);
    col = cloudLayer(col, p, yb, 1.0, ct, sf, sd, warm);
  }

  if (u_ripple.z < rippleLife) {
    float rd = length(p - u_ripple.xy);
    float rx = (rd - u_ripple.z * 0.55) * rippleSharpness;
    col += vec3(0.62, 0.73, 1.0) * exp(-rx * rx) * max(0.0, 1.0 - u_ripple.z / rippleLife) * 0.18 * rippleStrength;
  }

  float vx = fc.x / u_res.x - 0.5;
  float vy = max(max(0.5 - yt, 0.5 - yb), 0.0);
  float vignette = smoothstep(0.1, 0.9, length(vec2(vx, vy)) * 1.3);
  col *= mix(1.0 - centerDim * (1.0 - day * 0.5), 1.0, vignette);
  col = max(hueRotate(col * brightness, hueShift), 0.0);
  col = 1.0 - exp(-col * 1.15);
  col += (fract(52.9829189 * fract(dot(fc, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;
