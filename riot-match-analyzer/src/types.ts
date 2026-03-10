// リージョン関連
export type RoutingCluster = "americas" | "asia" | "europe" | "sea";
export type PlatformId =
  | "na1"
  | "jp1"
  | "kr"
  | "euw1"
  | "eun1"
  | "br1"
  | "la1"
  | "la2"
  | "oc1"
  | "tr1"
  | "ru"
  | "ph2"
  | "sg2"
  | "th2"
  | "tw2"
  | "vn2";

// MCPツール入力
export interface PlayerProfileInput {
  gameName: string;
  tagLine: string;
  routingCluster: RoutingCluster;
  platformId?: PlatformId; // 将来のMastery API用。MVPでは未使用
}

export interface TeamProfileInput {
  players: Array<{ gameName: string; tagLine: string }>;
  routingCluster: RoutingCluster;
  platformId?: PlatformId;
}

// 前処理後の出力型
export interface ProcessedMatch {
  championName: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  kda: string; // "4/2/7" 形式の文字列
  coreItems: string[]; // コア完成アイテム名（最大3つ）
  csPerMin: number; // 小数点1桁
  gameDurationMin: number; // 小数点1桁
  visionScore: number;
}

export interface PlayerProfile {
  gameName: string;
  tagLine: string;
  puuid: string;
  recentMatches: ProcessedMatch[]; // 直近10試合
  summary: PlayerSummary;
}

export interface ChampionPoolEntry {
  champion: string;
  games: number;
  wins: number;
  winRate: number; // 0.0〜1.0
}

export interface PlayerSummary {
  championPool: ChampionPoolEntry[];
  totalGames: number;
  totalWinRate: number;
  avgKDA: string;
  avgCsPerMin: number;
  avgGameDurationMin: number;
  avgVisionScore: number;
}

export interface TeamProfile {
  players: PlayerProfile[];
  teamSummary: {
    avgGameDurationMin: number;
    winRateByDuration: {
      under25min: { games: number; winRate: number };
      between25and35min: { games: number; winRate: number };
      over35min: { games: number; winRate: number };
    };
  };
}

// Data Dragon キャッシュ型
export interface DataDragonCache {
  version: string;
  champions: Map<string, string>; // championId → championName
  items: Map<number, ItemData>; // itemId → ItemData
}

export interface ItemData {
  name: string;
  goldTotal: number;
  tags: string[];
  into?: string[]; // このアイテムが合成素材になる先。存在しない＝完成品の可能性
}

// Riot API レスポンス（内部利用）
export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export interface MatchParticipant {
  puuid: string;
  championName: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  visionScore: number;
}

export interface MatchDetail {
  info: {
    gameDuration: number;
    participants: MatchParticipant[];
  };
}