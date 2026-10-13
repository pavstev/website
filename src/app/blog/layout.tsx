import type { ReactElement, ReactNode } from "react";

import { PageDock } from "@/components/page-dock";
import { SpaceBackground } from "@/components/space-background";
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
      <div data-blog="">
        <SpaceBackground mode="blog" />
        {children}
      </div>
      <div className="blog-dock">
        <PageDock email={contact.email} />
      </div>
    </>
  );
}
