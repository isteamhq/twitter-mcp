import { z } from "zod";
import type { TwitterClient, SearchResult } from "../client.js";

export const searchTweetsSchema = z.object({
  query: z
    .string()
    .describe(
      'Twitter search query. Supports operators: "exact phrase", from:user, -excludeWord, has:links, is:reply, lang:en etc.',
    ),
  max_results: z
    .number()
    .min(10)
    .max(100)
    .default(10)
    .describe("Number of results (10-100)"),
  next_token: z
    .string()
    .optional()
    .describe("Pagination token from previous search"),
});

export async function searchTweets(
  client: TwitterClient,
  args: z.infer<typeof searchTweetsSchema>,
): Promise<string> {
  const result = await client.searchTweets(args.query, args.max_results, args.next_token);
  return formatSearchResult(result);
}

export const getUserMentionsSchema = z.object({
  max_results: z
    .number()
    .min(5)
    .max(100)
    .default(10)
    .describe("Number of mentions to fetch"),
});

export async function getUserMentions(
  client: TwitterClient,
  args: z.infer<typeof getUserMentionsSchema>,
): Promise<string> {
  const me = await client.getMe();
  const result = await client.getUserMentions(me.id, args.max_results);
  return formatSearchResult(result);
}

export const getUserTweetsSchema = z.object({
  username: z.string().describe("Twitter username (without @)"),
  max_results: z
    .number()
    .min(5)
    .max(100)
    .default(10)
    .describe("Number of tweets to fetch"),
});

export async function getUserTweets(
  client: TwitterClient,
  args: z.infer<typeof getUserTweetsSchema>,
): Promise<string> {
  const user = await client.getUserByUsername(args.username);
  const tweets = await client.getUserTweets(user.id, args.max_results);

  const lines = [`@${user.username} (${user.name}) — ${user.public_metrics?.followers_count ?? 0} followers\n`];
  for (const t of tweets) {
    lines.push(`[${t.id}] ${t.created_at ?? ""}`);
    lines.push(t.text);
    if (t.public_metrics) {
      lines.push(
        `  ❤️ ${t.public_metrics.like_count}  🔁 ${t.public_metrics.retweet_count}  💬 ${t.public_metrics.reply_count}`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

function formatSearchResult(result: SearchResult): string {
  if (result.tweets.length === 0) {
    return "No tweets found.";
  }

  const lines: string[] = [];
  for (const t of result.tweets) {
    const author = t.author_id ? result.users[t.author_id] : undefined;
    const handle = author ? `@${author.username}` : t.author_id ?? "unknown";
    const followers = author?.public_metrics?.followers_count ?? 0;

    lines.push(`[${t.id}] ${handle} (${followers} followers) — ${t.created_at ?? ""}`);
    lines.push(t.text);
    if (t.public_metrics) {
      lines.push(
        `  ❤️ ${t.public_metrics.like_count}  🔁 ${t.public_metrics.retweet_count}  💬 ${t.public_metrics.reply_count}  👁 ${t.public_metrics.impression_count ?? 0}`,
      );
    }
    lines.push("");
  }

  if (result.nextToken) {
    lines.push(`--- next_token: ${result.nextToken} ---`);
  }

  return lines.join("\n");
}
