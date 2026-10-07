import type { ReactElement } from "react";

import { Icon } from "@/components/icon";
import { Portrait } from "@/components/portrait";
import { en } from "@/lib/i18n";
import { personalData } from "@/lib/personal";

const [summaryBefore = "", ...summaryRest] = personalData.summary.split(
  personalData.city
);
const summaryAfter = summaryRest.join(personalData.city);

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
      {personalData.name}
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
      <span className="whitespace-nowrap">
        {personalData.city}
        <Icon
          aria-hidden
          className="bio-flag"
          name="circle-flags:at"
          size="0.95em"
        />
      </span>
      {summaryAfter}
    </p>
  </>
);
