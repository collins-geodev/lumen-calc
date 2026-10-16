const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const www = path.join(root, "www");
const files = [
  "index.html",
  "styles.css",
  "app.js",
  "ai.js",
  "currency.js",
  "data.js",
  "picker.js",
  "programmer.js",
  "units.js",
  "manifest.webmanifest",
  "sw.js",
];

fs.mkdirSync(www, { recursive: true });
for (const file of files) {
  const src = path.join(root, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(www, file));
  }
}

const iconsDir = path.join(root, "icons");
const wwwIcons = path.join(www, "icons");
if (fs.existsSync(iconsDir)) {
  fs.mkdirSync(wwwIcons, { recursive: true });
  for (const name of fs.readdirSync(iconsDir)) {
    fs.copyFileSync(path.join(iconsDir, name), path.join(wwwIcons, name));
  }
}

console.log("Synced web assets into www/");
