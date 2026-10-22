import { storyMeta } from "../../data/dotfiles-stats.ts";
import {
  type SkillCopy,
  type SkillUsageData,
} from "../../data/dotfiles-story.ts";
import { type DotfilesFacts } from "../dotfiles-facts.ts";
import { digits, spelled } from "./number-words.ts";
import { type StoryStep } from "./steps.ts";

const emDash = String.fromCodePoint(0x20_14);
const titleSteps: ReadonlySet<StoryStep["id"]> = new Set(["harness", "hero"]);
const lineWords = { max: 7, min: 3 };
const noteSentences = { max: 4, min: 2 };
const noteWordsMax = 55;

const bannedPattern =
  /\b(?:seamless|robust|leverage|empower|effortless|elevate|journey|delve|unlock|crafted|curated|meticulously|beautifully|cutting-edge|game-changer)\b/giu;
const cityPattern = /\b(?:vienna|wien)\b/iu;
const digitPattern = /\d[\d,.]*/gu;
const trailingPunctuation = /[.,]+$/u;
const wordPattern = /[A-Za-z]+/gu;
const sentenceEnd = /[.!?]+(?:\s+|$)/u;

const collect = (value: unknown, into: Set<number>): void => {
  if (typeof value === "number") {
    into.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value as unknown[]) {
      collect(item, into);
    }
  }
};

const countWords = (text: string): number =>
  text.split(/\s+/u).filter((word) => word.length > 0).length;

const countSentences = (text: string): number =>
  text.split(sentenceEnd).filter((part) => part.trim().length > 0).length;

const numbersIn = (text: string): string[] => {
  const typed = text
    .matchAll(digitPattern)
    .map((match) => match[0].replace(trailingPunctuation, ""))
    .toArray();
  const spoken = text
    .matchAll(wordPattern)
    .map((match) => match[0].toLowerCase())
    .filter((word) => spelled.has(word))
    .toArray();
  return [...typed, ...spoken];
};

const valueOf = (token: string): number =>
  spelled.get(token) ?? Number(token.replaceAll(",", ""));

const textMessages = (
  field: string,
  text: string,
  allowed: ReadonlySet<number>
): string[] => {
  const messages: string[] = [];
  if (text.includes(emDash)) {
    messages.push(`${field} has an em dash`);
  }
  for (const match of text.matchAll(bannedPattern)) {
    messages.push(`${field} has the banned word "${match[0].toLowerCase()}"`);
  }
  if (text.includes("?")) {
    messages.push(`${field} has a question`);
  }
  if (text.includes("!")) {
    messages.push(`${field} has an exclamation mark`);
  }
  if (cityPattern.test(text)) {
    messages.push(`${field} has a city name`);
  }
  for (const token of numbersIn(text)) {
    if (!allowed.has(valueOf(token))) {
      messages.push(`${field} has the number ${token} that is not a fact`);
    }
  }
  return messages;
};

const shareNumbers = (value: unknown, into: Set<number>): void => {
  if (typeof value === "number" && value >= 0 && value <= 1) {
    into.add(Math.round(value * 100));
  } else if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/u.test(value)) {
    into.add(Number(value.slice(8, 10)));
  } else if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value)) shareNumbers(item, into);
  }
};

export const copyNumbers = (
  facts: DotfilesFacts,
  usage?: SkillUsageData
): ReadonlySet<number> => {
  const numbers = new Set<number>();
  if (usage) shareNumbers(usage, numbers);
  for (const value of Object.values(facts)) {
    collect(value, numbers);
  }
  for (const value of Object.values(storyMeta)) {
    collect(value, numbers);
  }
  numbers.add(Math.round(facts.rustShare * 100));
  return numbers;
};

export const lintSkill = (
  copy: SkillCopy,
  allowed: ReadonlySet<number>
): string[] => {
  const messages = [
    ...textMessages(`${copy.skill} what`, copy.what, allowed),
    ...textMessages(`${copy.skill} metric`, copy.metric, allowed),
  ];
  const words = countWords(copy.what);
  if (words < lineWords.min || words > lineWords.max) {
    messages.push(
      `${copy.skill} what has ${digits(words)} words, it needs ${digits(lineWords.min)} to ${digits(lineWords.max)}`
    );
  }
  if (copy.what.length === 0 || copy.metric.length === 0) {
    messages.push(`${copy.skill} has no copy`);
  }
  return messages;
};

export const lintFact = (
  line: string,
  allowed: ReadonlySet<number>
): string[] => textMessages("fact", line, allowed);

export const lintCopy = (
  step: StoryStep,
  allowed: ReadonlySet<number>
): string[] => {
  const messages = [
    ...textMessages("line", step.line, allowed),
    ...textMessages("note", step.note, allowed),
  ];
  const words = countWords(step.line);
  if (
    !titleSteps.has(step.id) &&
    (words < lineWords.min || words > lineWords.max)
  ) {
    messages.push(
      `line has ${digits(words)} words, it needs ${digits(lineWords.min)} to ${digits(lineWords.max)}`
    );
  }
  const sentences = countSentences(step.note);
  if (sentences < noteSentences.min || sentences > noteSentences.max) {
    messages.push(
      `note has ${digits(sentences)} sentences, it needs ${digits(noteSentences.min)} to ${digits(noteSentences.max)}`
    );
  }
  const noteWords = countWords(step.note);
  if (noteWords > noteWordsMax) {
    messages.push(
      `note has ${digits(noteWords)} words, it needs ${digits(noteWordsMax)} at most`
    );
  }
  return messages;
};
