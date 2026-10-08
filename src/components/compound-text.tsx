import { type ReactElement } from "react";

import { splitCompounds } from "@/lib/bio";

interface CompoundTextProps {
  text: string;
}

export const CompoundText = ({ text }: CompoundTextProps): ReactElement => (
  <>
    {splitCompounds(text).map(({ compound, text: piece }, index) =>
      compound ? (
        <span className="whitespace-nowrap" key={`${String(index)}-${piece}`}>
          {piece}
        </span>
      ) : (
        piece
      )
    )}
  </>
);
