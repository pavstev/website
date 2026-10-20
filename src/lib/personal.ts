export const personalData = {
  familyName: "Pavlović",
  github: "https://github.com/pavstev",
  githubHandle: "pavstev",
  givenName: "Stevan",
  knowsAbout: [
    "Software engineering",
    "AI-assisted software development",
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
    "Hi, I’m Stevan. I have been a software engineer for more than eleven years, across many stacks and teams. Since 2024 I have worked as an AI-powered engineer, and I ship faster than ever. My work runs in fintech, betting, healthtech and fleet logistics.",
  title: "Software Engineer · Tech Lead",
  website: "https://stevanpavlovic.com",
} as const;

export const plainName = personalData.name
  .normalize("NFD")
  .replaceAll(/\p{Diacritic}/gu, "");
