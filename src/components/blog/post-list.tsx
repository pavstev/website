import Link from "next/link";
import { type ReactElement, ViewTransition } from "react";

import { PostDate } from "@/components/blog/post-date";
import { PostTags } from "@/components/blog/post-tags";
import { minutesLabel } from "@/lib/blog/format";
import { isScheduled } from "@/lib/blog/schedule";
import { type PostMeta } from "@/lib/blog/schema";
import { en } from "@/lib/i18n";

interface PostListProps {
  posts: readonly PostMeta[];
}

export const PostList = ({ posts }: PostListProps): ReactElement => (
  <ol className="post-list">
    {posts.map((post) => (
      <li className="post-row" data-post-slug={post.slug} key={post.slug}>
        <ViewTransition
          default="none"
          name={`title-${post.slug}`}
          share="morph"
        >
          <h2 className="post-row-title text-sky">
            <Link
              className="post-row-link focus-ring"
              href={`/blog/${post.slug}`}
              prefetch={false}
            >
              {post.title}
            </Link>
          </h2>
        </ViewTransition>
        <p className="post-row-meta type-chip text-sky">
          <PostDate iso={post.date} /> <span aria-hidden="true">·</span>{" "}
          <span>{minutesLabel(post.readingMinutes)}</span>
          {post.draft && <span className="post-draft"> {en.blog.draft}</span>}
          {!post.draft && isScheduled(post.date) && (
            <span className="post-draft"> {en.blog.scheduled}</span>
          )}
        </p>
        <p className="post-row-text text-sky">{post.description}</p>
        <PostTags tags={post.tags} unlabeled />
      </li>
    ))}
  </ol>
);
