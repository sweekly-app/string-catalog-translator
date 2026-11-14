// Renders cards.html to cards/0N-*.png at 1920x1080.
const { chromium } = require('playwright');
const path = require('path');
const names = ['01-why', '02-how', '03-end'];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + path.join(__dirname, 'cards.html'));
  for (let i = 0; i < names.length; i++) {
    await p.evaluate((id) => { document.querySelectorAll('.c').forEach(c => c.classList.toggle('show', c.id === id)); }, 'c' + (i + 1));
    await p.screenshot({ path: path.join(__dirname, 'cards', names[i] + '.png') });
  }
  await b.close();
})();
