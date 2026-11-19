// Records footage/replay-export.webm: the app replaying the bundled recorded run (src/recorded-run.json), exporting
// Android strings.xml, then a listing of the zip it produced. Nothing is translated or sent: it is a replay.
// Usage: npm run build; npx vite preview --port 4173 --strictPort &; node video/capture-export.cjs [url]
// Then compose.sh labels the whole clip "Replay of a recorded run" (cuts.txt row 5).
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const url = process.argv[2] || "http://localhost:4173/";
const dir = path.join(__dirname, "footage");
const size = { width: 1920, height: 1080 };
const zoom = () => { document.documentElement.style.zoom = "1.5"; }; // like Chrome at 150 %, so text stays readable in 1080p
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

(async () => {
  fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch();
  // Prepare off camera: open the replay and find the export buttons.
  const ctx = await b.newContext({ viewport: size, acceptDownloads: true, colorScheme: "dark", recordVideo: { dir, size } });
  const p = await ctx.newPage();
  await p.addInitScript(`document.addEventListener("DOMContentLoaded", ${zoom})`);
  p.on("dialog", (d) => d.accept());
  const t0 = Date.now();
  await p.goto(url);
  await p.click("#recorded");
  await p.waitForTimeout(1500);
  const exportsBtn = p.getByRole("button", { name: "Android strings.xml" });
  const start = (Date.now() - t0) / 1000; // footage starts here, with the receipt in view
  await p.waitForTimeout(2500);
  await exportsBtn.scrollIntoViewIfNeeded();
  await p.mouse.move(960, 540);
  await p.waitForTimeout(1200);
  const box = await exportsBtn.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
  await p.waitForTimeout(500);
  const [dl] = await Promise.all([p.waitForEvent("download"), exportsBtn.click()]);
  const zipPath = path.join(dir, dl.suggestedFilename());
  await dl.saveAs(zipPath);
  await p.waitForTimeout(1200);
  // The zip as it lands in a project: its folders, then the start of the Japanese file.
  const list = execFileSync("unzip", ["-Z1", zipPath]).toString().trim().split("\n");
  const ja = execFileSync("unzip", ["-p", zipPath, list.find((f) => f.includes("-ja")) || list[0]]).toString().split("\n").slice(0, 13).join("\n");
  await p.setContent(`<html><body style="margin:0;background:#0f1420;color:#e8eaed;font:20px Inter,system-ui,sans-serif">
    <div style="padding:44px 64px">
      <div style="font-size:24px;font-weight:600;margin-bottom:20px">${esc(dl.suggestedFilename())}: the file the export just saved</div>
      <div style="display:flex;gap:60px">
        <pre style="font:19px/1.6 ui-monospace,Menlo,monospace;color:#8ab4f8;margin:0">${esc(list.join("\n"))}</pre>
        <pre style="font:15px/1.45 ui-monospace,Menlo,monospace;color:#c3e88d;margin:0;white-space:pre-wrap;flex:1">${esc(ja)}\n…</pre>
      </div>
    </div></body></html>`);
  await p.evaluate(zoom);
  await p.waitForTimeout(5000);
  const end = (Date.now() - t0) / 1000;
  const video = p.video();
  await ctx.close();
  const out = path.join(dir, "replay-export.webm");
  fs.renameSync(await video.path(), out);
  await b.close();
  console.log(`footage/replay-export.webm: use ${start.toFixed(1)} to ${end.toFixed(1)} s; zip ${list.length} files`);
})();
