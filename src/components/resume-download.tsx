import type { ReactElement } from "react";

import type { ResumeFacts } from "@/lib/resume-facts";

import { DownloadButton } from "@/components/download-button";
import { ResumeTip } from "@/components/resume-tip";

interface ResumeDownloadProps {
  detailId: string;
  facts: ResumeFacts;
}

export const ResumeDownload = ({
  detailId,
  facts,
}: ResumeDownloadProps): ReactElement => (
  <DownloadButton describedBy={detailId}>
    <ResumeTip detailId={detailId} facts={facts} />
  </DownloadButton>
);
