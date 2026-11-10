const browsers = require('playwright-core');
const assert = require('node:assert/strict');
const {resolve} = require('node:path');
const {pathToFileURL} = require('node:url');
(async()=>{
 for(const engine of ['chromium','firefox','webkit']) {
 const browser=await browsers[engine].launch();
 try {
 for(const width of [320,1280]){
 const ctx=await browser.newContext({viewport:{width,height:800},offline:engine!=='webkit'});
 const page=await ctx.newPage();
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 for(const name of ['json','git']){
 const url=pathToFileURL(resolve('examples/'+name+'.html')).href;
 await page.goto(url+'#example-2');
 if(engine==='chromium' && width===1280 && name==='git' && process.env.TRYCLI_SCREENSHOT) await page.locator('main').screenshot({path:'docs/demo.png'});
 const data=await page.locator('#data').textContent().then(JSON.parse);
 const buttons=page.locator('nav button');
 assert.equal(await buttons.nth(1).getAttribute('aria-pressed'),'true');
 for(const [i,ex] of data.examples.entries()){
 await buttons.nth(i).focus(); await page.keyboard.press('Enter');
 await page.waitForFunction(label=>document.querySelector('[aria-pressed=true]').textContent===label,ex.label);
 assert.equal(await page.locator('#output').textContent(),ex.output);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }
 await page.reload(); assert.equal(await buttons.nth(2).getAttribute('aria-pressed'),'true');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>{window.copied=t}}}));
 await page.locator('#copy').click();
 assert.match(await page.evaluate(()=>window.copied),/^printf '%s' /);
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:undefined}));
 await page.locator('#copy').click();
 assert.equal(await page.locator('#manual').inputValue(),await page.evaluate(()=>window.copied));
 await page.goto(url+'#example-900'); await page.waitForFunction(()=>document.querySelector('nav button').getAttribute('aria-pressed')==='true');
 }
 assert.deepEqual(errors,[]);await ctx.close();console.log(engine+' '+width+'px browser checks passed');
 }
 }finally{await browser.close()}
 }
})().catch(e=>{console.error(e);process.exitCode=1});

