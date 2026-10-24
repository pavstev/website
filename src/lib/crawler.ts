const crawlerPattern =
  /(?<!cu)bot|spider|crawl|slurp|preview|lighthouse|headless|externalhit|whatsapp|embedly|iframely|google-|googleother|chatgpt|perplexity|mastodon|cardyb|vkshare|validator|pagespeed/i;

export const isCrawler = (userAgent: string): boolean =>
  crawlerPattern.test(userAgent);
