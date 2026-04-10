import { z } from "zod";
import type { TwitterClient } from "../client.js";

export const postTweetSchema = z.object({
  text: z.string().max(280).describe("Tweet text (max 280 characters)"),
});

export async function postTweet(
  client: TwitterClient,
  args: z.infer<typeof postTweetSchema>,
): Promise<string> {
  const tweet = await client.postTweet(args.text);
  return `Tweet posted successfully!\nID: ${tweet.id}\nURL: https://x.com/i/status/${tweet.id}`;
}

export const replyTweetSchema = z.object({
  text: z.string().max(280).describe("Reply text (max 280 characters)"),
  tweet_id: z.string().describe("ID of the tweet to reply to"),
});

export async function replyTweet(
  client: TwitterClient,
  args: z.infer<typeof replyTweetSchema>,
): Promise<string> {
  const tweet = await client.replyToTweet(args.text, args.tweet_id);
  return `Reply posted successfully!\nID: ${tweet.id}\nURL: https://x.com/i/status/${tweet.id}\nIn reply to: https://x.com/i/status/${args.tweet_id}`;
}

export const quoteTweetSchema = z.object({
  text: z.string().max(280).describe("Quote text (max 280 characters)"),
  tweet_id: z.string().describe("ID of the tweet to quote"),
});

export async function quoteTweet(
  client: TwitterClient,
  args: z.infer<typeof quoteTweetSchema>,
): Promise<string> {
  const tweet = await client.quoteTweet(args.text, args.tweet_id);
  return `Quote tweet posted!\nID: ${tweet.id}\nURL: https://x.com/i/status/${tweet.id}`;
}

export const deleteTweetSchema = z.object({
  tweet_id: z.string().describe("ID of the tweet to delete"),
});

export async function deleteTweet(
  client: TwitterClient,
  args: z.infer<typeof deleteTweetSchema>,
): Promise<string> {
  const deleted = await client.deleteTweet(args.tweet_id);
  return deleted ? `Tweet ${args.tweet_id} deleted.` : `Failed to delete tweet ${args.tweet_id}.`;
}

export const likeTweetSchema = z.object({
  tweet_id: z.string().describe("ID of the tweet to like"),
});

export async function likeTweet(
  client: TwitterClient,
  args: z.infer<typeof likeTweetSchema>,
): Promise<string> {
  const liked = await client.likeTweet(args.tweet_id);
  return liked ? `Tweet ${args.tweet_id} liked!` : `Failed to like tweet.`;
}

export const retweetSchema = z.object({
  tweet_id: z.string().describe("ID of the tweet to retweet"),
});

export async function retweet(
  client: TwitterClient,
  args: z.infer<typeof retweetSchema>,
): Promise<string> {
  const retweeted = await client.retweet(args.tweet_id);
  return retweeted ? `Tweet ${args.tweet_id} retweeted!` : `Failed to retweet.`;
}

export const followUserSchema = z.object({
  username: z.string().describe("Username to follow (without @)"),
});

export async function followUser(
  client: TwitterClient,
  args: z.infer<typeof followUserSchema>,
): Promise<string> {
  const user = await client.getUserByUsername(args.username);
  const following = await client.followUser(user.id);
  return following
    ? `Now following @${args.username}!`
    : `Failed to follow @${args.username}.`;
}
