import { type ReactElement, ViewTransition } from "react";

import { PostTags } from "@/components/blog/post-tags";
import { SpaceBackground } from "@/components/space-background";
import { formatPostDate, minutesLabel } from "@/lib/blog/format";
import { type PostMeta } from "@/lib/blog/schema";
import { en } from "@/lib/i18n";

interface PostHeaderProps {
  post: PostMeta;
}

export const PostHeader = ({ post }: PostHeaderProps): ReactElement => (
  <header className="post-header" data-post-slug={post.slug} data-sky-header="">
    <SpaceBackground key={post.slug} mode="post" preset={post.sky} />
    <ViewTransition default="none" name={`moon-${post.slug}`} share="morph">
      <span aria-hidden="true" className="post-eclipse" data-eclipse="" />
    </ViewTransition>
    <ViewTransition default="none" name={`title-${post.slug}`} share="morph">
      <h1 className="post-title text-sky">{post.title}</h1>
    </ViewTransition>
    <p className="post-meta type-chip text-sky">
      <span className="sr-only">{en.blog.published} </span>
      <time dateTime={post.date}>{formatPostDate(post.date)}</time>
      <span aria-hidden="true"> · </span>
      <span>{minutesLabel(post.readingMinutes)}</span>
      {post.updated !== undefined && (
        <>
          <span aria-hidden="true"> · </span>
          <span>
            {en.blog.updated}{" "}
            <time dateTime={post.updated}>{formatPostDate(post.updated)}</time>
          </span>
        </>
      )}
      {post.draft && <span className="post-draft"> {en.blog.draft}</span>}
    </p>
    <PostTags className="post-header-tags" tags={post.tags} />
  </header>
);
