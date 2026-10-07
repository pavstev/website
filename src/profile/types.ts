import type { Repo } from "../lib/github.ts";

export interface IconData {
  body: string;
  height: number;
  width: number;
}

export interface ProfileFile {
  contents: string;
  path: string;
}

export interface ProfileInput {
  fonts: ProfileFonts;
  icons: Readonly<Record<string, IconData>>;
  personal: ProfilePerson;
  repos: readonly Repo[];
  strings: ProfileStrings;
}

export interface ProfilePerson {
  city: string;
  country: string;
  linkedin: string;
  name: string;
  summary: string;
  title: string;
  website: string;
}

interface ProfileFonts {
  extra: Uint8Array;
  latin: Uint8Array;
  nameExtra: Uint8Array;
  nameLatin: Uint8Array;
}

interface ProfileStrings {
  card: { linkedin: string };
  profile: {
    contributingContent: string;
    contributingIntro: string;
    contributingLayout: string;
    contributingPreview: string;
    contributingSource: string;
    contributingStrings: string;
    contributingTitle: string;
    generated: string;
    resume: string;
    website: string;
  };
  repos: { headingOne: string; headingOther: string };
}
