const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(
  root,
  "android",
  "app",
  "build",
  "outputs",
  "apk",
  "debug",
  "app-debug.apk"
);
const dist = path.join(root, "dist");
const dest = path.join(dist, "odogwu-calc.apk");

if (!fs.existsSync(src)) {
  console.error("APK not found. Run npm run apk first.");
  process.exit(1);
}

fs.mkdirSync(dist, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`APK ready: ${dest}`);
