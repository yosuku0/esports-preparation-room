import fs from "node:fs";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function run() {
  const url = "https://www.leagueoflegends.com/en-us/news/game-updates/patch-14-4-notes/";
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Failed to fetch ${url}: ${res.status}`);
    return;
  }
  const html = await res.text();
  
  // Extract sections using regex to see what it looks like
  // Usually Riot uses <h3 id="patch-champion-name"> or something similar
  
  // Save first to file
  fs.writeFileSync("patch_14_4.html", html);
  console.log(`Saved HTML, length: ${html.length}`);
  
  // Let's find some champion headers
  const h3Match = html.match(/<h3[^>]*>.*?<\/h3>/g) || [];
  console.log("Found h3 headers:", h3Match.slice(0, 10));
  
  const h4Match = html.match(/<h4[^>]*>.*?<\/h4>/g) || [];
  console.log("Found h4 headers:", h4Match.slice(0, 10));
}

run();
