export type ChangeType = "buff" | "nerf" | "adjustment" | "new";
export type ParseStatus = "full" | "partial" | "fallback";

export interface ChampionChange {
  championName: string;
  changeType: ChangeType;
  summary: string;
  details: string;
}

export interface ItemChange {
  itemName: string;
  changeType: ChangeType;
  summary: string;
  details: string;
}

export interface PatchData {
  parseStatus: ParseStatus;
  patchVersion: string;
  patchDate: string;
  patchContext: string;
  championChanges: ChampionChange[];
  itemChanges: ItemChange[];
}
