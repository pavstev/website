import type { ReactElement } from "react";

import type { Contact } from "@/lib/github";
import type { ResumeFacts } from "@/lib/resume-facts";

import { ContactLinks } from "@/components/contact-links";
import { DownloadButton } from "@/components/download-button";
import { ResumeTip } from "@/components/resume-tip";
import { TooltipGroup } from "@/components/ui/tooltip";

interface CardActionsProps {
  contact: Contact;
  facts: ResumeFacts;
}

export const CardActions = ({
  contact,
  facts,
}: CardActionsProps): ReactElement => (
  <TooltipGroup>
    <DownloadButton tip={<ResumeTip facts={facts} />} />
    <div className="contact-group flex items-center justify-center gap-3">
      <ContactLinks contact={contact} />
    </div>
  </TooltipGroup>
);
