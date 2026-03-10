import type { MatchDetail, RiotAccount, RoutingCluster } from "./types.js";

export class RiotApiClient {
  private readonly apiKey: string;
  private lastRequestTime = 0;
  private requestCount = 0;
  private windowStartTime = Date.now();
  private readonly MIN_INTERVAL_MS = 60;
  private readonly WINDOW_LIMIT = 90;
  private readonly WINDOW_MS = 120_000;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  getAccountUrl(
    cluster: RoutingCluster,
    gameName: string,
    tagLine: string
  ): string {
    return `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
      gameName
    )}/${encodeURIComponent(tagLine)}`;
  }

  getMatchListUrl(
    cluster: RoutingCluster,
    puuid: string,
    count: number = 10
  ): string {
    return `https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=${count}`;
  }

  getMatchDetailUrl(cluster: RoutingCluster, matchId: string): string {
    return `https://${cluster}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
  }

  async fetch<T>(url: string): Promise<T> {
    const MAX_NETWORK_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_NETWORK_RETRIES; attempt++) {
      try {
        return await this.fetchOnce<T>(url);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isNetworkError = message.startsWith("NETWORK_ERROR");

        if (!isNetworkError || attempt === MAX_NETWORK_RETRIES) {
          throw error;
        }

        const backoffMs = attempt * 1000;
        console.error(
          `Network error. Retrying in ${backoffMs}ms... (attempt ${attempt}/${MAX_NETWORK_RETRIES})`
        );
        await this.sleep(backoffMs);
      }
    }

    throw new Error("NETWORK_ERROR: unexpected retry flow");
  }

  async getAccountByRiotId(
    cluster: RoutingCluster,
    gameName: string,
    tagLine: string
  ): Promise<RiotAccount> {
    return this.fetch<RiotAccount>(this.getAccountUrl(cluster, gameName, tagLine));
  }

  async getMatchIds(
    cluster: RoutingCluster,
    puuid: string,
    count: number = 10
  ): Promise<string[]> {
    return this.fetch<string[]>(this.getMatchListUrl(cluster, puuid, count));
  }

  async getMatchDetail(
    cluster: RoutingCluster,
    matchId: string
  ): Promise<MatchDetail> {
    return this.fetch<MatchDetail>(this.getMatchDetailUrl(cluster, matchId));
  }

  private async fetchOnce<T>(url: string): Promise<T> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.MIN_INTERVAL_MS) {
      await this.sleep(this.MIN_INTERVAL_MS - elapsed);
    }

    if (Date.now() - this.windowStartTime > this.WINDOW_MS) {
      this.requestCount = 0;
      this.windowStartTime = Date.now();
    }

    if (this.requestCount >= this.WINDOW_LIMIT) {
      const waitTime = this.WINDOW_MS - (Date.now() - this.windowStartTime);
      console.error(`Rate limit approaching. Waiting ${waitTime}ms...`);
      await this.sleep(waitTime);
      this.requestCount = 0;
      this.windowStartTime = Date.now();
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { "X-Riot-Token": this.apiKey }
      });
    } catch (error) {
      this.requestCount--;
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`NETWORK_ERROR: ${message}`);
    }

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get("Retry-After") || "5", 10);
      console.error(`Rate limited. Retrying after ${retryAfter}s...`);
      await this.sleep(retryAfter * 1000);
      this.requestCount--;
      return this.fetchOnce<T>(url);
    }

    if (response.status === 404) {
      throw new Error("NOT_FOUND");
    }

    if (!response.ok) {
      throw new Error(`Riot API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
