export const personalData = {
  city: "Vienna",
  cityCoordinates: { latitude: 48.2082, longitude: 16.3738 },
  country: "Austria",
  countryCode: "AT",
  familyName: "Pavlović",
  github: "https://github.com/pavstev",
  githubHandle: "pavstev",
  givenName: "Stevan",
  knowsAbout: [
    "Backend engineering",
    "Distributed systems",
    "Event-driven architecture",
    "Software architecture",
    "Technical leadership",
    "Node.js",
    "TypeScript",
    "NestJS",
    "Apache Kafka",
    "PostgreSQL",
    "Redis",
    "Fintech",
    "Sports betting platforms",
    "Healthtech",
    "Fleet logistics",
  ],
  languages: ["en", "sr"],
  name: "Stevan Pavlović",
  portrait: { height: 800, url: "/portraits/portrait-800.webp", width: 800 },
  summary:
    "Hi! I’m a backend and distributed-systems engineer living in Vienna. For eleven years I have built systems people rely on, in fintech, betting, healthtech and fleet logistics. I like small teams, clear interfaces and software that stays quiet in production.",
  title: "Backend & Distributed-Systems Engineer · Tech Lead",
  website: "https://stevanpavlovic.com",
} as const;

export const plainName = personalData.name
  .normalize("NFD")
  .replaceAll(/\p{Diacritic}/gu, "");
