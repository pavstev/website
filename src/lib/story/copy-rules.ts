import { type SkillCopy } from "../../data/dotfiles-story.ts";

const numberWords: readonly string[] = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
];

const tens: ReadonlyArray<[string, number]> = [
  ["thirty", 30],
  ["forty", 40],
  ["fifty", 50],
];

const spelled: ReadonlyMap<string, number> = new Map([
  ...numberWords.flatMap((word, value): Array<[string, number]> =>
    value >= 2 ? [[word, value]] : []
  ),
  ...tens,
]);

const emDash = String.fromCodePoint(0x20_14);
const titleSteps: ReadonlySet<string> = new Set(["harness", "hero"]);
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

export interface CopyOptions {
  numbers?: boolean;
}

export interface CopyStep {
  id: string;
  line: string;
  note: string;
}

const textMessages = (
  field: string,
  text: string,
  numbers = false
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
  if (!numbers) {
    for (const token of numbersIn(text)) {
      messages.push(`${field} has the number ${token}`);
    }
  }
  return messages;
};

export const lintSkill = (copy: SkillCopy): string[] => {
  const messages = [
    ...textMessages(`${copy.skill} what`, copy.what),
    ...textMessages(`${copy.skill} flow`, copy.flow),
  ];
  const words = countWords(copy.what);
  if (words < lineWords.min || words > lineWords.max) {
    messages.push(
      `${copy.skill} what has ${String(words)} words, it needs ${String(lineWords.min)} to ${String(lineWords.max)}`
    );
  }
  if (copy.what.length === 0 || copy.flow.length === 0) {
    messages.push(`${copy.skill} has no copy`);
  }
  return messages;
};

export const lintFact = (line: string): string[] => textMessages("fact", line);

export const lintCopy = (
  step: CopyStep,
  options: CopyOptions = {}
): string[] => {
  const numbers = options.numbers ?? false;
  const messages = [
    ...textMessages("line", step.line, numbers),
    ...textMessages("note", step.note, numbers),
  ];
  const words = countWords(step.line);
  if (
    !titleSteps.has(step.id) &&
    (words < lineWords.min || words > lineWords.max)
  ) {
    messages.push(
      `line has ${String(words)} words, it needs ${String(lineWords.min)} to ${String(lineWords.max)}`
    );
  }
  const sentences = countSentences(step.note);
  if (sentences < noteSentences.min || sentences > noteSentences.max) {
    messages.push(
      `note has ${String(sentences)} sentences, it needs ${String(noteSentences.min)} to ${String(noteSentences.max)}`
    );
  }
  const noteWords = countWords(step.note);
  if (noteWords > noteWordsMax) {
    messages.push(
      `note has ${String(noteWords)} words, it needs ${String(noteWordsMax)} at most`
    );
  }
  return messages;
};
