import fs from "node:fs";

const auto = JSON.parse(fs.readFileSync("test-logs/patch_26.5.json", "utf8"));
const manual = JSON.parse(fs.readFileSync("../riot-match-analyzer/test-logs/current_patch_26_5.json", "utf8"));

const normalize = (s) => String(s).toLowerCase().replace(/’/g, "'").trim();

const manualMap = new Map(manual.championChanges.map((c) => [normalize(c.championName), c.changeType]));

let matched = 0;
let same = 0;

for (const c of auto.championChanges) {
  const key = normalize(c.championName);
  const expected = manualMap.get(key);
  if (!expected) continue;

  matched += 1;
  if (expected === c.changeType) same += 1;
  console.log(`${c.championName}: auto=${c.changeType} manual=${expected}`);
}

const accuracy = matched > 0 ? same / matched : 0;
console.log(`matched=${matched}`);
console.log(`same=${same}`);
console.log(`accuracy=${accuracy.toFixed(3)}`);

const required = [
  "Akali",
  "Azir",
  "Garen",
  "Kha'Zix",
  "Lee Sin",
  "Lillia",
  "Mel",
  "Neeko",
  "Nocturne",
  "Orianna",
  "Samira",
  "Taliyah",
  "Varus",
  "Volibear"
];

const autoNames = new Set(auto.championChanges.map((c) => normalize(c.championName)));
const missing = required.filter((name) => !autoNames.has(normalize(name)));
console.log(`missingRequired=${missing.join(",") || "none"}`);
