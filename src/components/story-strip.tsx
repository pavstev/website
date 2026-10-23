import type { ReactElement } from "react";

import { Icon } from "@/components/icon";
import { StoryMark } from "@/components/story-mark";
import { en } from "@/lib/i18n";
import { fillText } from "@/lib/template";
import { type StoryEntry } from "@/lib/work";

export const StoryStrip = ({
  stories,
}: {
  stories: readonly StoryEntry[];
}): ReactElement => (
  <ol className="work-stories" data-stories="">
    {stories.map(({ key, path }) => {
      const copy = en.work.stories[key];
      return (
        <li
          className="post-row work-story mat-panel"
          data-story={key}
          key={key}
        >
          <StoryMark kind={key} />
          <div className="work-story-body">
            <p className="work-story-eyebrow">
              {fillText(en.work.stories.eyebrow, { repo: key })}
            </p>
            <h3 className="post-row-title work-card-name">
              <a
                aria-describedby={`story-line-${key}`}
                className="post-row-link focus-ring"
                href={path}
              >
                {copy.title}
              </a>
            </h3>
            <p className="post-row-text" id={`story-line-${key}`}>
              {copy.line}
            </p>
          </div>
          <span aria-hidden="true" className="work-story-go">
            {en.work.stories.read}
            <Icon name="lucide:arrow-right" size="0.875rem" />
          </span>
        </li>
      );
    })}
  </ol>
);
