import type { ReactElement } from "react";

import { en } from "@/lib/i18n";
import { personalData } from "@/lib/personal";
import { weatherSourceUrl } from "@/lib/weather";

interface BlogFooterProps {
  weatherCredit?: boolean;
}

export const BlogFooter = ({
  weatherCredit = false,
}: BlogFooterProps): ReactElement => {
  const year = new Date().getFullYear();
  return (
    <div className="blog-footer type-chip">
      <p className="tabular text-sky">
        © {year} <span className="whitespace-nowrap">{personalData.name}</span>
        <span aria-hidden="true"> · </span>
        <a
          className="focus-ring"
          href="/blog/feed.xml"
          type="application/rss+xml"
        >
          {en.blog.rss}
        </a>
      </p>
      {weatherCredit && (
        <p className="weather-credit text-sky">
          {en.weather.credit}{" "}
          <a className="focus-ring" href={weatherSourceUrl}>
            {en.weather.source}
          </a>
        </p>
      )}
    </div>
  );
};
