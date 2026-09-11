import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Run against the separately built input/scene fixture, never the product app.
const base=process.argv[2]??'http://127.0.0.1:4174';
const output=resolve('artifacts/local/scene-videos');
await mkdir(output,{recursive:true});
const browser=await chromium.launch();
try{
  for(const [actor,ending] of [['iron','representative-iron'],['complaint','representative-complaint']]){
    const context=await browser.newContext({viewport:{width:360,height:600},deviceScaleFactor:1,recordVideo:{dir:output,size:{width:360,height:600}}});
    const page=await context.newPage();await page.goto(`${base}/scene.html`);
    await page.evaluate(({actor,ending})=>window.sceneFixture.prepare(actor,ending),{actor,ending});
    const samples=await page.evaluate(()=>new Promise(resolve=>{
      const start=performance.now(),samples=[];
      function frame(now){const elapsed=now-start;window.sceneFixture.draw(Math.max(0,elapsed));
        samples.push(JSON.parse(document.querySelector('#details').textContent));
        if(elapsed<6000)requestAnimationFrame(frame);else resolve(samples);
      }
      requestAnimationFrame(frame);
    }));
    const video=page.video();await context.close();await video.saveAs(resolve(output,`${actor}.webm`));
    await writeFile(resolve(output,`${actor}-samples.json`),JSON.stringify(samples,null,2));
    console.log(`${actor}: 360x600 video, ${samples.length} rendered samples (headless software browser, not device performance)`);
  }
}finally{await browser.close();}
