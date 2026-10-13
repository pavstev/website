import type { ReactElement, ReactNode } from "react";

import { BackButton } from "@/components/blog/back-button";
import { Icon } from "@/components/icon";
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
      <BackButton>
        <Icon name="lucide:arrow-left" size="0.75rem" />
      </BackButton>
      <MotionToggle />
      <div data-blog="">{children}</div>
      <div className="blog-dock">
        <PageDock email={contact.email} />
      </div>
    </>
  );
}
