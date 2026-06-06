import { buildOAuth1Header } from "./oauth.js";

const API_BASE = "https://api.twitter.com/2";
const DEFAULT_XQUIK_BASE = "https://xquik.com";
const XQUIK_SEARCH_PATH = "/api/v1/x/tweets/search";
const XQUIK_USER_SEARCH_PATH = "/api/v1/x/users/search";

interface TwitterCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

interface XquikConfig {
  baseUrl: string;
  apiKey: string;
}

export interface TweetData {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    impression_count: number;
  };
  conversation_id?: string;
}

export interface UserData {
  id: string;
  name: string;
  username: string;
  description?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
}

export interface SearchResult {
  tweets: TweetData[];
  users: Record<string, UserData>;
  nextToken?: string;
}

export class TwitterClient {
  private creds?: TwitterCredentials;
  private xquik?: XquikConfig;
  private xquikUsernamesById = new Map<string, string>();

  constructor() {
    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN;
    const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
    const xquikApiKey = process.env.XQUIK_API_KEY ?? process.env.HERMES_TWEET_API_KEY;

    if (xquikApiKey) {
      this.xquik = {
        apiKey: xquikApiKey,
        baseUrl: process.env.XQUIK_BASE_URL ?? DEFAULT_XQUIK_BASE,
      };
    }

    if (apiKey && apiSecret && accessToken && accessTokenSecret) {
      this.creds = { apiKey, apiSecret, accessToken, accessTokenSecret };
    }

    if (!this.creds && !this.xquik) {
      throw new Error(
        "Missing credentials. Set Twitter OAuth variables or XQUIK_API_KEY/HERMES_TWEET_API_KEY for read-only tools.",
      );
    }
  }

  private ensureTwitterCredentials(): TwitterCredentials {
    if (!this.creds) {
      throw new Error(
        "Twitter OAuth credentials are required for this tool. Set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET.",
      );
    }
    return this.creds;
  }

  // ─── GET requests ───────────────────────────────────────────────

  private async get(path: string, params?: Record<string, string>): Promise<unknown> {
    const url = new URL(`${API_BASE}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    // OAuth needs the base URL without query string, but query params in signature
    const baseUrl = `${API_BASE}${path}`;
    const creds = this.ensureTwitterCredentials();
    const oauthHeader = buildOAuth1Header(
      "GET",
      baseUrl,
      creds.apiKey,
      creds.apiSecret,
      creds.accessToken,
      creds.accessTokenSecret,
      params,
    );

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Authorization: oauthHeader },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Twitter API ${res.status}: ${body}`);
    }

    return res.json();
  }

  // ─── POST requests ──────────────────────────────────────────────

  private async post(path: string, body: Record<string, unknown>): Promise<unknown> {
    const url = `${API_BASE}${path}`;
    const creds = this.ensureTwitterCredentials();
    const oauthHeader = buildOAuth1Header(
      "POST",
      url,
      creds.apiKey,
      creds.apiSecret,
      creds.accessToken,
      creds.accessTokenSecret,
    );

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: oauthHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Twitter API ${res.status}: ${text}`);
    }

    return res.json();
  }

  // ─── DELETE requests ────────────────────────────────────────────

  private async delete(path: string): Promise<unknown> {
    const url = `${API_BASE}${path}`;
    const creds = this.ensureTwitterCredentials();
    const oauthHeader = buildOAuth1Header(
      "DELETE",
      url,
      creds.apiKey,
      creds.apiSecret,
      creds.accessToken,
      creds.accessTokenSecret,
    );

    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: oauthHeader },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Twitter API ${res.status}: ${text}`);
    }

    return res.json();
  }

  private async getXquik(path: string, params: Record<string, string>): Promise<unknown> {
    if (!this.xquik) {
      throw new Error("Xquik is not configured.");
    }

    const url = new URL(`${this.xquik.baseUrl.replace(/\/$/, "")}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.xquik.apiKey}`,
        "X-API-Key": this.xquik.apiKey,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Xquik API ${res.status}: ${text}`);
    }

    return res.json();
  }

  private readString(value: unknown, keys: string[]): string | undefined {
    if (!value || typeof value !== "object") return undefined;
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      const candidate = record[key];
      if (typeof candidate === "string" && candidate.length > 0) return candidate;
      if (typeof candidate === "number" || typeof candidate === "bigint") return String(candidate);
    }
    for (const child of Object.values(record)) {
      const nested = this.readString(child, keys);
      if (nested) return nested;
    }
    return undefined;
  }

  private readNumber(value: unknown, keys: string[]): number {
    const raw = this.readString(value, keys);
    if (!raw) return 0;
    const numeric = Number(raw.replaceAll(",", ""));
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private readList(value: unknown, keys: string[]): unknown[] {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== "object") return [];
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      const candidate = record[key];
      if (Array.isArray(candidate)) return candidate;
      const nested = this.readList(candidate, keys);
      if (nested.length > 0) return nested;
    }
    return [];
  }

  private readNextToken(value: unknown): string | undefined {
    return this.readString(value, ["next_token", "nextToken", "next_cursor", "nextCursor", "cursor"]);
  }

  private normalizeXquikTweet(raw: unknown, fallbackUsername?: string): TweetData {
    const id = this.readString(raw, ["id", "tweet_id", "tweetId", "rest_id"]) ?? "";
    const username = this.readString(raw, ["username", "screen_name", "screenName", "handle"]) ?? fallbackUsername;
    const authorId = this.readString(raw, ["author_id", "authorId", "user_id", "userId"]) ?? username ?? "xquik";
    if (username) {
      this.xquikUsernamesById.set(authorId, username.replace(/^@/, ""));
    }

    return {
      id,
      text: this.readString(raw, ["text", "full_text", "fullText", "content"]) ?? "",
      author_id: authorId,
      created_at: this.readString(raw, ["created_at", "createdAt", "time", "date", "timestamp"]),
      public_metrics: {
        retweet_count: this.readNumber(raw, ["retweet_count", "retweetCount", "retweets"]),
        reply_count: this.readNumber(raw, ["reply_count", "replyCount", "replies"]),
        like_count: this.readNumber(raw, ["like_count", "likeCount", "likes"]),
        quote_count: this.readNumber(raw, ["quote_count", "quoteCount", "quotes"]),
        impression_count: this.readNumber(raw, ["impression_count", "impressionCount", "views", "view_count", "viewCount"]),
      },
      conversation_id: this.readString(raw, ["conversation_id", "conversationId"]),
    };
  }

  private normalizeXquikUser(raw: unknown): UserData {
    const username = (this.readString(raw, ["username", "screen_name", "screenName", "handle"]) ?? "").replace(/^@/, "");
    const id = this.readString(raw, ["id", "user_id", "userId", "rest_id"]) ?? username;
    if (id && username) {
      this.xquikUsernamesById.set(id, username);
    }

    return {
      id,
      name: this.readString(raw, ["name", "display_name", "displayName"]) ?? username,
      username,
      description: this.readString(raw, ["description", "bio"]),
      public_metrics: {
        followers_count: this.readNumber(raw, ["followers_count", "followersCount", "followers"]),
        following_count: this.readNumber(raw, ["following_count", "followingCount", "following"]),
        tweet_count: this.readNumber(raw, ["tweet_count", "tweetCount", "tweets", "statuses_count", "statusesCount"]),
      },
    };
  }

  private async searchXquikTweets(query: string, maxResults = 10, nextToken?: string): Promise<SearchResult> {
    const params: Record<string, string> = {
      q: query,
      limit: Math.min(Math.max(maxResults, 1), 100).toString(),
    };
    if (nextToken) params.cursor = nextToken;

    const data = await this.getXquik(XQUIK_SEARCH_PATH, params);
    const tweets = this.readList(data, ["tweets", "data", "items", "results"]).map((tweet) =>
      this.normalizeXquikTweet(tweet),
    );

    const users: Record<string, UserData> = {};
    for (const tweet of tweets) {
      if (!tweet.author_id) continue;
      const username = this.xquikUsernamesById.get(tweet.author_id);
      if (!username) continue;
      users[tweet.author_id] = {
        id: tweet.author_id,
        name: username,
        username,
        public_metrics: {
          followers_count: 0,
          following_count: 0,
          tweet_count: 0,
        },
      };
    }

    return { tweets, users, nextToken: this.readNextToken(data) };
  }

  // ─── Public methods ─────────────────────────────────────────────

  /** Get authenticated user info */
  async getMe(): Promise<UserData> {
    const data = (await this.get("/users/me", {
      "user.fields": "description,public_metrics",
    })) as { data: UserData };
    return data.data;
  }

  /** Post a new tweet */
  async postTweet(text: string): Promise<TweetData> {
    const data = (await this.post("/tweets", { text })) as { data: TweetData };
    return data.data;
  }

  /** Reply to a tweet */
  async replyToTweet(text: string, tweetId: string): Promise<TweetData> {
    const data = (await this.post("/tweets", {
      text,
      reply: { in_reply_to_tweet_id: tweetId },
    })) as { data: TweetData };
    return data.data;
  }

  /** Quote tweet */
  async quoteTweet(text: string, quotedTweetId: string): Promise<TweetData> {
    const data = (await this.post("/tweets", {
      text,
      quote_tweet_id: quotedTweetId,
    })) as { data: TweetData };
    return data.data;
  }

  /** Delete a tweet */
  async deleteTweet(tweetId: string): Promise<boolean> {
    const data = (await this.delete(`/tweets/${tweetId}`)) as {
      data: { deleted: boolean };
    };
    return data.data.deleted;
  }

  /** Get a single tweet by ID */
  async getTweet(tweetId: string): Promise<TweetData & { author?: UserData }> {
    const data = (await this.get(`/tweets/${tweetId}`, {
      "tweet.fields": "author_id,created_at,public_metrics,conversation_id",
      expansions: "author_id",
      "user.fields": "name,username,description,public_metrics",
    })) as { data: TweetData; includes?: { users?: UserData[] } };

    const author = data.includes?.users?.[0];
    return { ...data.data, author };
  }

  /** Get multiple tweets by IDs */
  async getTweets(tweetIds: string[]): Promise<{ tweets: TweetData[]; users: Record<string, UserData> }> {
    const data = (await this.get("/tweets", {
      ids: tweetIds.join(","),
      "tweet.fields": "author_id,created_at,public_metrics,conversation_id",
      expansions: "author_id",
      "user.fields": "name,username,description,public_metrics",
    })) as { data: TweetData[]; includes?: { users?: UserData[] } };

    const users: Record<string, UserData> = {};
    for (const u of data.includes?.users ?? []) {
      users[u.id] = u;
    }
    return { tweets: data.data ?? [], users };
  }

  /** Search recent tweets (requires Basic tier — $200/mo) */
  async searchTweets(query: string, maxResults = 10, nextToken?: string): Promise<SearchResult> {
    if (this.xquik) {
      return this.searchXquikTweets(query, maxResults, nextToken);
    }

    const params: Record<string, string> = {
      query,
      max_results: Math.min(Math.max(maxResults, 10), 100).toString(),
      "tweet.fields": "author_id,created_at,public_metrics,conversation_id",
      expansions: "author_id",
      "user.fields": "name,username,description,public_metrics",
    };
    if (nextToken) params.next_token = nextToken;

    const data = (await this.get("/tweets/search/recent", params)) as {
      data?: TweetData[];
      includes?: { users?: UserData[] };
      meta?: { next_token?: string };
    };

    const users: Record<string, UserData> = {};
    for (const u of data.includes?.users ?? []) {
      users[u.id] = u;
    }

    return {
      tweets: data.data ?? [],
      users,
      nextToken: data.meta?.next_token,
    };
  }

  /** Get user's recent tweets */
  async getUserTweets(userId: string, maxResults = 10): Promise<TweetData[]> {
    if (this.xquik) {
      const username = this.xquikUsernamesById.get(userId);
      if (!username) {
        throw new Error("Call get_user first when using the Xquik read backend.");
      }
      const result = await this.searchXquikTweets(`from:${username} -filter:replies`, maxResults);
      return result.tweets;
    }

    const data = (await this.get(`/users/${userId}/tweets`, {
      max_results: Math.min(Math.max(maxResults, 5), 100).toString(),
      "tweet.fields": "created_at,public_metrics,conversation_id",
    })) as { data?: TweetData[] };
    return data.data ?? [];
  }

  /** Get user's mentions */
  async getUserMentions(userId: string, maxResults = 10): Promise<SearchResult> {
    const params: Record<string, string> = {
      max_results: Math.min(Math.max(maxResults, 5), 100).toString(),
      "tweet.fields": "author_id,created_at,public_metrics,conversation_id",
      expansions: "author_id",
      "user.fields": "name,username,description,public_metrics",
    };

    const data = (await this.get(`/users/${userId}/mentions`, params)) as {
      data?: TweetData[];
      includes?: { users?: UserData[] };
    };

    const users: Record<string, UserData> = {};
    for (const u of data.includes?.users ?? []) {
      users[u.id] = u;
    }

    return { tweets: data.data ?? [], users };
  }

  /** Lookup user by username */
  async getUserByUsername(username: string): Promise<UserData> {
    if (this.xquik) {
      const data = await this.getXquik(XQUIK_USER_SEARCH_PATH, {
        q: username.replace(/^@/, ""),
        limit: "1",
      });
      const users = this.readList(data, ["users", "data", "items", "results"]);
      const user = users[0] ? this.normalizeXquikUser(users[0]) : undefined;
      if (!user || !user.id) {
        throw new Error(`User @${username.replace(/^@/, "")} not found.`);
      }
      return user;
    }

    const data = (await this.get(`/users/by/username/${username}`, {
      "user.fields": "description,public_metrics",
    })) as { data: UserData };
    return data.data;
  }

  /** Like a tweet */
  async likeTweet(tweetId: string): Promise<boolean> {
    const me = await this.getMe();
    const data = (await this.post(`/users/${me.id}/likes`, {
      tweet_id: tweetId,
    })) as { data: { liked: boolean } };
    return data.data.liked;
  }

  /** Unlike a tweet */
  async unlikeTweet(tweetId: string): Promise<boolean> {
    const me = await this.getMe();
    const url = `${API_BASE}/users/${me.id}/likes/${tweetId}`;
    const creds = this.ensureTwitterCredentials();
    const oauthHeader = buildOAuth1Header(
      "DELETE",
      url,
      creds.apiKey,
      creds.apiSecret,
      creds.accessToken,
      creds.accessTokenSecret,
    );

    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: oauthHeader },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Twitter API ${res.status}: ${text}`);
    }

    const data = (await res.json()) as { data: { liked: boolean } };
    return !data.data.liked;
  }

  /** Retweet */
  async retweet(tweetId: string): Promise<boolean> {
    const me = await this.getMe();
    const data = (await this.post(`/users/${me.id}/retweets`, {
      tweet_id: tweetId,
    })) as { data: { retweeted: boolean } };
    return data.data.retweeted;
  }

  /** Follow a user */
  async followUser(targetUserId: string): Promise<boolean> {
    const me = await this.getMe();
    const data = (await this.post(`/users/${me.id}/following`, {
      target_user_id: targetUserId,
    })) as { data: { following: boolean } };
    return data.data.following;
  }

  /** Update profile (v1.1 API — name, bio, url, location) */
  async updateProfile(params: {
    name?: string;
    description?: string;
    url?: string;
    location?: string;
  }): Promise<{ name: string; description: string; url: string; location: string }> {
    const apiUrl = "https://api.twitter.com/1.1/account/update_profile.json";

    const formParams: Record<string, string> = {};
    if (params.name !== undefined) formParams.name = params.name;
    if (params.description !== undefined) formParams.description = params.description;
    if (params.url !== undefined) formParams.url = params.url;
    if (params.location !== undefined) formParams.location = params.location;

    const creds = this.ensureTwitterCredentials();
    const oauthHeader = buildOAuth1Header(
      "POST",
      apiUrl,
      creds.apiKey,
      creds.apiSecret,
      creds.accessToken,
      creds.accessTokenSecret,
      formParams,
    );

    const body = new URLSearchParams(formParams).toString();

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: oauthHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Twitter API ${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      name: string;
      description: string;
      url: string;
      location: string;
    };
    return {
      name: data.name,
      description: data.description,
      url: data.url,
      location: data.location,
    };
  }
}
