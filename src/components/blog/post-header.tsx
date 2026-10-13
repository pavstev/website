import type { ReactElement } from "react";

import { BlogHeader } from "@/components/blog/blog-header";
import { PostDate } from "@/components/blog/post-date";
import { PostTags } from "@/components/blog/post-tags";
import { minutesLabel } from "@/lib/blog/format";
import { isScheduled } from "@/lib/blog/schedule";
import { type PostMeta } from "@/lib/blog/schema";
import { en } from "@/lib/i18n";

interface PostHeaderProps {
  post: PostMeta;
  toc: boolean;
}

export const PostHeader = ({ post, toc }: PostHeaderProps): ReactElement => (
  <BlogHeader
    meta={
      <>
        <span className="sr-only">{en.blog.published} </span>
        <PostDate iso={post.date} />
        <span aria-hidden="true"> · </span>
        <span>{minutesLabel(post.readingMinutes)}</span>
        {post.updated !== undefined && (
          <>
            <span aria-hidden="true"> · </span>
            <span>
              {en.blog.updated} <PostDate iso={post.updated} />
            </span>
          </>
        )}
        {post.draft && <span className="post-draft"> {en.blog.draft}</span>}
        {!post.draft && isScheduled(post.date) && (
          <span className="post-draft"> {en.blog.scheduled}</span>
        )}
      </>
    }
    slug={post.slug}
    title={post.title}
    toc={toc}
  >
    <PostTags className="post-header-tags" tags={post.tags} />
  </BlogHeader>
);
