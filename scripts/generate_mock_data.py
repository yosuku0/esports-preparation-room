import json
import os
import random

random.seed(42) # For reproducible results

# 20 matches outcome (Team level)
# Wins: short duration. Losses: long duration.
match_info = [
  {"id": 1, "duration": 22, "result": "Win"},
  {"id": 2, "duration": 24, "result": "Win"},
  {"id": 3, "duration": 38, "result": "Loss"},
  {"id": 4, "duration": 21, "result": "Win"},
  {"id": 5, "duration": 36, "result": "Loss"},
  {"id": 6, "duration": 25, "result": "Win"},
  {"id": 7, "duration": 28, "result": "Win"},
  {"id": 8, "duration": 40, "result": "Loss"},
  {"id": 9, "duration": 35, "result": "Loss"},
  {"id": 10, "duration": 15, "result": "Win"},
  {"id": 11, "duration": 37, "result": "Loss"},
  {"id": 12, "duration": 20, "result": "Win"},
  {"id": 13, "duration": 39, "result": "Loss"},
  {"id": 14, "duration": 26, "result": "Win"},
  {"id": 15, "duration": 42, "result": "Loss"},
  {"id": 16, "duration": 33, "result": "Loss"},
  {"id": 17, "duration": 35, "result": "Loss"},
  {"id": 18, "duration": 38, "result": "Loss"},
  {"id": 19, "duration": 24, "result": "Win"},
  {"id": 20, "duration": 36, "result": "Loss"}
]

def generate_matches(role, match_info):
    matches = []
    for m in match_info:
        idx = m["id"]
        res = m["result"]
        dur = m["duration"]
        
        # SolidRock: Top - Counter buffed in patch
        if role == "Top":
            champ = "Malphite" if random.random() > 0.4 else "Sion"
            kills = random.randint(1,4)
            deaths = random.randint(1,3) if res == "Win" else random.randint(4,6)
            assists = random.randint(5,15)
            kda = f"{kills}/{deaths}/{assists}"
            cs = dur * random.uniform(7.0, 8.5)
            items = ["Sunfire Aegis", "Thornmail", "Jak'Sho"]
            if idx >= 16: 
                cs = dur * random.uniform(6.0, 7.5) # CS dropped slightly recently

        # GankMachine: Jungle - Lee Sin 100% WR but low games
        elif role == "Jungle":
            if idx in [1, 4, 12]:
                champ = "Lee Sin"
                kills = random.randint(5,10)
                deaths = random.randint(0,2)
                assists = random.randint(8,12)
                kda = f"{kills}/{deaths}/{assists}"
                cs = dur * random.uniform(5.5, 6.5)
                items = ["Eclipse", "Sundered Sky", "Sterak's Gage"]
            else:
                champ = "Jarvan IV"
                kills = random.randint(2,5)
                deaths = random.randint(1,3) if res == "Win" else random.randint(4,8)
                assists = random.randint(10,20)
                kda = f"{kills}/{deaths}/{assists}"
                cs = dur * random.uniform(4.5, 5.5)
                items = ["Goredrinker", "Black Cleaver", "Guardian Angel"]
        
        # MetaSlave: Mid - New champ (Ahri) practice + Buffed + Low WR
        elif role == "Mid":
            if idx >= 16:
                champ = "Ahri"
                if res == "Win":
                    kda = "6/2/8"
                else:
                    kda = f"{random.randint(1,3)}/{random.randint(4,7)}/{random.randint(2,6)}"
                items = ["Luden's Companion", "Shadowflame", "Zhonya's Hourglass"]
            else:
                champ = "Orianna" if idx % 2 == 0 else "Syndra"
                kills = random.randint(4,8)
                deaths = random.randint(2,5)
                assists = random.randint(5,10)
                kda = f"{kills}/{deaths}/{assists}"
                items = ["Archangel's Staff", "Liandry's Torment", "Rabadon's Deathcap"]
            cs = dur * random.uniform(8.0, 9.5)

        # KiteGod: ADC - Wide pool, changed core item
        elif role == "ADC":
            champ_pool = ["Xayah", "Ashe", "Jinx"]
            champ = random.choice(champ_pool)
            
            if idx in [2, 5, 8, 14]:
                champ = "Aphelios"
                items = ["Kraken Slayer", "Bloodthirster", "Infinity Edge"]
            elif idx in [16, 18, 20]:
                champ = "Aphelios"
                items = ["Kraken Slayer", "Infinity Edge", "Lord Dominik's Regards"] # Core changed recently
            else:
                items = ["Kraken Slayer", "Phantom Dancer", "Infinity Edge"]
            
            kills = random.randint(3,10)
            deaths = random.randint(2,6)
            assists = random.randint(3,8)
            kda = f"{kills}/{deaths}/{assists}"
            cs = dur * random.uniform(8.5, 10.0)

        # TwoTrick: Support - 2 tricks, one nerfed (Leona)
        elif role == "Support":
            if idx in [4, 7, 10, 14, 17, 19]:
                champ = "Leona"
            else:
                champ = "Nautilus"
            kills = random.randint(0,2)
            deaths = random.randint(1,3) if res == "Win" else random.randint(4,8)
            assists = random.randint(10,25)
            kda = f"{kills}/{deaths}/{assists}"
            cs = dur * random.uniform(1.0, 2.0)
            items = ["Celestial Opposition", "Locket of the Iron Solari", "Zeke's Convergence"]

        matches.append({
            "match_id": idx,
            "champion": champ,
            "result": res,
            "kda": kda,
            "core_build": items,
            "duration": dur,
            "cs_per_min": round(cs / dur, 1)
        })
    return matches

team_data = {
    "team_name": "Falcon Esports",
    "players": [
        {"summoner_name": "SolidRock", "role": "Top", "matches": generate_matches("Top", match_info)},
        {"summoner_name": "GankMachine", "role": "Jungle", "matches": generate_matches("Jungle", match_info)},
        {"summoner_name": "MetaSlave", "role": "Mid", "matches": generate_matches("Mid", match_info)},
        {"summoner_name": "KiteGod", "role": "ADC", "matches": generate_matches("ADC", match_info)},
        {"summoner_name": "TwoTrick", "role": "Support", "matches": generate_matches("Support", match_info)}
    ]
}

os.makedirs('mock_data', exist_ok=True)
with open('mock_data/opponent_team.json', 'w', encoding='utf-8') as f:
    json.dump(team_data, f, ensure_ascii=False, indent=2)

patch_data = {
  "patch_version": "14.12",
  "champions": [
    {
      "name": "Ahri",
      "type": "buff",
      "details": "Qの消費マナ減少 70/80/90/100/110 → 60/70/80/90/100, Eのチャーム時間 1.2-2.0秒 → 1.4-2.0秒"
    },
    {
      "name": "Sylas",
      "type": "buff",
      "details": "Wの基本回復量 20/40/60/80/100 → 30/50/70/90/110"
    },
    {
      "name": "Leona",
      "type": "nerf",
      "details": "Wの防御力増加量 20/27.5/35/42.5/50 → 15/20/25/30/35"
    },
    {
      "name": "Aatrox",
      "type": "adjustment",
      "details": "Qのダメージスケーリング調整"
    },
    {
      "name": "Ezreal",
      "type": "buff",
      "details": "基礎攻撃力成長率 2.5 → 2.7"
    }
  ],
  "items": [
    {
      "name": "Kraken Slayer",
      "type": "nerf",
      "details": "基本攻撃力 45 → 40"
    },
    {
      "name": "Warmog's Armor",
      "type": "buff",
      "details": "体力が3000以上の場合、自動回復効果が発動 → 2800以上に緩和"
    }
  ]
}

with open('mock_data/current_patch.json', 'w', encoding='utf-8') as f:
    json.dump(patch_data, f, ensure_ascii=False, indent=2)

print("Mock data generated successfully in mock_data/ directory.")
