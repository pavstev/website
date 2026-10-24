import type { ReactElement } from "react";

import { PrivacyNote } from "@/components/privacy-note";
import { en } from "@/lib/i18n";

interface PageDockProps {
  email: string;
}

export const PageDock = ({ email }: PageDockProps): ReactElement => (
  <aside aria-label={en.privacy.label} className="page-dock">
    <PrivacyNote email={email} />
  </aside>
);
