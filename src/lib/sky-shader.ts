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
uniform float u_cloudShift;
uniform vec4 u_quiet;
uniform vec3 u_daylight;
uniform vec4 u_weather;
uniform vec4 u_fall;
uniform vec4 u_puffs[10];
uniform float u_puffOn;

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
const float starTop = 1.7;
const float quietStars = 0.35;
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
const float dayLift = 0.52;
const float dayTint = 0.8;
const float starFade = 0.75;
const float coronaDay = 0.75;
const float twilightGlow = 1.0;
const float warmth = 0.65;
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
const vec4 cloudTone = vec4(1.0, 0.55, 0.5, 0.8);
const vec3 cloudGlow = vec3(1.0, 0.78, 0.58);
const float puffMode = 0.0;
const float puffWide = 0.12;
const float puffTall = 0.07;
const float quietLuma = 0.034;
const float shieldFeather = 0.06;
const vec3 luma = vec3(0.2126, 0.7152, 0.0722);

float flashAmt;
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
  float sc = cloudScale * (1.0 + near * 0.6);
  float x = p.x + ts * 0.01 * cloudDrift * (1.0 + near * 0.8) / sc + near * 5.3;
  float bump = puffBump(p, yb, near);
  float top = cloudHeight * mix(1.0, 0.6, near) * (1.0 + (noise(vec2(x * 0.6 + near * 4.0, near * 7.3)) - 0.5) * variety) * (1.0 + (u_weather.x - 0.6) * 0.9);
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
  vec3 glowTint = mix(cloudGlow, warmTone, clamp(u_daylight.y * warmth, 0.0, 1.0));
  float glowGain = cloudTone.y * (1.0 - cloudTone.w * sunUp) * (1.0 - 0.45 * heavy);
  vec3 body = mix(vec3(0.08, 0.085, 0.12), vec3(0.015, 0.017, 0.03), cloudDark) * (1.0 - near * 0.3);
  body += vec3(0.15, 0.16, 0.21) * cloudLight * (0.55 + 0.45 * toSky);
  body += vec3(0.3, 0.34, 0.44) * cloudDayLight * sunUp * (0.6 + 1.1 * toSky) * (1.0 - 0.4 * heavy);
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
  float ov = u_weather.y;
  vec3 deckNight = vec3(0.03, 0.032, 0.04) + cloudGlow * 0.035 * exp(-yb * 2.2);
  vec3 deckDay = vec3(dot(col, luma)) * vec3(0.9, 0.96, 1.06);
  col = mix(col, hueRotate(mix(deckNight, deckDay, sunUp), -hueShift), ov * 0.85);
  float qp = u_view * 0.03;
  float inQuiet = smoothstep(-qp, 0.0, fc.x - u_quiet.x) * smoothstep(-qp, 0.0, u_quiet.z - fc.x) * smoothstep(-qp, 0.0, fc.y - u_quiet.y) * smoothstep(-qp, 0.0, u_quiet.w - fc.y);
  col += stars(ps, t) * 0.55 * starKeep * (1.0 - (1.0 - quietStars) * inQuiet) * (1.0 - 0.92 * ov);
  col += (glowColor * 0.3 * exp(-yb * glowFalloff) + vec3(0.55, 0.32, 0.6) * 0.1 * exp(-yb * glowFalloff * 0.39)) * horizonGlow * 2.0 * (1.0 - day * 0.6) * (1.0 - 0.5 * ov);
  col += (warm * 0.55 * exp(-yb * glowFalloff * 0.55) + vec3(0.6, 0.35, 0.72) * 0.16 * exp(-yb * 1.5)) * twi * twilightGlow * (1.0 - 0.6 * ov);

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
    col += vec3(0.92, 0.96, 1.0) * (trail * 0.9 + head * 1.4) * sin(PI * u_meteor.w) * starKeep * (1.0 - ov);
  }

  float tm = u_cloudTime * speed;
  float ts = u_cloudShift * speed;
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

  if (u_weather.w > 0.0) {
    float fogAmt = u_weather.w;
    float roll = fbm3(vec2(p.x * 1.3 + ts * 0.003, yb * 2.6 - tm * 0.003));
    float f = fogAmt * clamp(exp(-yb * mix(3.2, 1.4, fogAmt)) * (0.7 + 0.6 * roll) + 0.15 * fogAmt, 0.0, 1.0);
    vec3 fogNight = vec3(0.07, 0.072, 0.085) + cloudGlow * 0.09 * exp(-yb * 1.6);
    col = mix(col, hueRotate(mix(fogNight, vec3(0.4, 0.44, 0.5), sunUp), -hueShift), f * 0.92);
  }

  float calm = 1.0 - 0.7 * inQuiet;
  if (u_fall.x > 0.0) {
    float drops = rainLayer(p, 110.0, 7.2, tr, 1.0, 240.0) + rainLayer(p, 190.0, 9.5, tr, 7.0, 380.0) * 0.6;
    col += hueRotate(mix(vec3(0.3, 0.33, 0.4), vec3(0.7, 0.75, 0.82), sunUp), -hueShift) * drops * u_fall.x * 0.5 * calm;
  }
  if (u_fall.y > 0.0) {
    float flakes = snowLayer(p, 28.0, 2.8, tr, 1.0, 4.5, 0.35) + snowLayer(p, 55.0, 3.3, tr, 5.0, 3.0, 0.3) * 0.8 + snowLayer(p, 100.0, 3.8, tr, 9.0, 2.0, 0.25) * 0.6;
    col += hueRotate(mix(vec3(0.55, 0.58, 0.66), vec3(0.9, 0.93, 1.0), sunUp), -hueShift) * flakes * u_fall.y * 0.7 * calm;
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
  if (u_quiet.z > u_quiet.x) {
    float sp = u_view * shieldFeather;
    float shield = smoothstep(-sp, 0.0, fc.x - u_quiet.x) * smoothstep(-sp, 0.0, u_quiet.z - fc.x) * smoothstep(-sp, 0.0, fc.y - u_quiet.y) * smoothstep(-sp, 0.0, u_quiet.w - fc.y);
    if (shield > 0.0) {
      float lum = dot(pow(max(col, 0.0), vec3(2.2)), luma);
      col *= mix(1.0, min(1.0, pow(quietLuma / max(lum, 0.00001), 0.4545)), shield);
    }
  }
  col += (fract(52.9829189 * fract(dot(fc, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;
