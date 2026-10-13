import type { ReactElement } from "react";

import { BlogHeader } from "@/components/blog/blog-header";
import { Pagination } from "@/components/blog/pagination";
import { PostList } from "@/components/blog/post-list";
import { TagRow } from "@/components/blog/tag-row";
import { Icon } from "@/components/icon";
import { SiteFooter } from "@/components/site-footer";
import { type Listing } from "@/lib/blog/listing";
import { en } from "@/lib/i18n";

interface BlogIndexProps {
  heading: string;
  jsonLd?: string | undefined;
  listing: Listing;
}

const countLabel = (total: number): string =>
  (total === 1 ? en.blog.postCountOne : en.blog.postCountOther).replace(
    "{n}",
    () => String(total)
  );

export const BlogIndex = ({
  heading,
  jsonLd,
  listing,
}: BlogIndexProps): ReactElement => (
  <>
    {jsonLd !== undefined && (
      <script
        dangerouslySetInnerHTML={{ __html: jsonLd }}
        type="application/ld+json"
      />
    )}
    <main className="blog-main" id="main-content">
      <BlogHeader
        meta={
          <>
            <span>{countLabel(listing.total)}</span>
            <span aria-hidden="true"> · </span>
            <a
              className="blog-rss focus-ring"
              href="/blog/feed.xml"
              type="application/rss+xml"
            >
              <Icon name="lucide:rss" size="0.75rem" />
              {en.blog.rss}
            </a>
          </>
        }
        title={heading}
      />
      <section aria-labelledby="blog-title" className="blog-index">
        <TagRow current={listing.tag?.slug} tags={listing.tags} />
        <PostList posts={listing.posts} />
        <Pagination
          base={listing.base}
          count={listing.count}
          page={listing.page}
        />
      </section>
      <SiteFooter className="blog-footer" rss />
    </main>
  </>
);
