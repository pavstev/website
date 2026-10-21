const words: readonly string[] = [
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

export const spelled: ReadonlyMap<string, number> = new Map([
  ...words.flatMap((word, value): Array<[string, number]> =>
    value >= 2 ? [[word, value]] : []
  ),
  ...tens,
]);

export const say = (value: number): string => words[value] ?? String(value);

export const digits = String;
