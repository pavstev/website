import type { ReactElement } from "react";

import { MotionToggle } from "@/components/motion-toggle";
import { PrivacyNote } from "@/components/privacy-note";

interface PageDockProps {
  email: string;
}

export const PageDock = ({ email }: PageDockProps): ReactElement => (
  <footer className="page-dock">
    <MotionToggle />
    <PrivacyNote email={email} />
  </footer>
);
