import type { ChangeType } from "./types.js";

const buffIndicators =
  /damage|base damage|bonus damage|heal|healing|shield|health|armor|magic resist|mr|ad|ap|ratio|attack speed|move speed|movement speed/i;
const nerfIndicators = /cooldown|\bcd\b|mana cost|energy cost|\bcost\b|cast time/i;

function parseNumbers(text: string): number[] {
  const nums = text.match(/[\d.]+/g);
  if (!nums) return [];
  return nums
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n));
}

export function classifyChange(detailsText: string, summaryText = ""): ChangeType {
  const combined = `${summaryText}\n${detailsText}`;

  if (/at game times?.*at levels?/i.test(combined)) {
    return "adjustment";
  }

  if (/\bnew\b|added|brand new/i.test(combined)) {
    return "new";
  }

  const arrowLines = combined
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /[→⇒]|->|>>/.test(line));

  let buffCount = 0;
  let nerfCount = 0;

  for (const line of arrowLines) {
    const parts = line.split(/[→⇒]|->|>>/);
    if (parts.length < 2) continue;

    const beforeNums = parseNumbers(parts[0]);
    const afterNums = parseNumbers(parts[1]);
    const pairCount = Math.min(beforeNums.length, afterNums.length);
    if (pairCount === 0) continue;

    const fieldIsBuff = buffIndicators.test(line);
    const fieldIsNerf = nerfIndicators.test(line);

    let inc = 0;
    let dec = 0;
    for (let i = 0; i < pairCount; i++) {
      if (afterNums[i] > beforeNums[i]) inc++;
      if (afterNums[i] < beforeNums[i]) dec++;
    }
    if (inc === 0 && dec === 0) continue;

    if (fieldIsBuff && !fieldIsNerf) {
      buffCount += inc;
      nerfCount += dec;
      continue;
    }

    if (fieldIsNerf && !fieldIsBuff) {
      nerfCount += inc;
      buffCount += dec;
      continue;
    }

    buffCount += inc;
    nerfCount += dec;
  }

  if (/\bno longer\b|removed|tap down|reduce utility/i.test(combined)) nerfCount += 2;
  if (/qol|some love|improved|underperforming|help him|help her/i.test(combined)) buffCount += 1;

  if (buffCount > 0 && nerfCount === 0) return "buff";
  if (nerfCount > 0 && buffCount === 0) return "nerf";
  if (buffCount > 0 && nerfCount > 0) {
    const ratio = buffCount / nerfCount;
    if (ratio >= 2) return "buff";
    if (ratio <= 0.5) return "nerf";
    return "adjustment";
  }

  if (/\bbuff\b|increased|increase|stronger|improved/i.test(combined)) return "buff";
  if (/\bnerf\b|decreased|decrease|weaker|reduced/i.test(combined)) return "nerf";

  return "adjustment";
}
