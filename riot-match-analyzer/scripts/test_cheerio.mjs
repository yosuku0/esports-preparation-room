import fs from "node:fs";
import * as cheerio from "cheerio";

function analyze() {
  const html = fs.readFileSync("patch_14_4.html", "utf8");
  const $ = cheerio.load(html);
  
  // They usually put patch notes in a specific article
  const content = $("div").text();
  
  // Find nodes by ID
  const patchChamps = $("#patch-champions").parent();
  console.log("Found #patch-champions:", patchChamps.length > 0);
  
  if (patchChamps.length > 0) {
    const nextElements = patchChamps.nextAll("h3, h4");
    console.log("Next headers after #patch-champions:", nextElements.length);
    for (let i = 0; i < Math.min(5, nextElements.length); i++) {
        const tag = nextElements[i].tagName.toLowerCase();
        const text = $(nextElements[i]).text().trim();
        console.log(`[${tag}] ${text}`);
    }
  }
}

analyze();
