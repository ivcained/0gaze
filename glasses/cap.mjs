import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new', args:['--hide-scrollbars','--force-device-scale-factor=1'] });
const p = await b.newPage();
await p.setViewport({ width:1470, height:956, deviceScaleFactor:1 });
await p.goto('http://127.0.0.1:7610/', { waitUntil:'domcontentloaded' });
await new Promise(r=>setTimeout(r,1500));
await p.screenshot({ path:'/Users/lc/.hermes/cache/scratch/ui/live-challenge.png' });
console.log('state', await p.evaluate(()=>document.getElementById('kicker').textContent + ' | ' + document.getElementById('directive').textContent + ' | ' + document.getElementById('hint').textContent + ' | amount=' + document.getElementById('amount').textContent));
await b.close();
