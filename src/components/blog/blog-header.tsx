import { type ReactElement, type ReactNode, ViewTransition } from "react";

import { BackButton } from "@/components/blog/back-button";
import { BarSpy } from "@/components/blog/bar-spy";
import { Icon } from "@/components/icon";
import { MotionToggle } from "@/components/motion-toggle";
import { en } from "@/lib/i18n";

interface BlogHeaderProps {
  children?: ReactNode;
  meta: ReactNode;
  slug?: string;
  title: string;
  toc?: boolean;
}

export const BlogHeader = ({
  children,
  meta,
  slug,
  title,
  toc = false,
}: BlogHeaderProps): ReactElement => {
  const heading = (
    <h1 className="blog-title text-sky" id="blog-title">
      {title}
    </h1>
  );
  return (
    <>
      <div className="blog-bar" data-blog-bar="">
        <div aria-hidden="true" className="blog-bar-glass" />
        <div className="blog-bar-row">
          <BackButton>
            <Icon name="lucide:arrow-left" size="0.75rem" />
          </BackButton>
          <p aria-hidden="true" className="blog-bar-title">
            {title}
          </p>
          {toc && (
            <button
              aria-controls="toc-drawer"
              aria-haspopup="dialog"
              aria-label={en.blog.toc}
              className="blog-bar-toc focus-ring"
              data-toc-open=""
              type="button"
            >
              <Icon name="lucide:list" size="1rem" />
              <span aria-hidden="true" className="blog-bar-toc-label">
                {en.blog.toc}
              </span>
            </button>
          )}
          <div className="blog-bar-slot" data-bar-slot="">
            <MotionToggle variant="bar" />
          </div>
        </div>
      </div>
      <BarSpy />
      <header className="blog-header" data-sky-header="">
        <p className="blog-header-meta type-chip text-sky">{meta}</p>
        {slug === undefined ? (
          heading
        ) : (
          <ViewTransition default="none" name={`title-${slug}`} share="morph">
            {heading}
          </ViewTransition>
        )}
        {children}
      </header>
    </>
  );
};
