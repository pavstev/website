import type { CSSProperties, ReactElement } from "react";

import { CityPanel } from "@/components/city-panel";
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

const letters = Array.from(
  new Intl.Segmenter("en", { granularity: "grapheme" }).segment(
    personalData.name
  ),
  (part) => part.segment
);

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
        {letters.map((char, index) => (
          <span
            className="name-letter"
            key={`${String(index)}-${char}`}
            style={{ "--i": index } as CSSProperties}
          >
            {char}
          </span>
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
      {bio.map((part) =>
        "term" in part ? (
          <span className="whitespace-nowrap" key={part.term.topic}>
            <TopicTrigger {...part.term} />
            {part.tail}
          </span>
        ) : (
          part.text
        )
      )}
    </p>
    <CityPanel />
    {industries.map((industry) => (
      <IndustryPanel industry={industry} key={industry.key} />
    ))}
  </>
);
