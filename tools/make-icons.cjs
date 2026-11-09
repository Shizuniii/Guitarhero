const { chromium } = require('playwright');
const { readFileSync } = require('fs');
(async () => {
  const svg = readFileSync('icons/icon.svg', 'utf8');
  const b = await chromium.launch();
  for (const size of [192, 512]) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<!doctype html><style>*{margin:0}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`);
    await p.screenshot({ path: `icons/icon-${size}.png` });
    await p.close();
  }
  await b.close();
})();
