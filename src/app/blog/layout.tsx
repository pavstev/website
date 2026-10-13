import type { ReactElement, ReactNode } from "react";

import { MotionToggle } from "@/components/motion-toggle";
import { PageDock } from "@/components/page-dock";
import { getContact } from "@/lib/github";
import { personalData } from "@/lib/personal";

interface BlogLayoutProps {
  children: ReactNode;
}

export default async function BlogLayout({
  children,
}: BlogLayoutProps): Promise<ReactElement> {
  const contact = await getContact(personalData.githubHandle);
  return (
    <>
      <MotionToggle />
      <div data-blog="">{children}</div>
      <PageDock email={contact.email} />
    </>
  );
}
