import { buildOAuth1Header } from "./oauth.js";

const API_BASE = "https://api.twitter.com/2";

interface TwitterCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

interface TweetData {
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

interface UserData {
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
  private creds: TwitterCredentials;

  constructor() {
    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN;
    const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

    if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
      throw new Error(
        "Missing Twitter credentials. Set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET",
      );
    }

    this.creds = { apiKey, apiSecret, accessToken, accessTokenSecret };
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
    const oauthHeader = buildOAuth1Header(
      "GET",
      baseUrl,
      this.creds.apiKey,
      this.creds.apiSecret,
      this.creds.accessToken,
      this.creds.accessTokenSecret,
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
    const oauthHeader = buildOAuth1Header(
      "POST",
      url,
      this.creds.apiKey,
      this.creds.apiSecret,
      this.creds.accessToken,
      this.creds.accessTokenSecret,
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
    const oauthHeader = buildOAuth1Header(
      "DELETE",
      url,
      this.creds.apiKey,
      this.creds.apiSecret,
      this.creds.accessToken,
      this.creds.accessTokenSecret,
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
    const oauthHeader = buildOAuth1Header(
      "DELETE",
      url,
      this.creds.apiKey,
      this.creds.apiSecret,
      this.creds.accessToken,
      this.creds.accessTokenSecret,
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

    const oauthHeader = buildOAuth1Header(
      "POST",
      apiUrl,
      this.creds.apiKey,
      this.creds.apiSecret,
      this.creds.accessToken,
      this.creds.accessTokenSecret,
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
