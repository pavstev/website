export const paintPalettes = {
  night: {
    lit: "#50698C",
    low: "#1C2A44",
    mid: "#10192D",
    shade: "#0C101C",
    sun: "#B4D2FF",
    top: "#060912",
  },
  overcast: {
    lit: "#D4D8DD",
    low: "#B4BAC1",
    mid: "#BEC3C9",
    shade: "#A3AAB2",
    sun: "#E8ECF0",
    top: "#C6CBD0",
  },
  rain: {
    lit: "#A0AFB9",
    low: "#5F6973",
    mid: "#303A44",
    shade: "#1E242D",
    sun: "#AABED2",
    top: "#161C24",
  },
} as const;

export const paintTints = {
  city: "#FF9E52",
  corona: "#FFE6C4",
  moon: "#FFF5E0",
  moonlight: "#BFD1FF",
  moonlit: "#96A5C6",
  space: "#04060E",
} as const;

export const globePalette = {
  atmosphere: "#6F9BFF",
  base: "#070B18",
  city: paintTints.city,
  day: "#18284E",
  graticule: "#88A4DC",
  land: "#1B2B4F",
  landDay: "#2F4778",
  rim: "#3F62B0",
  shore: "#7599E6",
} as const;
