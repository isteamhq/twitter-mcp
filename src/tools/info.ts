import { z } from "zod";
import type { TwitterClient } from "../client.js";

export const getMeSchema = z.object({});

export async function getMe(client: TwitterClient): Promise<string> {
  const user = await client.getMe();
  const lines = [
    `@${user.username} (${user.name})`,
    user.description ?? "",
    "",
    `Followers: ${user.public_metrics?.followers_count ?? 0}`,
    `Following: ${user.public_metrics?.following_count ?? 0}`,
    `Tweets: ${user.public_metrics?.tweet_count ?? 0}`,
  ];
  return lines.join("\n");
}

export const getTweetSchema = z.object({
  tweet_id: z.string().describe("Tweet ID to look up"),
});

export async function getTweet(
  client: TwitterClient,
  args: z.infer<typeof getTweetSchema>,
): Promise<string> {
  const tweet = await client.getTweet(args.tweet_id);
  const lines = [
    `Tweet [${tweet.id}]`,
    tweet.author ? `By: @${tweet.author.username} (${tweet.author.name}) — ${tweet.author.public_metrics?.followers_count ?? 0} followers` : "",
    `Date: ${tweet.created_at ?? "unknown"}`,
    "",
    tweet.text,
    "",
  ];
  if (tweet.public_metrics) {
    lines.push(
      `❤️ ${tweet.public_metrics.like_count}  🔁 ${tweet.public_metrics.retweet_count}  💬 ${tweet.public_metrics.reply_count}  👁 ${tweet.public_metrics.impression_count ?? 0}`,
    );
  }
  lines.push(`\nURL: https://x.com/i/status/${tweet.id}`);
  return lines.join("\n");
}

export const updateProfileSchema = z.object({
  name: z.string().max(50).optional().describe("Display name (max 50 chars)"),
  description: z.string().max(160).optional().describe("Bio/description (max 160 chars)"),
  url: z.string().optional().describe("Profile website URL"),
  location: z.string().max(30).optional().describe("Location (max 30 chars)"),
});

export async function updateProfile(
  client: TwitterClient,
  args: z.infer<typeof updateProfileSchema>,
): Promise<string> {
  const result = await client.updateProfile(args);
  const lines = [
    "Profile updated!",
    "",
    `Name: ${result.name}`,
    `Bio: ${result.description}`,
    `URL: ${result.url}`,
    `Location: ${result.location}`,
  ];
  return lines.join("\n");
}

export const getUserSchema = z.object({
  username: z.string().describe("Twitter username (without @)"),
});

export async function getUser(
  client: TwitterClient,
  args: z.infer<typeof getUserSchema>,
): Promise<string> {
  const user = await client.getUserByUsername(args.username);
  const lines = [
    `@${user.username} (${user.name})`,
    user.description ?? "",
    "",
    `Followers: ${user.public_metrics?.followers_count ?? 0}`,
    `Following: ${user.public_metrics?.following_count ?? 0}`,
    `Tweets: ${user.public_metrics?.tweet_count ?? 0}`,
    `\nProfile: https://x.com/${user.username}`,
  ];
  return lines.join("\n");
}
