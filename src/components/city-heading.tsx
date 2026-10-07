import type { ReactElement } from "react";

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
  <>
    <ViennaArms
      className="city-arms"
      idPrefix={idPrefix}
      label={cityStrings.armsLabel}
    />
    <div className="city-titles">
      <h2 className="city-title" id={titleId}>
        {personalData.city}
      </h2>
      <p className="city-country">{personalData.country}</p>
    </div>
  </>
);
