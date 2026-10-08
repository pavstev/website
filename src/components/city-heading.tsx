import type { ReactElement } from "react";

import { TopicHeading } from "@/components/topic-heading";
import { ViennaArms } from "@/components/vienna-arms";
import { cityStrings } from "@/lib/city";
import { personalData } from "@/lib/personal";

interface CityHeadingProps {
  idPrefix: string;
  titleId: string;
}

export const CityHeading = ({
  idPrefix,
  titleId,
}: CityHeadingProps): ReactElement => (
  <TopicHeading
    emblem={
      <ViennaArms
        className="topic-emblem"
        idPrefix={idPrefix}
        label={cityStrings.armsLabel}
      />
    }
    subtitle={personalData.country}
    title={personalData.city}
    titleId={titleId}
  />
);
