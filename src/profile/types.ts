import type { Repo } from "../lib/github.ts";

export interface ProfileFile {
  contents: string;
  path: string;
}

export interface ProfileInput {
  personal: ProfilePerson;
  products: ProfileProduct[];
  repos: readonly Repo[];
  strings: ProfileStrings;
}

export interface ProfileProduct {
  line: string;
  meta: string;
  name: string;
  url: string;
}

interface ProfilePerson {
  linkedin: string;
  name: string;
  summary: string;
  title: string;
  website: string;
}

interface ProfileStrings {
  card: { linkedin: string };
  profile: {
    columnBuiltWith: string;
    columnProduct: string;
    columnProject: string;
    columnRole: string;
    columnStars: string;
    columnWhat: string;
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
  work: { productsHeading: string; projectsHeading: string };
}
