import { showDrafts } from "./build-env.ts";
import { listPosts } from "./posts.ts";

export const blogLive = (): boolean =>
  listPosts({ drafts: showDrafts() }).length > 0;
