import type { ReactElement } from "react";

interface TipLabelProps {
  detail?: string | undefined;
  name: string;
}

export const TipLabel = ({ detail, name }: TipLabelProps): ReactElement => (
  <>
    <span className="tip-label-name">{name}</span>{" "}
    {detail ? <span className="tip-label-detail">{detail}</span> : null}
  </>
);
