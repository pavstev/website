import type { CSSProperties, ReactElement } from "react";

import { CityPanel } from "@/components/city-panel";
import { CityTrigger } from "@/components/city-trigger";
import { Portrait } from "@/components/portrait";
import { en } from "@/lib/i18n";
import { personalData } from "@/lib/personal";

const [summaryBefore = "", ...summaryRest] = personalData.summary.split(
  personalData.city
);
const summaryAfter = summaryRest.join(personalData.city);

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
      {summaryBefore}
      <CityTrigger />
      {summaryAfter}
    </p>
    <CityPanel />
  </>
);
