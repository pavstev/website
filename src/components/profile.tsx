import { type CSSProperties, Fragment, type ReactElement } from "react";

import { CityPanel } from "@/components/city-panel";
import { CompoundText } from "@/components/compound-text";
import { IndustryPanel } from "@/components/industry-panel";
import { Portrait } from "@/components/portrait";
import { TopicTrigger } from "@/components/topic-trigger";
import { splitBio } from "@/lib/bio";
import { cityPanelId, cityStrings } from "@/lib/city";
import { en } from "@/lib/i18n";
import { industries } from "@/lib/industries";
import { personalData } from "@/lib/personal";

const bio = splitBio(personalData.summary, [
  {
    label: cityStrings.title,
    panelId: cityPanelId,
    topic: "city",
    word: personalData.city,
  },
  ...industries.map(({ key, label, panelId, word }) => ({
    label,
    panelId,
    topic: key,
    word,
  })),
]);

interface NameLetter {
  char: string;
  index: number;
}

const graphemes = new Intl.Segmenter("en", { granularity: "grapheme" });

const groupWords = (name: string): NameLetter[][] => {
  const words: NameLetter[][] = [];
  let word: NameLetter[] = [];
  let index = 0;
  const segments = graphemes.segment(name);
  for (const { segment } of segments) {
    if (/^\s$/u.test(segment)) {
      words.push(word);
      word = [];
    } else {
      word.push({ char: segment, index });
    }
    index += 1;
  }
  words.push(word);
  return words.filter((letters) => letters.length > 0);
};

const nameWords = groupWords(personalData.name);

export const Profile = (): ReactElement => (
  <>
    <div className="relative z-10">
      <Portrait alt={en.card.portraitAlt} />
    </div>
    <h1
      className="name-signal type-display text-balance text-foreground"
      data-name=""
      data-text={personalData.name}
      id="card-name"
    >
      <span className="sr-only">{personalData.name}</span>
      <span aria-hidden="true" className="name-letters">
        {nameWords.map((word, wordIndex) => (
          <Fragment key={word.map(({ char }) => char).join("")}>
            {wordIndex > 0 ? " " : null}
            <span className="name-word">
              {word.map(({ char, index }) => (
                <span
                  className="name-letter"
                  key={`${String(index)}-${char}`}
                  style={{ "--i": index } as CSSProperties}
                >
                  {char}
                </span>
              ))}
            </span>
          </Fragment>
        ))}
      </span>
      <span
        aria-hidden="true"
        className="name-scan"
        data-text={personalData.name}
      />
    </h1>
    <p
      className="bio mt-(--card-gap-bio) max-w-xl type-body text-pretty text-foreground-soft text-halo-soft"
      data-blur-in=""
    >
      {bio.map((part, index) =>
        "term" in part ? (
          <span className="whitespace-nowrap" key={part.term.topic}>
            <TopicTrigger {...part.term} />
            {part.tail}
          </span>
        ) : (
          <CompoundText
            key={`${String(index)}-${part.text}`}
            text={part.text}
          />
        )
      )}
    </p>
    <CityPanel />
    {industries.map((industry) => (
      <IndustryPanel industry={industry} key={industry.key} />
    ))}
  </>
);
