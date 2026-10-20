export const moonShader = `
uniform vec3 u_moonL;
uniform vec2 u_moonN;
uniform float u_earth;
uniform vec3 u_moonTint;
uniform float u_aura;
uniform float u_bump;
uniform sampler2D u_moonMap;
uniform float u_mapOn;

float moonMare(vec2 p, vec2 c, vec2 r) {
  vec2 d = (p - c) / r;
  return exp(-dot(d, d) * 2.2);
}

float moonFlat(vec2 t) {
  float m = moonMare(t, vec2(-0.32, 0.36), vec2(0.3, 0.24)) + moonMare(t, vec2(0.14, 0.38), vec2(0.17, 0.15))
    + moonMare(t, vec2(0.3, 0.1), vec2(0.2, 0.17)) + moonMare(t, vec2(0.68, 0.28), vec2(0.11, 0.1))
    + moonMare(t, vec2(0.55, -0.16), vec2(0.15, 0.14)) + moonMare(t, vec2(0.36, -0.36), vec2(0.1, 0.09))
    + moonMare(t, vec2(-0.62, 0.02), vec2(0.28, 0.42)) + moonMare(t, vec2(-0.16, -0.38), vec2(0.18, 0.13))
    + moonMare(t, vec2(-0.48, -0.46), vec2(0.1, 0.09));
  m = clamp(m * (0.8 + 0.4 * fbm(t * 3.0 + 7.0, 2.0)), 0.0, 1.0);
  float albedo = mix(1.0, 0.62, smoothstep(0.04, 0.5, m)) * (0.94 + 0.12 * fbm(t * 5.0 + 2.0, 2.0));
  vec2 ty = t - vec2(-0.1, -0.74);
  return albedo + exp(-dot(ty, ty) * 300.0) * 0.35;
}

float moonAlbedoAt(vec2 uv) {
  return texture2D(u_moonMap, vec2(uv.x, clamp(uv.y, 0.001953125, 0.998046875) * 0.5)).r;
}

float moonHeightAt(vec2 uv) {
  return texture2D(u_moonMap, vec2(uv.x, 0.5 + clamp(uv.y, 0.001953125, 0.998046875) * 0.5)).r;
}

float moonCover(vec2 fc) {
  if (u_moon.w <= 0.0) return 0.0;
  float r = length((fc - u_moon.xy) / u_moon.z);
  float px = 1.1 / u_moon.z;
  return smoothstep(1.0 + px, 1.0 - px, r) * u_moon.w;
}

vec3 moonFace(vec2 fc, out float cover) {
  cover = moonCover(fc);
  if (cover <= 0.0) return vec3(0.0);
  vec2 d = (fc - u_moon.xy) / u_moon.z;
  float r = length(d);
  vec2 dd = r > 0.998 ? d * (0.998 / r) : d;
  vec2 t = vec2(dd.x * u_moonN.y - dd.y * u_moonN.x, dd.x * u_moonN.x + dd.y * u_moonN.y);
  float z = sqrt(max(1.0 - dot(t, t), 0.0));
  vec3 p = vec3(t, z);
  vec3 nm = p;
  float albedo;
  if (u_mapOn > 0.5) {
    float lat = asin(clamp(p.y, -1.0, 1.0));
    float lon = atan(p.x, p.z);
    vec2 uv = vec2(lon / 6.2831853 + 0.5, lat / 3.14159265 + 0.5);
    albedo = moonAlbedoAt(uv);
    float du = 1.0 / 512.0;
    float dv = 1.0 / 256.0;
    float hE = moonHeightAt(uv + vec2(du, 0.0));
    float hW = moonHeightAt(uv - vec2(du, 0.0));
    float hN = moonHeightAt(uv + vec2(0.0, dv));
    float hS = moonHeightAt(uv - vec2(0.0, dv));
    float cl = max(cos(lat), 0.08);
    float gLon = (hE - hW) / (2.0 * du * 6.2831853) / cl;
    float gLat = (hN - hS) / (2.0 * dv * 3.14159265);
    vec3 eLon = vec3(cos(lon), 0.0, -sin(lon));
    vec3 eLat = vec3(-sin(lat) * sin(lon), cos(lat), -sin(lat) * cos(lon));
    float bump = u_bump * (1.0 - 0.85 * smoothstep(0.12, 0.55, dot(vec3(dd, z), u_moonL)));
    nm = normalize(p - bump * (gLon * eLon + gLat * eLat));
  } else {
    albedo = moonFlat(t);
  }
  vec3 ns = vec3(nm.x * u_moonN.y + nm.y * u_moonN.x, -nm.x * u_moonN.x + nm.y * u_moonN.y, nm.z);
  vec3 ps = vec3(dd, z);
  float mu0 = dot(ns, u_moonL);
  float mu0s = dot(ps, u_moonL);
  float mu = max(ps.z, 0.03);
  float ls = max(mu0, 0.0) / (max(mu0, 0.0) + mu) * 2.0;
  float lit = ls * smoothstep(-0.015, 0.05, mu0s) * (1.0 + 0.25 * smoothstep(0.85, 1.0, u_moonL.z));
  float earth = u_earth * (1.0 - smoothstep(-0.04, 0.12, mu0s));
  vec3 tint = u_moonCol * u_moonTint;
  vec3 c = albedo * (tint * lit * 1.18 + vec3(0.5, 0.6, 0.78) * earth * 0.11);
  return c * cover;
}

vec3 moonAura(vec2 fc) {
  if (u_moon.w <= 0.0 || u_moonGlow <= 0.0) return vec3(0.0);
  float dpx = length(fc - u_moon.xy);
  float rm = u_moon.z;
  float x = max(dpx - rm, 0.0) / rm;
  vec3 tint = u_moonCol * u_moonTint;
  float aura = (exp(-x * 1.5) * 0.2 + exp(-x * 0.32) * 0.06) * u_aura;
  return tint * aura * u_moonGlow;
}
`;
