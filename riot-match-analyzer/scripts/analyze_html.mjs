import fs from "node:fs";

function analyze() {
  const html = fs.readFileSync("patch_14_4.html", "utf8");
  
  // Find a champion change block
  const championStarts = html.split('<h4 class="change-title">');
  if (championStarts.length < 2) {
    console.log("No champions found with class 'change-title'");
    return;
  }
  
  // Look at the first champion block
  const firstChamp = championStarts[1].substring(0, 500); // Just peek at the first 500 chars
  console.log("--- Champion Block Sample ---");
  console.log(firstChamp);
  
  // Look at the items block
  const itemHeader = html.indexOf('id="patch-items"');
  if (itemHeader !== -1) {
    const itemsPart = html.substring(itemHeader, itemHeader + 1000);
    console.log("--- Items Block Sample ---");
    console.log(itemsPart);
  }
}

analyze();
