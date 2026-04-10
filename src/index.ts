import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { TwitterClient } from "./client.js";

// Tools — search
import {
  searchTweetsSchema,
  searchTweets,
  getUserMentionsSchema,
  getUserMentions,
  getUserTweetsSchema,
  getUserTweets,
} from "./tools/search.js";

// Tools — engage
import {
  postTweetSchema,
  postTweet,
  replyTweetSchema,
  replyTweet,
  quoteTweetSchema,
  quoteTweet,
  deleteTweetSchema,
  deleteTweet,
  likeTweetSchema,
  likeTweet,
  retweetSchema,
  retweet,
  followUserSchema,
  followUser,
} from "./tools/engage.js";

// Tools — info
import {
  getMeSchema,
  getMe,
  getTweetSchema,
  getTweet,
  getUserSchema,
  getUser,
  updateProfileSchema,
  updateProfile,
} from "./tools/info.js";

// ─── Server setup ─────────────────────────────────────────────────

const server = new McpServer({
  name: "twitter",
  version: "1.0.0",
});

let client: TwitterClient;

function ensureClient(): TwitterClient {
  if (!client) {
    client = new TwitterClient();
  }
  return client;
}

// ─── Search tools ─────────────────────────────────────────────────

server.tool(
  "search_tweets",
  "Search recent tweets. Supports operators: \"exact phrase\", from:user, -exclude, has:links, is:reply, lang:en. Requires Basic tier.",
  searchTweetsSchema.shape,
  async (args) => ({
    content: [{ type: "text", text: await searchTweets(ensureClient(), searchTweetsSchema.parse(args)) }],
  }),
);

server.tool(
  "get_mentions",
  "Get recent mentions of the authenticated account",
  getUserMentionsSchema.shape,
  async (args) => ({
    content: [{ type: "text", text: await getUserMentions(ensureClient(), getUserMentionsSchema.parse(args)) }],
  }),
);

server.tool(
  "get_user_tweets",
  "Get recent tweets from a specific user by username",
  getUserTweetsSchema.shape,
  async (args) => ({
    content: [{ type: "text", text: await getUserTweets(ensureClient(), getUserTweetsSchema.parse(args)) }],
  }),
);

// ─── Engage tools ─────────────────────────────────────────────────

server.tool(
  "post_tweet",
  "Post a new tweet (max 280 chars)",
  postTweetSchema.shape,
  async (args) => ({
    content: [{ type: "text", text: await postTweet(ensureClient(), postTweetSchema.parse(args)) }],
  }),
);

server.tool(
  "reply_tweet",
  "Reply to a specific tweet by its ID",
  replyTweetSchema.shape,
  async (args) => ({
    content: [{ type: "text", text: await replyTweet(ensureClient(), replyTweetSchema.parse(args)) }],
  }),
);

server.tool(
  "quote_tweet",
  "Quote tweet — add your commentary on top of another tweet",
  quoteTweetSchema.shape,
  async (args) => ({
    content: [{ type: "text", text: await quoteTweet(ensureClient(), quoteTweetSchema.parse(args)) }],
  }),
);

server.tool(
  "delete_tweet",
  "Delete a tweet by ID",
  deleteTweetSchema.shape,
  async (args) => ({
    content: [{ type: "text", text: await deleteTweet(ensureClient(), deleteTweetSchema.parse(args)) }],
  }),
);

server.tool(
  "like_tweet",
  "Like a tweet by ID",
  likeTweetSchema.shape,
  async (args) => ({
    content: [{ type: "text", text: await likeTweet(ensureClient(), likeTweetSchema.parse(args)) }],
  }),
);

server.tool(
  "retweet",
  "Retweet a tweet by ID",
  retweetSchema.shape,
  async (args) => ({
    content: [{ type: "text", text: await retweet(ensureClient(), retweetSchema.parse(args)) }],
  }),
);

server.tool(
  "follow_user",
  "Follow a user by username",
  followUserSchema.shape,
  async (args) => ({
    content: [{ type: "text", text: await followUser(ensureClient(), followUserSchema.parse(args)) }],
  }),
);

// ─── Info tools ───────────────────────────────────────────────────

server.tool(
  "get_me",
  "Get info about the authenticated Twitter/X account",
  getMeSchema.shape,
  async () => ({
    content: [{ type: "text", text: await getMe(ensureClient()) }],
  }),
);

server.tool(
  "get_tweet",
  "Get details of a specific tweet by ID (author, metrics, text)",
  getTweetSchema.shape,
  async (args) => ({
    content: [{ type: "text", text: await getTweet(ensureClient(), getTweetSchema.parse(args)) }],
  }),
);

server.tool(
  "get_user",
  "Look up a Twitter user profile by username",
  getUserSchema.shape,
  async (args) => ({
    content: [{ type: "text", text: await getUser(ensureClient(), getUserSchema.parse(args)) }],
  }),
);

server.tool(
  "update_profile",
  "Update Twitter profile — name, bio/description, url, location (v1.1 API)",
  updateProfileSchema.shape,
  async (args) => ({
    content: [{ type: "text", text: await updateProfile(ensureClient(), updateProfileSchema.parse(args)) }],
  }),
);

// ─── Start ────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[twitter-mcp] Server started");
}

main().catch((err) => {
  console.error("[twitter-mcp] Fatal:", err);
  process.exit(1);
});
