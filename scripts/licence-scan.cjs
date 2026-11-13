// Licence scan: every package in package-lock.json, plus the packages that end up in
// the built bundle (read from the production source map). Fails on a licence outside
// the allow-list for anything shipped.
// Usage: npm run licence-scan   (builds with a source map into .licence-scan/ first)
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const ALLOWED_SHIPPED = new Set(["Apache-2.0", "MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "0BSD"]);

const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8")).packages;
const counts = {};
for (const [p, info] of Object.entries(lock)) {
  if (!p) continue;
  const key = `${info.license ?? "UNKNOWN"}${info.dev ? " (dev)" : ""}`;
  counts[key] = (counts[key] ?? 0) + 1;
}
console.log("All installed packages by licence:", counts);

const dir = path.join(root, ".licence-scan", "assets");
const map = fs.readdirSync(dir).find((f) => f.endsWith(".js.map"));
const sources = JSON.parse(fs.readFileSync(path.join(dir, map), "utf8")).sources;
const shipped = new Set(
  sources
    .filter((s) => s.includes("node_modules/"))
    .map((s) => {
      const parts = s.split("node_modules/").pop().split("/");
      return parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
    }),
);
let bad = 0;
console.log("\nShipped in the bundle:");
for (const name of [...shipped].sort()) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "node_modules", name, "package.json"), "utf8"));
  const ok = ALLOWED_SHIPPED.has(pkg.license);
  if (!ok) bad++;
  console.log(`  ${ok ? "ok " : "BAD"} ${name}@${pkg.version} ${pkg.license}`);
}
process.exit(bad ? 1 : 0);
