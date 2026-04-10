# @isteam/twitter-mcp

[![npm version](https://img.shields.io/npm/v/@isteam/twitter-mcp.svg)](https://www.npmjs.com/package/@isteam/twitter-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

MCP server for Twitter/X — search tweets, post, reply, and engage via AI agents.

Built by [is.team](https://is.team) — the AI-native project management platform.

## Quick Start

Add to your MCP config (`.mcp.json` for Claude Code, or Claude Desktop settings):

```json
{
  "mcpServers": {
    "twitter": {
      "command": "npx",
      "args": ["-y", "@isteam/twitter-mcp"],
      "env": {
        "TWITTER_API_KEY": "your-api-key",
        "TWITTER_API_SECRET": "your-api-secret",
        "TWITTER_ACCESS_TOKEN": "your-access-token",
        "TWITTER_ACCESS_TOKEN_SECRET": "your-access-token-secret"
      }
    }
  }
}
```

## Tools (15)

### Search & Discovery

| Tool | Description |
|------|-------------|
| `search_tweets` | Search tweets by keywords, hashtags, or phrases (max 100 results) |
| `get_mentions` | Get recent mentions of the authenticated user |
| `get_user_tweets` | Get a user's recent tweets by username |

### Engagement

| Tool | Description |
|------|-------------|
| `post_tweet` | Post a new tweet (max 280 characters) |
| `reply_tweet` | Reply to a tweet |
| `quote_tweet` | Quote tweet with your commentary |
| `delete_tweet` | Delete a tweet |
| `like_tweet` | Like a tweet |
| `retweet` | Retweet a tweet |
| `follow_user` | Follow a user by username |

### User & Profile

| Tool | Description |
|------|-------------|
| `get_me` | Get authenticated user info (followers, following, tweet count) |
| `get_tweet` | Get a specific tweet with author info and metrics |
| `get_user` | Look up a user by username |
| `update_profile` | Update your profile (name, bio, url, location) |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TWITTER_API_KEY` | Yes | Twitter API key (consumer key) |
| `TWITTER_API_SECRET` | Yes | Twitter API secret (consumer secret) |
| `TWITTER_ACCESS_TOKEN` | Yes | OAuth 1.0a access token |
| `TWITTER_ACCESS_TOKEN_SECRET` | Yes | OAuth 1.0a access token secret |

### Getting your credentials

1. Go to the [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a project and app
3. Set up OAuth 1.0a with read and write permissions
4. Generate your access token and secret from the "Keys and tokens" tab
5. Copy all four values into your MCP config

## Rate Limits & Agent Safety

Twitter API v2 enforces per-endpoint rate limits in 15-minute windows:

| Endpoint | Limit | Notes |
|----------|-------|-------|
| `POST /2/tweets` (post, reply, quote) | 300 / 15 min | ~20/min |
| `GET /2/tweets/search/recent` | 450 / 15 min | Requires Basic tier |
| `POST /2/users/:id/likes` | 300 / 15 min | |
| `POST /2/users/:id/retweets` | 300 / 15 min | |
| `POST /2/users/:id/following` | 300 / 15 min | |
| `GET /2/users/:id/mentions` | 450 / 15 min | |

**Idempotency note:** Twitter API does not deduplicate identical tweets — posting the same text twice creates two tweets. If your agent retries on timeout, it may create duplicates. Use `get_user_tweets` to verify before retrying a post.

**Backoff:** When rate-limited, the API returns `429 Too Many Requests` with a `x-rate-limit-reset` header (Unix timestamp). Wait until that time before retrying.

## Usage Examples

**Monitor your brand:**
> "Search for tweets mentioning 'is.team' in the last 24 hours and show engagement metrics"

**Engage with your audience:**
> "Check my recent mentions and reply to any questions with helpful answers"

**Post an update:**
> "Tweet: Just shipped our new AI-powered project management feature! Check it out at is.team"

## About is.team

[is.team](https://is.team) is an AI-native project management platform where AI agents and humans collaborate as real teammates. AI agents join boards, create tasks, chat, and get work done — just like any other team member.

Part of the [is.team](https://is.team) open-source MCP ecosystem:
- [@isteam/mcp](https://www.npmjs.com/package/@isteam/mcp) — Project management
- [@isteam/google-ads-mcp](https://www.npmjs.com/package/@isteam/google-ads-mcp) — Google Ads
- [@isteam/twitter-mcp](https://www.npmjs.com/package/@isteam/twitter-mcp) — Twitter/X
- [@isteam/bluesky-mcp](https://www.npmjs.com/package/@isteam/bluesky-mcp) — Bluesky
- [@isteam/linkedin-mcp](https://www.npmjs.com/package/@isteam/linkedin-mcp) — LinkedIn

## License

MIT
