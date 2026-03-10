import fs from "node:fs";

function test() {
  const html = fs.readFileSync("patch_14_4.html", "utf8");
  
  // Try to find Aurelion Sol which is in 14.4
  const idx = html.indexOf("Aurelion Sol");
  if (idx !== -1) {
    console.log("Found Aurelion Sol!");
    console.log(html.substring(Math.max(0, idx - 200), idx + 200));
  }
}
test();
