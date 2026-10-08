import type { ReactElement } from "react";

import { PrivacyNote } from "@/components/privacy-note";

interface PageDockProps {
  email: string;
}

export const PageDock = ({ email }: PageDockProps): ReactElement => (
  <footer className="page-dock">
    <PrivacyNote email={email} />
  </footer>
);
